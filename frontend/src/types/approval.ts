export type ApprovalCategory =
  | 'Property Registration'
  | 'Title Transfer'
  | 'Document Audit'
  | 'Encumbrance Clearance'
  | 'Seller Acceptance'
  | 'Buyer Purchase Request'
  | string

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Under Investigation'

export interface ApprovalRequest {
  id: string
  approvalId: string
  category: ApprovalCategory
  propertyId: string
  propertyTitle: string
  submittedBy: string
  submittedAt: string
  assignedApprover: string
  status: ApprovalStatus
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  description: string
  decidedAt?: string
  decisionNotes?: string
  // Linked transaction details
  transactionId?: string
  transactionNumber?: string
  buyerName?: string
  buyerEmail?: string
  sellerName?: string
  sellerEmail?: string
  amount?: number
  currency?: string
  purchaseMode?: string
  tokenQuantity?: number | null
  tokenSymbol?: string | null
  ownershipPercentage?: number | null
  propertyIsTokenized?: boolean
}
