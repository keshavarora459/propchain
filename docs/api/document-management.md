# Document Management & Verification API Reference

## Base URLs
- `/api/v1/properties/{property_id}/documents`
- `/api/v1/documents/{document_id}`

## Endpoints

### 1. Upload Property Document
- **Method**: `POST /api/v1/properties/{property_id}/documents`
- **Auth**: Bearer JWT (Owner of property or Admin).
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `file`: Binary file (PDF, PNG, JPG, JPEG, max 10MB)
  - `document_type`: `SALE_DEED`, `TITLE_DEED`, `TAX_RECEIPT`, `ENCUMBRANCE_CERTIFICATE`, etc.
  - `title`: Human-readable label
- **Processing**:
  - SHA-256 hash calculated on raw bytes.
  - Encrypted at rest using Fernet/AES.
  - PyMuPDF and OCR extract digital text and legal candidates.
- **Response**: `201 Created` with `DocumentResponse`.

### 2. Get Document Details & OCR Extraction
- **Method**: `GET /api/v1/documents/{document_id}`
- **Response**: `200 OK` with `DocumentDetailResponse` including candidate fields (`registration_number`, `survey_number`, dates, authorities).

### 3. Download Decrypted Document
- **Method**: `GET /api/v1/documents/{document_id}/download`
- **Response**: Streamed decrypted file bytes.

### 4. Verify Document
- **Method**: `POST /api/v1/documents/{document_id}/verify`
- **Auth**: `VERIFIER` or `ADMIN`.
- **Body**: `{ "comments": "Deed verified with revenue office." }`

### 5. Reject Document
- **Method**: `POST /api/v1/documents/{document_id}/reject`
- **Auth**: `VERIFIER` or `ADMIN`.
- **Body**: `{ "reason": "Seal illegible, please re-upload clear scan." }`

### 6. Request Correction
- **Method**: `POST /api/v1/documents/{document_id}/request-correction`
- **Auth**: `VERIFIER` or `ADMIN`.
- **Body**: `{ "correction_notes": "Page 3 missing survey diagram." }`

