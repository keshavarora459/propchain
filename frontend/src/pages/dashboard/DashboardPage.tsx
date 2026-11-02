import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle,
  ArrowLeftRight,
  ShieldAlert,
  ArrowRight,
  Eye,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { RegistrationTrendChart } from '@/components/charts/RegistrationTrendChart'
import { TransactionActivityChart } from '@/components/charts/TransactionActivityChart'
import { formatCurrency, formatDate, truncateHash } from '@/lib/utils'
import apiClient from '@/lib/axios'

interface DashboardData {
  total_properties: number
  verified_properties: number
  pending_properties: number
  total_valuation_usd: number
  active_transactions: number
  completed_transactions: number
  pending_approvals: number
  fraud_alerts: number
  pending_purchase_requests?: Array<{
    id: string
    transaction_number: string
    property_id: string
    property_number?: string
    property_title: string
    buyer_id: string
    buyer_name: string
    buyer_email?: string
    seller_id: string
    seller_name: string
    purchase_price: number
    proposed_amount?: number
    currency?: string
    status: string
    created_at?: string
  }>
  recent_transactions: Array<{
    id: string
    transaction_number: string
    property_id: string
    property_title: string
    purchase_price: number
    status: string
    blockchain_tx_hash?: string
    created_at?: string
  }>
  registration_trends?: Array<{
    month: string
    registered: number
    verified: number
  }>
  transaction_activity?: Array<{
    month: string
    volumeUSD: number
    count: number
  }>
}

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData>({
    total_properties: 0,
    verified_properties: 0,
    pending_properties: 0,
    total_valuation_usd: 0,
    active_transactions: 0,
    completed_transactions: 0,
    pending_approvals: 0,
    fraud_alerts: 0,
    pending_purchase_requests: [],
    recent_transactions: [],
  })

  const [selectedDetail, setSelectedDetail] = useState<any | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      const res = await apiClient.get<DashboardData>('/analytics/dashboard')
      if (res.data) setData(res.data)
    } catch (err) {
      console.error('Failed to load live dashboard telemetry:', err)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleAccept = async (id: string) => {
    try {
      setIsProcessing(true)
      await apiClient.post(`/transactions/${id}/accept`)
      setNotice('Buyer purchase offer accepted successfully! Transaction has moved to verification phase.')
      setTimeout(() => setNotice(null), 5000)
      if (selectedDetail?.id === id) setSelectedDetail(null)
      await loadDashboard()
    } catch (err: any) {
      console.error('Error accepting offer:', err)
      alert(err.response?.data?.detail || 'Failed to accept purchase offer')
    } finally {
      setIsProcessing(false)
    }
  }

  const promptReject = (id: string) => {
    setRejectTargetId(id)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const confirmReject = async () => {
    if (!rejectTargetId) return
    try {
      setIsProcessing(true)
      await apiClient.post(`/transactions/${rejectTargetId}/reject`, {
        reason: rejectReason.trim() || 'Purchase terms declined by seller',
      })
      setNotice('Purchase offer rejected. Transaction status updated.')
      setTimeout(() => setNotice(null), 5000)
      setRejectModalOpen(false)
      if (selectedDetail?.id === rejectTargetId) setSelectedDetail(null)
      await loadDashboard()
    } catch (err: any) {
      console.error('Error rejecting offer:', err)
      alert(err.response?.data?.detail || 'Failed to reject purchase offer')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description="Live summary of your properties, buying and selling deals, and document approvals."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-mono font-medium text-slate-700 border border-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Hardhat EVM (31337)
            </span>
          </div>
        }
      />

      {notice && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Live System Indicator Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-center justify-between">
        <p>
          <strong className="font-semibold">Live System:</strong> Connected to local blockchain and database services. All data is updated in real time.
        </p>
        <span className="hidden sm:inline-block font-mono text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
          System Active
        </span>
      </div>

      {/* Incoming Purchase Requests Section for Sellers */}
      {data.pending_purchase_requests && data.pending_purchase_requests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 bg-amber-100/50 border-b border-amber-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-600 animate-pulse" />
                <CardTitle className="text-slate-900 font-bold text-base">Incoming Property Purchase Requests</CardTitle>
              </div>
              <CardDescription className="text-slate-600">
                Buyers have initiated purchase proposals for your registered properties. Review and accept to begin decentralized escrow.
              </CardDescription>
            </div>
            <Link
              to="/approvals"
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              Approvals Page <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Purchase Amount</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pending_purchase_requests.map((req) => (
                  <TableRow key={req.id} className="hover:bg-amber-50/80 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-slate-900">
                      {req.transaction_number}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-900">{req.property_title}</p>
                      <span className="font-mono text-[11px] text-slate-400">{req.property_number || req.property_id}</span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-800 text-xs">{req.buyer_name}</p>
                      {req.buyer_email && <span className="text-[11px] text-slate-400">{req.buyer_email}</span>}
                    </TableCell>
                    <TableCell className="font-bold text-emerald-700 text-sm">
                      {formatCurrency(req.purchase_price)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {req.created_at ? formatDate(req.created_at) : 'Today'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="PENDING_SELLER_ACCEPTANCE" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDetail(req)}
                          leftIcon={<Eye className="h-3 w-3" />}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleAccept(req.id)}
                          disabled={isProcessing}
                          leftIcon={<CheckCircle className="h-3 w-3" />}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => promptReject(req.id)}
                          disabled={isProcessing}
                          leftIcon={<XCircle className="h-3 w-3" />}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Key Metric Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Properties"
          value={data.total_properties.toLocaleString()}
          subtitle="All listed properties"
          trend={{ value: `${data.pending_properties} pending verification`, isPositive: true }}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title="Approved Properties"
          value={data.verified_properties.toLocaleString()}
          subtitle="Verified & ready for sale"
          trend={{ value: `${data.verified_properties} verified`, isPositive: true }}
          icon={<CheckCircle className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Ongoing Deals"
          value={data.active_transactions}
          subtitle={`$${(data.total_valuation_usd / 1000000).toFixed(2)}M total registered value`}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Security Warnings"
          value={data.fraud_alerts}
          subtitle="Suspicious cases under review"
          trend={{ value: '0 active threats', isPositive: true }}
          icon={<ShieldAlert className="h-5 w-5" />}
          iconBg="bg-rose-50 text-rose-700"
        />
      </div>

      {/* Primary Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Property Registrations & Approvals</CardTitle>
            <CardDescription>Monthly submitted vs approved properties</CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationTrendChart data={data.registration_trends} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Property Sales Value</CardTitle>
            <CardDescription>Total value of completed deals ($ Millions USD)</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionActivityChart data={data.transaction_activity} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Recent Transactions & Pending Approvals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Transactions Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Deals & Sales</CardTitle>
                <CardDescription>Latest property purchases and ownership transfers</CardDescription>
              </div>
              <Link
                to="/transactions"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {data.recent_transactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <p className="font-medium text-slate-600">No transactions recorded yet</p>
                  <p className="mt-1">Initiate a deal from the Deals & Escrow tab to begin an on-chain transfer.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tx ID</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tx Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent_transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono text-xs font-semibold text-slate-900">
                          {txn.transaction_number}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-slate-800 truncate max-w-[200px]">
                            {txn.property_title}
                          </p>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {formatCurrency(txn.purchase_price)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={txn.status} />
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-500">
                          {txn.blockchain_tx_hash ? truncateHash(txn.blockchain_tx_hash, 5, 4) : 'Pending'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals & Network Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Requires title registrar signature</CardDescription>
              </div>
              <Link
                to="/approvals"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-4 text-xs text-slate-500">
              {data.pending_approvals === 0 ? (
                <div className="text-center py-6">
                  <p className="font-medium text-slate-700">All Approvals Clear</p>
                  <p className="text-[11px] text-slate-400 mt-1">There are no pending actions requiring review.</p>
                </div>
              ) : (
                <p className="font-semibold text-amber-600">{data.pending_approvals} actions awaiting sign-off</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review Request Modal */}
      {selectedDetail && (
        <Modal
          isOpen={!!selectedDetail}
          onClose={() => setSelectedDetail(null)}
          title={`Purchase Offer: ${selectedDetail.transaction_number}`}
          description={`Initiated by ${selectedDetail.buyer_name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Target Parcel:</span>
                <span className="font-semibold text-slate-800">{selectedDetail.property_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buyer:</span>
                <span className="font-medium text-slate-800">{selectedDetail.buyer_name} ({selectedDetail.buyer_email || ''})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Offered Purchase Price:</span>
                <span className="font-bold text-emerald-700 text-sm">{formatCurrency(selectedDetail.purchase_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <StatusBadge status={selectedDetail.status} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleAccept(selectedDetail.id)}
                disabled={isProcessing}
                leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
              >
                Accept Offer
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => promptReject(selectedDetail.id)}
                disabled={isProcessing}
                leftIcon={<XCircle className="h-3.5 w-3.5" />}
              >
                Reject Offer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
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

export default DashboardPage
