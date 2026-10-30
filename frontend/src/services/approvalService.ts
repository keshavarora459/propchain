import apiClient from '@/lib/axios'
import type { ApprovalRequest } from '@/types/approval'

export const approvalService = {
  async getApprovals(): Promise<ApprovalRequest[]> {
    const response = await apiClient.get<ApprovalRequest[]>('/approvals')
    return response.data
  },

  async decideApproval(id: string, decision: 'Approved' | 'Rejected', notes?: string): Promise<ApprovalRequest> {
    const response = await apiClient.post<ApprovalRequest>(`/approvals/${id}/decision`, { decision, notes })
    return response.data
  },
}

