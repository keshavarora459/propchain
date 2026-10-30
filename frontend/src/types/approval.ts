export type ApprovalCategory = 'Property Registration' | 'Title Transfer' | 'Document Audit' | 'Encumbrance Clearance'
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Under Investigation'

export interface ApprovalRequest {
  id: string
  approvalId: string // e.g. "APR-410"
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
}

