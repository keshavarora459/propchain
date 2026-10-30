export type DocumentType =
  | 'Title Deed'
  | 'Cadastral Survey'
  | 'Tax Clearance'
  | 'Encumbrance Certificate'
  | 'Identity Proof (KYC)'
  | 'Sale Agreement'

export type DocumentVerificationStatus = 'Verified' | 'Pending Review' | 'OCR Processed' | 'Rejected' | 'Tamper Suspect'

export interface DocumentRecord {
  id: string
  propertyId: string
  propertyTitle: string
  documentName: string
  documentType: DocumentType
  fileSize: string
  uploadedAt: string
  uploadedBy: string
  status: DocumentVerificationStatus
  ocrConfidence: number // percentage 0-100
  documentHash: string // SHA-256 placeholder
  ipfsCid?: string
  reviewNotes?: string
}

