import apiClient from '@/lib/axios'
import type { ApprovalRequest } from '@/types/approval'

export const approvalService = {
  async getApprovals(): Promise<ApprovalRequest[]> {
    try {
      const response = await apiClient.get<any[]>('/approvals')
      return response.data.map((a: any) => ({
        id: a.id,
        approvalId: `APR-${a.id.slice(0, 6).toUpperCase()}`,
        category: a.approval_type === 'SELLER_ACCEPTANCE'
          ? 'Title Transfer'
          : a.approval_type === 'DOCUMENT_VERIFICATION'
          ? 'Document Audit'
          : 'Property Registration',
        propertyId: a.transaction_id,
        propertyTitle: 'Conveyance Deed',
        submittedBy: 'Stakeholder Registry',
        submittedAt: a.created_at,
        assignedApprover: a.approver_role,
        status: a.status === 'APPROVED' ? 'Approved' : a.status === 'REJECTED' ? 'Rejected' : 'Pending',
        priority: 'High',
        description: a.comments || `Pending ${a.approval_type} review`,
        decidedAt: a.actioned_at,
        decisionNotes: a.rejection_reason || a.comments,
      }))
    } catch {
      return []
    }
  },

  async getPendingApprovals(): Promise<any[]> {
    const response = await apiClient.get<any[]>('/approvals/pending')
    return response.data
  },
}

export default approvalService
