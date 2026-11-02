import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Eye, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { ApprovalRequest } from '@/types/approval'
import apiClient from '@/lib/axios'

export const ApprovalsPage: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [targetApprovalId, setTargetApprovalId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const loadApprovals = useCallback(async () => {
    try {
      const res = await apiClient.get<any[]>('/approvals')
      if (Array.isArray(res.data)) {
        const liveApprovals: ApprovalRequest[] = res.data.map((a) => {
          const isSellerAcceptance = a.approval_type === 'SELLER_ACCEPTANCE'
          const categoryLabel = isSellerAcceptance
            ? 'Property Purchase Offer (Seller Acceptance)'
            : a.approval_type ? a.approval_type.replace(/_/g, ' ') : 'CONVEYANCE_APPROVAL'

          return {
            id: a.id,
            approvalId: a.transaction_number || `APR-${(a.id || '').slice(0, 6).toUpperCase()}`,
            category: categoryLabel,
            propertyId: a.property_number || a.property_id || 'PROP-PARCEL',
            propertyTitle: a.property_title || 'Real Estate Parcel',
            submittedBy: a.buyer_name ? `${a.buyer_name} (Buyer)` : (a.action_by_role || 'Buyer / Stakeholder'),
            submittedAt: a.created_at || new Date().toISOString(),
            priority: isSellerAcceptance ? 'Critical' : 'High',
            status: a.status === 'PENDING' ? 'Pending' : (a.status === 'APPROVED' ? 'Approved' : 'Rejected'),
            assignedApprover: a.seller_name ? `${a.seller_name} (Seller)` : (a.approver_user_id || 'Assigned Authority'),
            description: isSellerAcceptance
              ? `Purchase offer of ${formatCurrency(Number(a.proposed_amount) || 0)} initiated by ${a.buyer_name || 'Buyer'} for parcel ${a.property_title || ''}.`
              : (a.comments || 'Stakeholder clearance workflow.'),
            transactionId: a.transaction_id,
            transactionNumber: a.transaction_number,
            buyerName: a.buyer_name,
            buyerEmail: a.buyer_email,
            sellerName: a.seller_name,
            sellerEmail: a.seller_email,
            amount: Number(a.proposed_amount) || 0,
            currency: a.currency || 'USD',
          }
        })
        setApprovals(liveApprovals)
      }
    } catch (err) {
      console.error('Failed to load live approvals:', err)
    }
  }, [])

  useEffect(() => {
    loadApprovals()
  }, [loadApprovals])

  const pendingCount = approvals.filter((a) => a.status === 'Pending' || a.status === 'Under Investigation').length
  const approvedCount = approvals.filter((a) => a.status === 'Approved').length
  const rejectedCount = approvals.filter((a) => a.status === 'Rejected').length

  const filteredApprovals = approvals.filter((a) => {
    if (activeTab === 'pending') return a.status === 'Pending' || a.status === 'Under Investigation'
    if (activeTab === 'approved') return a.status === 'Approved'
    if (activeTab === 'rejected') return a.status === 'Rejected'
    return true
  })

  const handleApprove = async (approval: ApprovalRequest) => {
    try {
      setIsProcessing(true)
      await apiClient.post(`/approvals/${approval.id}/approve`)
      setActionNotice(`Request ${approval.approvalId} approved successfully! Transaction advanced to next workflow stage.`)
      setTimeout(() => setActionNotice(null), 5000)
      if (selectedApproval?.id === approval.id) {
        setSelectedApproval(null)
      }
      await loadApprovals()
    } catch (err: any) {
      console.error('Failed to approve request:', err)
      alert(err.response?.data?.detail || 'Failed to approve request')
    } finally {
      setIsProcessing(false)
    }
  }

  const promptReject = (approvalId: string) => {
    setTargetApprovalId(approvalId)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const confirmReject = async () => {
    if (!targetApprovalId) return
    try {
      setIsProcessing(true)
      await apiClient.post(`/approvals/${targetApprovalId}/reject`, {
        reason: rejectReason.trim() || 'Purchase terms declined by seller/authority',
      })
      setActionNotice(`Request rejected. Transaction status updated.`)
      setTimeout(() => setActionNotice(null), 5000)
      setRejectModalOpen(false)
      if (selectedApproval?.id === targetApprovalId) {
        setSelectedApproval(null)
      }
      await loadApprovals()
    } catch (err: any) {
      console.error('Failed to reject request:', err)
      alert(err.response?.data?.detail || 'Failed to reject request')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals & Purchase Governance"
        description="Formal review workflows for incoming buyer purchase requests, title transfers, and statutory clearances."
      />

      {actionNotice && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'pending', label: 'Pending Review', count: pendingCount },
          { id: 'approved', label: 'Approved Records', count: approvedCount },
          { id: 'rejected', label: 'Rejected', count: rejectedCount },
          { id: 'all', label: 'All Requests', count: approvals.length },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredApprovals.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <p className="text-sm font-medium text-slate-700">No requests in this queue</p>
            <p className="mt-1">All stakeholder approvals and buyer purchase requests are currently up to date.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tx / Approval ID</TableHead>
                <TableHead>Request Type</TableHead>
                <TableHead>Property Parcel</TableHead>
                <TableHead>Buyer / Requester</TableHead>
                <TableHead>Offer Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApprovals.map((apr) => (
                <TableRow key={apr.id}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900">
                    {apr.approvalId}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-900 text-xs block">{apr.category}</span>
                    <span className="text-[10px] text-slate-400">{formatDate(apr.submittedAt)}</span>
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{apr.propertyTitle}</p>
                    <span className="text-[11px] font-mono text-slate-400">{apr.propertyId}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-800">
                    <p className="font-medium">{apr.submittedBy}</p>
                    {apr.buyerEmail && <span className="text-[11px] text-slate-400">{apr.buyerEmail}</span>}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-900">
                    {apr.amount && apr.amount > 0 ? formatCurrency(apr.amount) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={apr.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedApproval(apr)}
                        leftIcon={<Eye className="h-3.5 w-3.5" />}
                      >
                        Review
                      </Button>
                      {apr.status === 'Pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleApprove(apr)}
                            disabled={isProcessing}
                            leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => promptReject(apr.id)}
                            disabled={isProcessing}
                            leftIcon={<XCircle className="h-3.5 w-3.5" />}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Approval Detail Modal */}
      {selectedApproval && (
        <Modal
          isOpen={!!selectedApproval}
          onClose={() => setSelectedApproval(null)}
          title={`Review Request: ${selectedApproval.approvalId}`}
          description={`Assigned to ${selectedApproval.assignedApprover}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Request Category:</span>
                <span className="font-semibold text-slate-900">{selectedApproval.category}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Target Parcel:</span>
                <span className="font-semibold text-slate-900">
                  {selectedApproval.propertyTitle} ({selectedApproval.propertyId})
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Buyer:</span>
                <span className="font-semibold text-slate-900">{selectedApproval.submittedBy}</span>
              </div>
              {selectedApproval.amount && selectedApproval.amount > 0 ? (
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Proposed Purchase Price:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatCurrency(selectedApproval.amount)} {selectedApproval.currency || 'USD'}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <StatusBadge status={selectedApproval.status} />
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                Conveyance Terms & Notes
              </span>
              <p className="text-slate-700 leading-relaxed">{selectedApproval.description}</p>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {selectedApproval.status === 'Pending' ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleApprove(selectedApproval)}
                    disabled={isProcessing}
                    leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                  >
                    Accept Purchase Offer
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => promptReject(selectedApproval.id)}
                    disabled={isProcessing}
                    leftIcon={<XCircle className="h-3.5 w-3.5" />}
                  >
                    Reject Offer
                  </Button>
                </div>
              ) : (
                <div />
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedApproval(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Reason Modal */}
      {rejectModalOpen && (
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title="Reject Purchase Offer"
          description="Provide a reason for declining this property purchase agreement proposal."
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Decline Reason:
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Price offer below expectation, terms not agreed..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={confirmReject} disabled={isProcessing}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default ApprovalsPage
