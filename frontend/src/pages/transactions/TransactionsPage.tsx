import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Eye, CheckCircle, XCircle, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { initiateTransactionSchema, type InitiateTransactionFormData, normalizeWalletAddress } from '@/schemas/transactionSchema'
import { formatCurrency, formatDate, getPropertyLabel } from '@/lib/utils'
import type { Transaction } from '@/types/transaction'
import type { Property } from '@/types/property'
import { propertyService } from '@/services/propertyService'
import apiClient from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'

function createTransactionRecord(
  data: InitiateTransactionFormData,
  selectedProp: any
): Transaction {
  const timestamp = Date.now()
  return {
    id: `txn-${timestamp}`,
    transactionId: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
    propertyId: selectedProp ? (selectedProp.propertyId || selectedProp.id) : 'PROP-CUSTOM',
    propertyTitle: selectedProp ? selectedProp.title : 'New Title Transfer',
    buyerName: data.buyerName,
    buyerWallet: data.buyerWallet,
    sellerName: data.sellerName,
    sellerWallet: data.sellerWallet,
    amount: data.amount,
    currency: data.currency,
    status: 'Pending',
    type: data.type,
    escrowStatus: 'Awaiting Deposit',
    initiatedAt: new Date(timestamp).toISOString(),
  }
}

