"""
Document OCR and Text Extraction Service for PropChain.
Utilizes PyMuPDF for digital PDF extraction and Tesseract OCR for scanned deeds and images.
"""
import io
import os
import re
from typing import Any, Dict, Tuple

import fitz  # PyMuPDF
from PIL import Image

from app.core.logging import get_logger

logger = get_logger("document_processing")


class DocumentProcessingService:
    def __init__(self):
        self.tesseract_cmd = os.getenv("TESSERACT_CMD")
        if self.tesseract_cmd:
            try:
                import pytesseract
                pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd
            except Exception as e:
                logger.warning("Could not set tesseract_cmd: %s", e)

    def process_document(
        self,
        content: bytes,
        filename: str,
        mime_type: str,
    ) -> Tuple[str, Dict[str, Any], bool, str]:
        """
        Extracts digital or OCR text and identifies candidate legal metadata.
        Returns: (extracted_text, candidate_fields, ocr_applied, processing_status)
        """
        extracted_text = ""
        ocr_applied = False
        status = "SUCCESS"

        try:
            # 1. Process PDF using PyMuPDF
            if "pdf" in mime_type.lower() or filename.lower().endswith(".pdf"):
                with fitz.open(stream=content, filetype="pdf") as doc:
                    for page in doc:
                        extracted_text += page.get_text() + "\n"

            # 2. If text is sparse or document is an image, attempt OCR if available
            if len(extracted_text.strip()) < 50:
                try:
                    import pytesseract

                    image = None
                    if "pdf" in mime_type.lower() or filename.lower().endswith(".pdf"):
                        # Render first page of PDF as image for OCR
                        with fitz.open(stream=content, filetype="pdf") as doc:
                            if len(doc) > 0:
                                pix = doc[0].get_pixmap()
                                image = Image.open(io.BytesIO(pix.tobytes("png")))
                    else:
                        image = Image.open(io.BytesIO(content))

                    if image:
                        ocr_text = pytesseract.image_to_string(image)
                        if ocr_text and ocr_text.strip():
                            extracted_text += "\n" + ocr_text
                            ocr_applied = True
                except Exception as ocr_err:
                    logger.info("OCR fallback not available or skipped: %s", ocr_err)
                    # Not fatal: PyMuPDF or partial extraction was used

            # 3. Extract candidate legal fields using pattern analysis
            candidate_fields = self._extract_candidate_fields(extracted_text)
            return extracted_text.strip(), candidate_fields, ocr_applied, status

        except Exception as e:
            logger.error("Document processing error on %s: %s", filename, e)
            return "", {}, False, "FAILED"

    def _extract_candidate_fields(self, text: str) -> Dict[str, Any]:
        """Heuristic analysis of extracted deed text to surface candidate fields."""
        candidates: Dict[str, Any] = {}
        if not text:
            return candidates

        # Registration Number pattern
        reg_match = re.search(
            r"(?:Registration|Registry|Deed)\s+(?:No|Number|Ref)[\s.:]+([A-Z0-9\-\/]{4,30})",
            text,
            re.IGNORECASE,
        )
        if reg_match:
            candidates["registration_number"] = reg_match.group(1).strip()

        # Survey / Parcel Number pattern
        survey_match = re.search(
            r"(?:Survey|Parcel|Khasra|Gat)\s+(?:No|Number)[\s.:]+([A-Z0-9\-\/]{2,20})",
            text,
            re.IGNORECASE,
        )
        if survey_match:
            candidates["survey_number"] = survey_match.group(1).strip()

        # Document Date pattern
        date_match = re.search(
            r"(?:Dated?|Execution Date)[\s.:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})",
            text,
            re.IGNORECASE,
        )
        if date_match:
            candidates["document_date"] = date_match.group(1).strip()

        # Issuing Authority pattern
        auth_match = re.search(
            r"(Sub-Registrar|District Registrar|Revenue Department|Municipal Corporation|Gram Panchayat|Land Authority)[^,\n.]*",
            text,
            re.IGNORECASE,
        )
        if auth_match:
            candidates["issuing_authority"] = auth_match.group(0).strip()

        return candidates

