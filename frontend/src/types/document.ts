export type DocumentType =
  | 'Title Deed'
  | 'Cadastral Survey'
  | 'Tax Clearance'
  | 'Encumbrance Certificate'
  | 'Identity Proof (KYC)'
  | 'Sale Agreement'
  | 'SALE_DEED'
  | 'TITLE_DEED'
  | 'REGISTRATION_CERTIFICATE'
  | 'ENCUMBRANCE_CERTIFICATE'
  | 'TAX_RECEIPT'
  | 'LAND_RECORD'
  | 'SURVEY_DOCUMENT'
  | 'IDENTITY_PROOF'
  | 'OTHER'
  | string

export type DocumentVerificationStatus =
  | 'Verified'
  | 'Pending Review'
  | 'OCR Processed'
  | 'Rejected'
  | 'Tamper Suspect'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'REQUIRES_CORRECTION'
  | string

export interface DocumentRecord {
  id: string
  propertyId: string
  property_id?: string
  propertyTitle: string
  documentName: string
  title?: string
  documentType: DocumentType
  document_type?: string
  original_filename?: string
  fileSize: string
  file_size?: number
  uploadedAt: string
  uploaded_at?: string
  uploadedBy: string
  uploaded_by?: string
  status: DocumentVerificationStatus
  ocrConfidence?: number | null // percentage 0-100 or null if not scanned
  documentHash: string // SHA-256 hash
  document_hash?: string
  ipfsCid?: string
  reviewNotes?: string
  is_cross_property_duplicate?: boolean
  duplicate_property_name?: string
  duplicate_warning?: string
  extractedText?: string
  candidateFields?: Record<string, unknown>
}