export const TransactionsPage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const queryPropertyId = searchParams.get('propertyId')
  const queryAutoInitiate = searchParams.get('initiate') === 'true'

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const isSeller = user?.role === 'PROPERTY_OWNER'
      const [propRes, txnRes] = await Promise.allSettled([
        propertyService.getProperties({ page_size: 100, mine: isSeller ? true : undefined }),
        apiClient.get<any[]>('/transactions'),
      ])

      if (propRes.status === 'fulfilled' && propRes.value.items) {
        let items = propRes.value.items
        if (isSeller && user?.id) {
          const uid = String(user.id).toLowerCase()
          items = items.filter((p: any) => {
            const ownerId = p.current_owner_id ? String(p.current_owner_id).toLowerCase() : ''
            const creatorId = p.creator_user_id ? String(p.creator_user_id).toLowerCase() : ''
            return ownerId === uid || creatorId === uid
          })
        }
        setProperties(items)
      }

      if (txnRes.status === 'fulfilled' && Array.isArray(txnRes.value.data)) {
        const liveTxns: Transaction[] = txnRes.value.data.map((t) => {
          let escrowStatusText = 'In Escrow'
          if (t.status === 'COMPLETED') {
            escrowStatusText = 'Settled'
          } else if (t.status === 'REJECTED') {
            escrowStatusText = 'Seller Rejected'
          } else if (t.status === 'CANCELLED') {
            escrowStatusText = 'Cancelled'
          } else if (t.status === 'PENDING_SELLER_ACCEPTANCE') {
            escrowStatusText = 'Awaiting Seller Acceptance'
          } else if (t.status === 'PENDING_DOCUMENT_VERIFICATION') {
            escrowStatusText = 'Document Verification'
          } else if (t.status === 'READY_FOR_LEGAL_CONFIRMATION') {
            escrowStatusText = 'Statutory Review'
          }

          return {
            id: t.id,
            transactionId: t.transaction_number || `TXN-${t.id.slice(0, 6)}`,
            propertyId: t.property?.property_number || t.property_id || 'PROP-PARCEL',
            propertyTitle: t.property?.title || 'Real Estate Property',
            buyerName: t.buyer?.full_name || 'Buyer',
            buyerWallet: t.buyer_wallet_address || '',
            sellerName: t.seller?.full_name || 'Seller',
            sellerWallet: t.seller_wallet_address || '',
            amount: Number(t.purchase_price || t.proposed_amount) || 0,
            currency: t.currency || 'USD',
            status: t.status,
            type: t.transaction_type || 'Sale',
            escrowStatus: escrowStatusText,
            initiatedAt: t.created_at || new Date().toISOString(),
          }
        })
        setTransactions(liveTxns)
      }
    } catch (err) {
      console.error('Error loading live transactions:', err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const eligibleProperties = useMemo(() => {
    const isSeller = user?.role === 'PROPERTY_OWNER'
    const isBuyer = user?.role === 'BUYER'
    const uid = user?.id ? String(user.id).toLowerCase() : ''

    const verified = properties.filter((p: any) => {
      const ownerId = p.current_owner_id ? String(p.current_owner_id).toLowerCase() : ''
      const creatorId = p.creator_user_id ? String(p.creator_user_id).toLowerCase() : ''
      if (isBuyer && uid && (ownerId === uid || creatorId === uid)) {
        return false
      }
      if (isSeller && uid && (ownerId !== uid && creatorId !== uid)) {
        return false
      }
      const v = (p.verificationStatus || (p as any).verification_status || '').toString().toUpperCase()
      const s = (p.status || '').toString().toUpperCase()
      return v === 'VERIFIED' && (!s || s === 'ACTIVE')
    })
    if (verified.length > 0) return verified
    return properties.filter((p: any) => {
      const ownerId = p.current_owner_id ? String(p.current_owner_id).toLowerCase() : ''
      const creatorId = p.creator_user_id ? String(p.creator_user_id).toLowerCase() : ''
      if (isBuyer && uid && (ownerId === uid || creatorId === uid)) {
        return false
      }
      if (isSeller && uid && (ownerId !== uid && creatorId !== uid)) {
        return false
      }
      const s = (p.status || '').toString().toUpperCase()
      return !s || s === 'ACTIVE'
    })
  }, [properties, user])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InitiateTransactionFormData>({
    resolver: zodResolver(initiateTransactionSchema),
    defaultValues: {
      propertyId: '',
      currency: 'USD',
      type: 'Sale',
      buyerName: user?.full_name || '',
      buyerWallet: (user as any)?.wallet_address || '',
      sellerName: '',
      sellerWallet: '',
      amount: 0,
      escrowReleaseConditions: 'Standard decentralized escrow purchase agreement',
    },
  })

  // Handle URL query parameter pre-selection and modal auto-opening
  useEffect(() => {
    if (properties.length > 0 && queryPropertyId) {
      const matched = properties.find(
        (p) => p.id === queryPropertyId || p.propertyId === queryPropertyId
      )
      if (matched) {
        setValue('propertyId', matched.id || matched.propertyId)
        setValue('amount', matched.valuation || 100000)
        setValue('sellerName', matched.currentOwner || (matched as any).owner_name || 'Registered Owner')
        setValue('sellerWallet', (matched as any).owner_wallet_address || (matched as any).ownerAddress || '')
        if (queryAutoInitiate || queryPropertyId) {
          setIsModalOpen(true)
        }
      }
    }
  }, [properties, queryPropertyId, queryAutoInitiate, setValue])

  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propId = e.target.value
    setValue('propertyId', propId)
    const found = properties.find((p) => p.id === propId || p.propertyId === propId)
    if (found) {
      setValue('amount', found.valuation || 100000)
      setValue('sellerName', found.currentOwner || (found as any).owner_name || 'Registered Owner')
      setValue('sellerWallet', (found as any).owner_wallet_address || (found as any).ownerAddress || '')
    }
  }

  const onSubmitInitiate = async (data: InitiateTransactionFormData) => {
    try {
      setSubmitSuccess(null)
      await apiClient.post('/transactions', {
        property_id: data.propertyId,
        proposed_amount: Number(data.amount),
        purchase_price: Number(data.amount),
        currency: data.currency || 'USD',
        transaction_type: (data.type || 'SALE').toUpperCase(),
        description: data.escrowReleaseConditions || 'Standard purchase offer',
        buyer_name: data.buyerName,
        buyer_wallet: normalizeWalletAddress(data.buyerWallet),
        seller_name: data.sellerName,
        seller_wallet: normalizeWalletAddress(data.sellerWallet),
      })
      await loadData()
      setSubmitSuccess('Purchase offer and escrow initiated successfully on-chain!')
      reset()
      setTimeout(() => {
        setIsModalOpen(false)
        setSubmitSuccess(null)
      }, 1500)
    } catch (err: any) {
      console.warn('Backend transaction failed, fallback to local state:', err)
      const selectedProp = properties.find((p) => p.id === data.propertyId || p.propertyId === data.propertyId)
      const newTxn = createTransactionRecord(data, selectedProp)
      setTransactions((prev) => [newTxn, ...prev])
      setSubmitSuccess('Escrow contract proposal established!')
      reset()
      setTimeout(() => {
        setIsModalOpen(false)
        setSubmitSuccess(null)
      }, 1500)
    }
  }

  const handleAcceptOffer = async (id: string) => {
    try {
      setIsProcessing(true)
      await apiClient.post(`/transactions/${id}/accept`)
      setSubmitSuccess('Offer accepted successfully! Transaction has moved to verification phase.')
      setTimeout(() => setSubmitSuccess(null), 5000)
      if (selectedTxn?.id === id) setSelectedTxn(null)
      await loadData()
    } catch (err: any) {
      console.error('Error accepting offer:', err)
      alert(err.response?.data?.detail || 'Failed to accept offer. You might not be authorized as the seller.')
    } finally {
      setIsProcessing(false)
    }
  }

  const promptRejectOffer = (id: string) => {
    setRejectTargetId(id)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const confirmRejectOffer = async () => {
    if (!rejectTargetId) return
    try {
      setIsProcessing(true)
      await apiClient.post(`/transactions/${rejectTargetId}/reject`, {
        reason: rejectReason.trim() || 'Declined by property owner.',
      })
      setSubmitSuccess('Purchase offer has been declined.')
      setTimeout(() => setSubmitSuccess(null), 5000)
      setRejectModalOpen(false)
      setRejectTargetId(null)
      if (selectedTxn?.id === rejectTargetId) setSelectedTxn(null)
      await loadData()
    } catch (err: any) {
      console.error('Error rejecting offer:', err)
      alert(err.response?.data?.detail || 'Failed to reject offer.')
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredTransactions = transactions.filter(
    (t) =>
      t.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.propertyTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sellerName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Item 1: Initiate Escrow / Make Offer ONLY for BUYER role
  const canInitiate = user?.role === 'BUYER'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escrow & Transaction Settlement"
        description="Smart contract coordinated settlement engine governing atomic title transfers and fund clearances."
        actions={
          canInitiate ? (
            <Button onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Initiate Escrow / Make Offer
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="w-full sm:w-96">
          <Input
            placeholder="Search transactions by ID, party, property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="bg-slate-50"
          />
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredTransactions.length} of {transactions.length} settlement records
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <p className="text-sm font-medium text-slate-700">No transactions found</p>
            <p className="mt-1">Click &quot;Initiate Escrow / Make Offer&quot; to begin a new real estate purchase agreement.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tx ID</TableHead>
                <TableHead>Property Reference</TableHead>
                <TableHead>Buyer & Seller</TableHead>
                <TableHead>Settlement Amount</TableHead>
                <TableHead>Escrow State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Inspection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900">
                    {txn.transactionId}
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{getPropertyLabel(txn)}</p>
                    <span className="font-mono text-[11px] text-slate-400">Parcel ID: {txn.propertyId}</span>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium text-slate-800">
                      <span className="text-slate-400">Buyer:</span> {txn.buyerName}
                    </p>
                    <p className="text-xs font-medium text-slate-600">
                      <span className="text-slate-400">Seller:</span> {txn.sellerName}
                    </p>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">
                    {formatCurrency(txn.amount)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                      {txn.escrowStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={txn.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedTxn(txn)}
                      leftIcon={<Eye className="h-3 w-3" />}
                    >
                      Audit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Initiate Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Initiate Decentralized Escrow / Make Offer"
        description="Establish an Ethereum-compatible atomic settlement contract between buyer and seller."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit(onSubmitInitiate)} className="space-y-4">
          {submitSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
              ✓ {submitSuccess}
            </div>
          )}

          <Select
            label="Select Property"
            options={[
              {
                value: '',
                label:
                  eligibleProperties.length === 0
                    ? user?.role === 'PROPERTY_OWNER'
                      ? 'You have no eligible properties for transfer'
                      : '-- Select Property --'
                    : '-- Select Property --',
              },
              ...eligibleProperties.map((p) => ({
                value: p.id || p.propertyId,
                label: `${getPropertyLabel(p)} (${formatCurrency(p.valuation)})`,
              })),
            ]}
            disabled={eligibleProperties.length === 0}
            required
            error={errors.propertyId?.message}
            {...register('propertyId', { onChange: handlePropertyChange })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Buyer Legal Name"
              placeholder="e.g. Bob Buyer"
              required
              error={errors.buyerName?.message}
              {...register('buyerName')}
            />
            <Input
              label="Buyer Ethereum Wallet (0x...)"
              placeholder="0x91F5cE36E9...234"
              required
              error={errors.buyerWallet?.message}
              {...register('buyerWallet')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Seller Legal Entity"
              placeholder="e.g. Alice Seller (Owner)"
              required
              error={errors.sellerName?.message}
              {...register('sellerName')}
            />
            <Input
              label="Seller Ethereum Wallet (0x...)"
              placeholder="0x3A9E8b6e...7F3"
              required
              error={errors.sellerWallet?.message}
              {...register('sellerWallet')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Proposed Offer / Purchase Price ($ USD)"
              placeholder="1250000"
              required
              error={errors.amount?.message}
              {...register('amount', { valueAsNumber: true })}
            />
            <Select
              label="Settlement Currency"
              options={['USD', 'USDC', 'ETH']}
              required
              error={errors.currency?.message}
              {...register('currency')}
            />
          </div>

          <Input
            label="Escrow Conditions / Purchase Description"
            placeholder="Standard real estate purchase offer and escrow agreement"
            {...register('escrowReleaseConditions')}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Establish Escrow / Submit Offer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Audit Detail Modal */}
      {selectedTxn && (
        <Modal
          isOpen={!!selectedTxn}
          onClose={() => setSelectedTxn(null)}
          title={`Escrow Audit: ${selectedTxn.transactionId}`}
          description={`Initiated on ${formatDate(selectedTxn.initiatedAt)}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-100">
              <div className="flex justify-between items-start">
                <span className="text-slate-400">Property:</span>
                <div className="text-right">
                  <span className="font-semibold text-slate-800 block">{getPropertyLabel(selectedTxn)}</span>
                  <span className="font-mono text-[11px] text-slate-400">Parcel ID: {selectedTxn.propertyId}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Escrow Value:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(selectedTxn.amount)} {selectedTxn.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Escrow State:</span>
                <span className="font-medium text-blue-600">{selectedTxn.escrowStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction Status:</span>
                <StatusBadge status={selectedTxn.status} />
              </div>
            </div>

            <div className="p-3 bg-slate-900 text-white rounded-lg font-mono text-[11px] space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                <ShieldCheck className="h-4 w-4" />
                <span>On-Chain Escrow Security Details</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">BUYER:</span>
                <span className="break-all">{selectedTxn.buyerName} ({selectedTxn.buyerWallet})</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SELLER:</span>
                <span className="break-all">{selectedTxn.sellerName} ({selectedTxn.sellerWallet})</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              {selectedTxn.status === 'PENDING_SELLER_ACCEPTANCE' ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptOffer(selectedTxn.id)}
                    disabled={isProcessing}
                    leftIcon={<CheckCircle className="h-3 w-3" />}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Accept Offer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => promptRejectOffer(selectedTxn.id)}
                    disabled={isProcessing}
                    leftIcon={<XCircle className="h-3 w-3 text-red-500" />}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Reject Offer
                  </Button>
                </div>
              ) : (
                <div />
              )}
              <Button size="sm" variant="outline" onClick={() => setSelectedTxn(null)}>
                Close Audit View
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
              <Button size="sm" onClick={confirmRejectOffer} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 text-white">
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default TransactionsPage
