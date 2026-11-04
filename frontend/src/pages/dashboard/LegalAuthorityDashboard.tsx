import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Scale,
  BookOpen,
  CheckCircle2,
  Building2,
  CheckSquare,
  ArrowLeftRight,
  RefreshCw,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { formatCurrency, formatDate, getPropertyLabel } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'
import { CONTRACT_ADDRESSES } from '@/contracts/contractConfig'
import { HashDisplay } from '@/components/common/HashDisplay'
import { TransactionLifecycleTimeline } from '@/components/common/TransactionLifecycleTimeline'

interface LegalConfirmationFormData {
  deed_number: string
  book_number: string
  volume_number: string
  jurisdiction: string
  registration_date: string
  comments: string
}

export const LegalAuthorityDashboard: React.FC = () => {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'documents' | 'history' | 'completed'>('overview')
  const [dashboardData, setDashboardData] = useState<any>(null)

  // Legal confirmation modal state
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [retryingTxnId, setRetryingTxnId] = useState<string | null>(null)

  const handleRetryConveyance = async (txnId: string) => {
    setRetryingTxnId(txnId)
    setFeedbackMessage(null)
    try {
      const res = await apiClient.post(`/transactions/${txnId}/retry-conveyance`)
      const updatedTxn = res.data
      const blkStr = updatedTxn.blockchain_block_number ? ` in block #${updatedTxn.blockchain_block_number}` : ''
      const txStr = updatedTxn.blockchain_tx_hash ? ` (Tx: ${updatedTxn.blockchain_tx_hash})` : ''
      setFeedbackMessage({
        type: 'success',
        text: `✓ Conveyance transfer succeeded on blockchain${blkStr}${txStr}! Status is now COMPLETED.`,
      })
      await loadLegalData()
    } catch (err: any) {
      console.error('Statutory retry failed:', err)
      const errorMsg = err.response?.data?.message || err.response?.data?.detail || err.message
      setFeedbackMessage({
        type: 'error',
        text: `Retry failed: ${errorMsg}`,
      })
      await loadLegalData()
    } finally {
      setRetryingTxnId(null)
    }
  }

  const [formData, setFormData] = useState<LegalConfirmationFormData>({
    deed_number: '',
    book_number: '',
    volume_number: '',
    jurisdiction: 'Metropolitan Land Registry District 1',
    registration_date: new Date().toISOString().split('T')[0],
    comments: 'Statutory legal title registration validated by Registrar.',
  })

  const loadLegalData = async () => {
    try {
      const res = await apiClient.get('/analytics/dashboard')
      if (res.data) {
        setDashboardData(res.data)
      }
    } catch (err) {
      console.error('Failed to load legal authority dashboard:', err)
    }
  }

  useEffect(() => {
    loadLegalData()
  }, [])

  const legalMetrics = dashboardData?.legal_metrics || {}
  const pendingRequests = legalMetrics?.pending_requests || []
  const confirmationHistory = legalMetrics?.confirmation_history || []

  const handleOpenConfirmModal = (txn: any) => {
    setSelectedTxn(txn)
    setFormData({
      deed_number: `DEED-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      book_number: `BK-${Math.floor(10 + Math.random() * 90)}`,
      volume_number: `VOL-${Math.floor(1 + Math.random() * 20)}`,
      jurisdiction: 'Metropolitan Land Registry District 1',
      registration_date: new Date().toISOString().split('T')[0],
      comments: `Statutory deed confirmation recorded for ${txn.property_title || 'property'}.`,
    })
    setIsConfirmModalOpen(true)
  }

  const handleSubmitLegalConfirmation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTxn) return

    setIsSubmitting(true)
    try {
      const compositeRef = `${formData.deed_number} (Book ${formData.book_number}, Vol ${formData.volume_number})`
      const res = await apiClient.post(`/transactions/${selectedTxn.id}/legal-confirm`, {
        registration_reference: compositeRef,
        registry_jurisdiction: formData.jurisdiction,
        registration_date: formData.registration_date,
        deed_number: formData.deed_number,
        book_number: formData.book_number,
        volume_number: formData.volume_number,
        comments: formData.comments,
      })

      const confirmedData = res.data
      const blkStr = confirmedData.blockchain_block_number ? ` in block #${confirmedData.blockchain_block_number}` : ''
      const txStr = confirmedData.blockchain_tx_hash ? ` (Tx: ${confirmedData.blockchain_tx_hash})` : ''
      setFeedbackMessage({
        type: 'success',
        text: `✓ Statutory deed ${formData.deed_number} confirmed! Ownership transferred on blockchain${blkStr}${txStr}.`,
      })
      setIsConfirmModalOpen(false)
      setSelectedTxn(null)
      await loadLegalData()
      setTimeout(() => setFeedbackMessage(null), 8000)
    } catch (err: any) {
      console.error('Statutory legal confirmation failed:', err)
      const errorMsg = err.response?.data?.message || err.response?.data?.detail || err.message
      setFeedbackMessage({
        type: 'error',
        text: errorMsg,
      })
      await loadLegalData()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Government Land Registry: ${user?.full_name || 'Chief Registrar'}`}
        description="Statutory legal title registration, deed and book/volume recordation, and official governmental conveyance confirmation."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadLegalData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh Records
            </Button>
            <Link to="/ownership">
              <Button size="sm" leftIcon={<BookOpen className="h-4 w-4" />}>
                Statutory Ownership Registry
              </Button>
            </Link>
          </div>
        }
      />

      {feedbackMessage && (
        <div
          className={`rounded-xl border p-3.5 text-xs flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
              : 'border-red-500/30 bg-red-950/20 text-red-300'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Statutory Authority Notice */}
      <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3.5 text-xs text-purple-900 flex items-center justify-between">
        <p>
          <strong className="font-semibold">Statutory Authority:</strong> Only Legal Authority accounts can execute legal registration confirmation. Admin and third-party roles cannot bypass this constitutional requirement.
        </p>
        <span className="hidden sm:inline-block font-mono text-[11px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-medium">
          Official Registrar
        </span>
      </div>

      {/* Key Metric Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Legal Registrations"
          value={pendingRequests.length.toString()}
          subtitle={pendingRequests.length > 0 ? 'Requires deed entry' : 'Queue cleared'}
          icon={<Scale className="h-5 w-5" />}
          iconBg="bg-purple-50 text-purple-600"
        />
        <StatCard
          title="Completed Registrations"
          value={(legalMetrics?.completed_registrations_count ?? confirmationHistory.length).toString()}
          subtitle="Formally confirmed in state land archive"
          icon={<CheckSquare className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Active Conveyance Pipeline"
          value={(dashboardData?.active_transactions ?? 0).toString()}
          subtitle="Atomic smart contract settlements"
          icon={<ArrowLeftRight className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Platform Properties"
          value={(dashboardData?.total_properties ?? 0).toString()}
          subtitle={`${dashboardData?.verified_properties ?? 0} Verified properties`}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-slate-100 text-slate-700"
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Legal Overview' },
          { id: 'pending', label: 'Pending Legal Registrations', count: pendingRequests.length },
          { id: 'documents', label: 'Verified Property Documents' },
          { id: 'history', label: 'Legal Confirmation History', count: confirmationHistory.length },
          { id: 'completed', label: 'Completed Registrations' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transactions Awaiting Statutory Land Registry Confirmation</CardTitle>
                  <CardDescription>
                    These transactions have passed seller acceptance and verifier document audits. Legal confirmation with Book & Volume entry executes final on-chain title re-assignment.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveTab('pending')} className="text-xs">
                  View Queue ({pendingRequests.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pendingRequests.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No pending legal registration requests</p>
                  <p className="mt-1">All verified conveyance transactions have been confirmed.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction #</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Consideration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Statutory Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((txn: any) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono text-xs font-semibold text-blue-600">{txn.transaction_number}</TableCell>
                        <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(txn)}</TableCell>
                        <TableCell className="text-xs text-slate-600">{txn.buyer_name}</TableCell>
                        <TableCell className="text-xs text-slate-600">{txn.seller_name}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900">{formatCurrency(txn.purchase_price)}</TableCell>
                        <TableCell>
                          <StatusBadge status={txn.status} />
                          {txn.blockchain_error && (
                            <p className="text-[10px] text-rose-600 font-mono mt-0.5 line-clamp-1" title={txn.blockchain_error}>
                              {txn.blockchain_error}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {txn.status === 'LEGALLY_REGISTERED' ? (
                            <Button
                              size="sm"
                              isLoading={retryingTxnId === txn.id}
                              disabled={retryingTxnId === txn.id}
                              onClick={() => handleRetryConveyance(txn.id)}
                              className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8 px-3"
                            >
                              Retry blockchain transfer
                            </Button>
                          ) : txn.status === 'COMPLETED' ? (
                            <div className="text-right text-[11px] font-mono text-emerald-700">
                              <span className="font-semibold block">Completed ✓</span>
                              <span>Block #{txn.blockchain_block_number ?? 'N/A'}</span>
                              {txn.blockchain_tx_hash && (
                                <HashDisplay value={txn.blockchain_tx_hash} explorerLink className="text-[10px] p-0 border-0 bg-transparent" />
                              )}
                            </div>
                          ) : txn.status === 'READY_FOR_LEGAL_CONFIRMATION' ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenConfirmModal(txn)}
                              className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8 px-3"
                            >
                              Enter Deed & Confirm
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Awaiting Verifier Approval</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Pending Legal Registrations */}
      {activeTab === 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle>Legal Registration Request Queue</CardTitle>
            <CardDescription>Record Deed Number, Book, and Volume to finalize conveyance under statutory law.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {pendingRequests.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No requests in queue</p>
                <p className="mt-1">When transactions reach the legal confirmation milestone, they will appear here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Escrow Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Official Recordation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((txn: any) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">{txn.transaction_number}</TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(txn)}</TableCell>
                      <TableCell className="text-xs text-slate-600">{txn.buyer_name}</TableCell>
                      <TableCell className="text-xs text-slate-600">{txn.seller_name}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{formatCurrency(txn.purchase_price)}</TableCell>
                      <TableCell>
                        <StatusBadge status={txn.status} />
                        {txn.blockchain_error && (
                          <p className="text-[10px] text-rose-600 font-mono mt-0.5 line-clamp-1" title={txn.blockchain_error}>
                            {txn.blockchain_error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.status === 'LEGALLY_REGISTERED' ? (
                          <Button
                            size="sm"
                            isLoading={retryingTxnId === txn.id}
                            disabled={retryingTxnId === txn.id}
                            onClick={() => handleRetryConveyance(txn.id)}
                            className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8 px-3"
                          >
                            Retry blockchain transfer
                          </Button>
                        ) : txn.status === 'COMPLETED' ? (
                          <div className="text-right text-[11px] font-mono text-emerald-700">
                            <span className="font-semibold block">Completed ✓</span>
                            <span>Block #{txn.blockchain_block_number ?? 'N/A'}</span>
                            {txn.blockchain_tx_hash && (
                              <HashDisplay value={txn.blockchain_tx_hash} explorerLink className="text-[10px] p-0 border-0 bg-transparent" />
                            )}
                          </div>
                        ) : txn.status === 'READY_FOR_LEGAL_CONFIRMATION' ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenConfirmModal(txn)}
                            className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8 px-3"
                          >
                            Record Deed & Confirm
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Awaiting Verifier Approval</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Verified Property Documents */}
      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Verified Property Documents Archive</CardTitle>
                <CardDescription>Deeds, surveys, and encumbrance certificates certified by title verifiers ready for official registry recordation.</CardDescription>
              </div>
              <Link to="/documents">
                <Button size="sm" variant="outline" className="text-xs">
                  Full Document Explorer
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed">
              All title documents are checked against SHA-256 cryptographic digests before reaching the Legal Authority. Each deed record includes the exact chain of title from initial grant to current conveyance.
            </p>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Document Cryptographic Protocol</span>
                <span className="font-mono font-semibold text-slate-900">SHA-256 & Argon2id Encrypted Storage</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Legal Standard Compliance</span>
                <span className="font-semibold text-purple-700">Uniform Real Property Electronic Recording Act (URPERA)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Legal Confirmation History */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Legal Registration Records</CardTitle>
            <CardDescription>Official government entries recording deed reference, jurisdiction, and timestamps.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {confirmationHistory.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <p>No legal confirmations recorded yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statutory Reference</TableHead>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recorded At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmationHistory.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold text-purple-700">{item.registration_reference}</TableCell>
                      <TableCell className="text-xs text-slate-800">{item.registry_jurisdiction}</TableCell>
                      <TableCell className="text-xs text-slate-600">{item.registration_date}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(item.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Completed Registrations */}
      {activeTab === 'completed' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Formally Concluded Land Registrations</CardTitle>
                <CardDescription>Deeds permanently transferred on consensus blockchain with state legal validity.</CardDescription>
              </div>
              <Link to="/ownership">
                <Button size="sm" variant="outline" className="text-xs">
                  Inspect Ownership Ledger
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-6 text-center text-xs text-slate-500">
            <p>Every legally confirmed transaction permanently transfers smart contract ownership on EVM contract {CONTRACT_ADDRESSES.PROPERTY_REGISTRY}.</p>
            <Link to="/ownership" className="inline-block mt-3">
              <Button size="sm">Go to Ownership Registry</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Deed, Book & Volume Entry Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Official Statutory Deed Registration"
        >
          <form onSubmit={handleSubmitLegalConfirmation} className="space-y-4 text-xs">
            <TransactionLifecycleTimeline
              status={selectedTxn?.status}
              blockchainError={selectedTxn?.blockchain_error}
              blockchainBlockNumber={selectedTxn?.blockchain_block_number}
              blockchainTxHash={selectedTxn?.blockchain_tx_hash}
              compact
            />

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900">
              <p className="font-semibold text-xs">Conveyance Transaction:</p>
              <p className="font-mono text-[11px] mt-0.5">
                {selectedTxn?.transaction_number} — {getPropertyLabel(selectedTxn)}
              </p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                Buyer: <strong>{selectedTxn?.buyer_name}</strong> | Seller: <strong>{selectedTxn?.seller_name}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Deed Number *
                </label>
                <Input
                  required
                  value={formData.deed_number}
                  onChange={(e) => setFormData({ ...formData, deed_number: e.target.value })}
                  placeholder="DEED-2026-XXXX"
                  className="bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Book Number *
                </label>
                <Input
                  required
                  value={formData.book_number}
                  onChange={(e) => setFormData({ ...formData, book_number: e.target.value })}
                  placeholder="BK-42"
                  className="bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Volume Number *
                </label>
                <Input
                  required
                  value={formData.volume_number}
                  onChange={(e) => setFormData({ ...formData, volume_number: e.target.value })}
                  placeholder="VOL-108"
                  className="bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Land Registry Jurisdiction *
              </label>
              <Input
                required
                value={formData.jurisdiction}
                onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                placeholder="Metropolitan Land Registry District"
                className="bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Official Registration Date *
              </label>
              <Input
                type="date"
                required
                value={formData.registration_date}
                onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                className="bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Official Registrar Endorsement Notes
              </label>
              <textarea
                rows={2}
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-500 text-white"
              >
                {isSubmitting ? 'Confirming & Executing On-Chain...' : 'Confirm Statutory Registration'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
export default LegalAuthorityDashboard
