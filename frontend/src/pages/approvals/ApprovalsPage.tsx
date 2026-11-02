import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Eye } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'
import type { ApprovalRequest } from '@/types/approval'
import apiClient from '@/lib/axios'

export const ApprovalsPage: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)

  useEffect(() => {
    apiClient
      .get<any[]>('/approvals')
      .then((res) => {
        if (Array.isArray(res.data)) {
          const liveApprovals: ApprovalRequest[] = res.data.map((a) => ({
            id: a.id,
            approvalId: `APR-${a.id.slice(0, 6).toUpperCase()}`,
            category: a.approval_type ? a.approval_type.replace(/_/g, ' ') : 'CONVEYANCE_APPROVAL',
            propertyId: a.transaction?.property?.property_number || 'PROP-PARCEL',
            propertyTitle: a.transaction?.property?.title || 'Real Estate Parcel',
            submittedBy: a.action_by_role || 'Stakeholder',
            submittedAt: a.created_at || new Date().toISOString(),
            priority: 'High',
            status: a.status === 'PENDING' ? 'Pending' : (a.status === 'APPROVED' ? 'Approved' : 'Rejected'),
            assignedApprover: a.approver_user_id || 'Assigned Authority',
            description: a.notes || 'Stakeholder clearance workflow.',
          }))
          setApprovals(liveApprovals)
        }
      })
      .catch((err) => console.error('Failed to load live approvals:', err))
  }, [])

  const pendingCount = approvals.filter((a) => a.status === 'Pending' || a.status === 'Under Investigation').length
  const approvedCount = approvals.filter((a) => a.status === 'Approved').length
  const rejectedCount = approvals.filter((a) => a.status === 'Rejected').length

  const filteredApprovals = approvals.filter((a) => {
    if (activeTab === 'pending') return a.status === 'Pending' || a.status === 'Under Investigation'
    if (activeTab === 'approved') return a.status === 'Approved'
    if (activeTab === 'rejected') return a.status === 'Rejected'
    return true
  })

  const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
    setApprovals(
      approvals.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              decidedAt: new Date().toISOString(),
              decisionNotes: `Manual verification finalized (${status}).`,
            }
          : a
      )
    )
    if (selectedApproval?.id === id) {
      setSelectedApproval(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar Approvals & Governance"
        description="Formal review workflows for parcel minting, deed re-assignment, and encumbrance release."
      />

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
            <p className="text-sm font-medium text-slate-700">No approvals in this queue</p>
            <p className="mt-1">All stakeholder approvals are currently up to date.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Approval ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Property Parcel</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Priority</TableHead>
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
                  <TableCell className="text-xs font-medium text-slate-800">
                    {apr.category}
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{apr.propertyTitle}</p>
                    <span className="text-[11px] font-mono text-slate-400">{apr.propertyId}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    <p>{apr.submittedBy}</p>
                    <span className="text-[11px] text-slate-400">{formatDate(apr.submittedAt)}</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                        apr.priority === 'Critical'
                          ? 'bg-rose-100 text-rose-700'
                          : apr.priority === 'High'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {apr.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={apr.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedApproval(apr)}
                        leftIcon={<Eye className="h-3 w-3" />}
                      >
                        Audit
                      </Button>
                      {apr.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleAction(apr.id, 'Approved')}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Sign & Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(apr.id, 'Rejected')}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Reject Request"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
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
          title={`Audit Review: ${selectedApproval.approvalId}`}
          description={`Assigned to ${selectedApproval.assignedApprover}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Category</span>
                <span className="font-semibold text-slate-900">{selectedApproval.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Parcel</span>
                <span className="font-medium text-slate-800">
                  {selectedApproval.propertyId} — {selectedApproval.propertyTitle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Priority Level</span>
                <span className="font-semibold text-slate-900">{selectedApproval.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Review Status</span>
                <StatusBadge status={selectedApproval.status} />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                Workflow Action Description
              </span>
              <p className="text-slate-700 mt-1">{selectedApproval.description}</p>
            </div>

            {selectedApproval.decisionNotes && (
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <span className="text-emerald-700 font-bold uppercase tracking-wider text-[10px] block">
                  Official Decision Memo
                </span>
                <p className="text-emerald-900 mt-1">{selectedApproval.decisionNotes}</p>
                <span className="text-[10px] text-emerald-600 block mt-1">
                  Decided at: {formatDate(selectedApproval.decidedAt!)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {selectedApproval.status === 'Pending' ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleAction(selectedApproval.id, 'Approved')}
                    leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                  >
                    Confirm & Sign
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleAction(selectedApproval.id, 'Rejected')}
                    leftIcon={<XCircle className="h-3.5 w-3.5" />}
                  >
                    Reject
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
    </div>
  )
}
export default ApprovalsPage
