import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Eye, CheckCircle, XCircle, ShieldCheck, Coins, Building2, AlertCircle, Lock } from 'lucide-react'
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
import { formatCurrency, formatDate, getPropertyLabel, getPropertyTokenomics, formatOfferAllocation, cn } from '@/lib/utils'
import { HashDisplay } from '@/components/common/HashDisplay'
import { TransactionLifecycleTimeline } from '@/components/common/TransactionLifecycleTimeline'
import type { Transaction } from '@/types/transaction'
import type { Property } from '@/types/property'
import { propertyService } from '@/services/propertyService'
import apiClient from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'

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
  const [submitError, setSubmitError] = useState<string | null>(null)
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

          const propNum = t.property_number || t.property?.property_number || (t.property_id ? `PROP-${String(t.property_id).slice(0, 8).toUpperCase()}` : 'PROP-PARCEL')
          const propTitle = t.property_title || t.property?.title || propNum || 'Property'
          const bName = t.buyer_name || t.buyer?.full_name || 'Buyer'
          const sName = t.seller_name || t.seller?.full_name || 'Seller'
          const bWallet = t.buyer_wallet_address || (t.buyer?.wallets?.[0]?.wallet_address) || ''
          const sWallet = t.seller_wallet_address || (t.seller?.wallets?.[0]?.wallet_address) || ''

          return {
            id: t.id,
            transactionId: t.transaction_number || `TXN-${t.id.slice(0, 6)}`,
            propertyId: propNum,
            property_id: t.property_id,
            propertyTitle: propTitle,
            buyerName: bName,
            buyerWallet: bWallet,
            sellerName: sName,
            sellerWallet: sWallet,
            amount: Number(t.purchase_price || t.proposed_amount) || 0,
            currency: t.currency || 'USD',
            status: t.status,
            type: t.transaction_type || 'Sale',
            purchase_mode: t.purchase_mode,
            token_quantity: t.token_quantity,
            token_symbol: t.token_symbol,
            ownership_percentage: t.ownership_percentage,
            property_is_tokenized: t.property_is_tokenized,
            escrowStatus: escrowStatusText,
            initiatedAt: t.created_at || new Date().toISOString(),
            blockchainTxHash: t.blockchain_tx_hash,
            blockchain_tx_hash: t.blockchain_tx_hash,
            blockNumber: t.blockchain_block_number,
            blockchain_block_number: t.blockchain_block_number,
            blockchain_error: t.blockchain_error,
          }
        })
        setTransactions(liveTxns)
      }
    } catch (err) {
      console.error('Error loading live transactions:', err)
    }
  }, [user?.role, user?.id])

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
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InitiateTransactionFormData>({
    resolver: zodResolver(initiateTransactionSchema),
    defaultValues: {
      propertyId: '',
      purchaseMode: 'ENTIRE_PROPERTY',
      tokenQuantity: undefined,
      currency: 'USD',
      type: 'Sale',
      buyerName: user?.full_name || '',
      buyerWallet: (user as any)?.wallet_address || 'Platform Custody Wallet',
      sellerName: '',
      sellerWallet: '',
      amount: 0,
      escrowReleaseConditions: 'Standard decentralized escrow purchase agreement',
    },
  })

  const watchedPropertyId = watch('propertyId')
  const watchedPurchaseMode = watch('purchaseMode')
  const watchedTokenQuantity = watch('tokenQuantity')
  const watchedAmount = watch('amount')

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === watchedPropertyId || p.propertyId === watchedPropertyId) || null,
    [properties, watchedPropertyId]
  )
  const selectedTokenomics = useMemo(
    () => getPropertyTokenomics(selectedProperty),
    [selectedProperty]
  )

  const applyPropertyDefaults = useCallback(
    (prop: Property) => {
      const tok = getPropertyTokenomics(prop)
      setValue('propertyId', prop.id || prop.propertyId)
      setValue('sellerName', prop.currentOwner || (prop as any).owner_name || 'Registered Owner')
      setValue(
        'sellerWallet',
        (prop as any).owner_wallet_address || (prop as any).ownerAddress || 'Platform Custody Wallet'
      )
      if (!getValues('buyerName') && user?.full_name) {
        setValue('buyerName', user.full_name)
      }
      if (!getValues('buyerWallet')) {
        setValue('buyerWallet', (user as any)?.wallet_address || 'Platform Custody Wallet')
      }

      if (tok.isTokenized && tok.availableTokens > 0) {
        const initialQty = Math.min(tok.minTokensPerBuyer, tok.availableTokens)
        const calcAmount = Math.round(initialQty * tok.tokenPrice * 100) / 100
        const pct = ((initialQty / tok.totalTokens) * 100).toFixed(2)
        setValue('purchaseMode', 'TOKEN_PURCHASE')
        setValue('tokenQuantity', initialQty)
        setValue('amount', calcAmount)
        setValue('type', 'Token Purchase')
        setValue(
          'escrowReleaseConditions',
          `Fractional token acquisition of ${initialQty.toLocaleString()} ${tok.tokenSymbol} (${pct}% ownership stake)`
        )
      } else {
        setValue('purchaseMode', 'ENTIRE_PROPERTY')
        setValue('tokenQuantity', undefined)
        setValue('amount', prop.valuation || 100000)
        setValue('type', 'Sale')
        setValue(
          'escrowReleaseConditions',
          'Full 100% property title conveyance escrow purchase agreement'
        )
      }
      setSubmitError(null)
    },
    [setValue, getValues, user]
  )

  // Handle URL query parameter pre-selection and modal auto-opening
  useEffect(() => {
    if (properties.length > 0 && queryPropertyId) {
      const matched = properties.find(
        (p) => p.id === queryPropertyId || p.propertyId === queryPropertyId
      )
      if (matched) {
        applyPropertyDefaults(matched)
        if (queryAutoInitiate || queryPropertyId) {
          setIsModalOpen(true)
        }
      }
    }
  }, [properties, queryPropertyId, queryAutoInitiate, applyPropertyDefaults])

  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propId = e.target.value
    setValue('propertyId', propId)
    setSubmitError(null)
    const found = properties.find((p) => p.id === propId || p.propertyId === propId)
    if (found) {
      applyPropertyDefaults(found)
    }
  }

  const handleModeSwitch = (mode: 'TOKEN_PURCHASE' | 'ENTIRE_PROPERTY') => {
    if (!selectedProperty) return
    if (mode === 'TOKEN_PURCHASE') {
      if (!selectedTokenomics.isTokenized || selectedTokenomics.availableTokens <= 0) return
      const initialQty = Math.min(selectedTokenomics.minTokensPerBuyer, selectedTokenomics.availableTokens)
      const calcAmount = Math.round(initialQty * selectedTokenomics.tokenPrice * 100) / 100
      const pct = ((initialQty / selectedTokenomics.totalTokens) * 100).toFixed(2)
      setValue('purchaseMode', 'TOKEN_PURCHASE')
      setValue('tokenQuantity', initialQty)
      setValue('amount', calcAmount)
      setValue('type', 'Token Purchase')
      setValue(
        'escrowReleaseConditions',
        `Fractional token acquisition of ${initialQty.toLocaleString()} ${selectedTokenomics.tokenSymbol} (${pct}% ownership stake)`
      )
    } else {
      if (selectedTokenomics.isTokenized && selectedTokenomics.tokensSold > 0) return
      setValue('purchaseMode', 'ENTIRE_PROPERTY')
      setValue('tokenQuantity', selectedTokenomics.isTokenized ? selectedTokenomics.totalTokens : undefined)
      setValue('amount', selectedProperty.valuation || 100000)
      setValue('type', 'Sale')
      setValue(
        'escrowReleaseConditions',
        'Full 100% property title conveyance escrow purchase agreement'
      )
    }
    setSubmitError(null)
  }

  const handleTokenQuantityUpdate = (rawQty: number) => {
    if (!selectedTokenomics.isTokenized) return
    const qty = Number.isFinite(rawQty) ? Math.max(0, Math.floor(rawQty)) : 0
    setValue('tokenQuantity', qty)
    if (qty > 0) {
      const calcAmount = Math.round(qty * selectedTokenomics.tokenPrice * 100) / 100
      const pct = ((qty / selectedTokenomics.totalTokens) * 100).toFixed(2)
      setValue('amount', calcAmount)
      setValue(
        'escrowReleaseConditions',
        `Fractional token acquisition of ${qty.toLocaleString()} ${selectedTokenomics.tokenSymbol} (${pct}% ownership stake)`
      )
    }
    setSubmitError(null)
  }

  const tokenPresetQuantities = useMemo(() => {
    if (!selectedTokenomics.isTokenized || selectedTokenomics.availableTokens <= 0) return []
    const avail = selectedTokenomics.availableTokens
    const min = selectedTokenomics.minTokensPerBuyer
    const total = selectedTokenomics.totalTokens
    const raw = [
      { label: `Min (${Math.min(min, avail).toLocaleString()})`, qty: Math.min(min, avail) },
      { label: '10', qty: 10 },
      { label: '50', qty: 50 },
      { label: '1%', qty: Math.max(min, Math.round(total * 0.01)) },
      { label: '5%', qty: Math.max(min, Math.round(total * 0.05)) },
      { label: `Max (${avail.toLocaleString()})`, qty: avail },
    ]
    const seen = new Set<number>()
    return raw.filter((item) => {
      if (item.qty < 1 || item.qty > avail) return false
      if (item.qty < min && item.qty !== avail) return false
      if (seen.has(item.qty)) return false
      seen.add(item.qty)
      return true
    })
  }, [selectedTokenomics])

  const openInitiateModal = () => {
    setSubmitError(null)
    setSubmitSuccess(null)
    if (!getValues('propertyId') && eligibleProperties.length > 0) {
      applyPropertyDefaults(eligibleProperties[0])
    }
    setIsModalOpen(true)
  }

  const onSubmitInitiate = async (data: InitiateTransactionFormData) => {
    setSubmitError(null)
    setSubmitSuccess(null)

    const isTokenMode = selectedTokenomics.isTokenized && data.purchaseMode === 'TOKEN_PURCHASE'
    const qty = Number(data.tokenQuantity || 0)

    if (data.purchaseMode === 'TOKEN_PURCHASE' && !selectedTokenomics.isTokenized) {
      setSubmitError('Fractional token offers are only available on tokenized properties.')
      return
    }
    if (isTokenMode) {
      if (!Number.isInteger(qty) || qty < 1) {
        setSubmitError('Please enter a whole number of at least 1 token to bid on.')
        return
      }
      if (qty > selectedTokenomics.availableTokens) {
        setSubmitError(
          `Requested ${qty.toLocaleString()} ${selectedTokenomics.tokenSymbol} exceeds available supply (${selectedTokenomics.availableTokens.toLocaleString()} left).`
        )
        return
      }
      if (qty < selectedTokenomics.minTokensPerBuyer && qty < selectedTokenomics.availableTokens) {
        setSubmitError(
          `Minimum token purchase is ${selectedTokenomics.minTokensPerBuyer} ${selectedTokenomics.tokenSymbol} tokens.`
        )
        return
      }
    }

    try {
      await apiClient.post('/transactions', {
        property_id: data.propertyId,
        purchase_mode: isTokenMode ? 'TOKEN_PURCHASE' : 'ENTIRE_PROPERTY',
        token_quantity: isTokenMode ? qty : undefined,
        proposed_amount: Number(data.amount),
        purchase_price: Number(data.amount),
        currency: data.currency || 'USD',
        transaction_type: isTokenMode ? 'TOKEN_PURCHASE' : (data.type || 'SALE').toUpperCase().replace(/\s+/g, '_'),
        description: data.escrowReleaseConditions || 'Standard purchase offer',
        buyer_name: data.buyerName,
        buyer_wallet: normalizeWalletAddress(data.buyerWallet),
        seller_name: data.sellerName,
        seller_wallet: normalizeWalletAddress(data.sellerWallet),
      })
      await loadData()
      setSubmitSuccess(
        isTokenMode
          ? `Offer for ${qty.toLocaleString()} ${selectedTokenomics.tokenSymbol} tokens submitted to escrow!`
          : 'Entire-property purchase offer and escrow initiated successfully!'
      )
      setTimeout(() => {
        reset()
        setIsModalOpen(false)
        setSubmitSuccess(null)
        setSubmitError(null)
      }, 1500)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Unable to submit offer. Please review your offer details.'
      setSubmitError(typeof msg === 'string' ? msg : JSON.stringify(msg))
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
  const isSoldOut =
    selectedTokenomics.isTokenized &&
    selectedTokenomics.availableTokens <= 0 &&
    selectedTokenomics.tokensSold > 0
  const entireLocked =
    selectedTokenomics.isTokenized && selectedTokenomics.tokensSold > 0
  const fractionalDisabled =
    !selectedTokenomics.isTokenized || selectedTokenomics.availableTokens <= 0
  const qtyNum = Number(watchedTokenQuantity || 0)
  const calculatedPct =
    selectedTokenomics.isTokenized && selectedTokenomics.totalTokens > 0 && qtyNum > 0
      ? (qtyNum / selectedTokenomics.totalTokens) * 100
      : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escrow & Transaction Settlement"
        description="Smart contract coordinated settlement engine governing atomic title transfers and fund clearances."
        actions={
          canInitiate ? (
            <Button onClick={openInitiateModal} leftIcon={<Plus className="h-4 w-4" />}>
              Initiate Escrow / Make Offer
            </Button>
          ) : undefined
        }
      />

      {submitSuccess && !isModalOpen && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
          <span>✓ {submitSuccess}</span>
          <button
            type="button"
            onClick={() => setSubmitSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-3"
          >
            ×
          </button>
        </div>
      )}

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
              {filteredTransactions.map((txn) => {
                const allocation = formatOfferAllocation(txn)
                return (
                <TableRow key={txn.id}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900">
                    <div>
                      <span className="text-blue-600 block">{txn.transactionId}</span>
                      {txn.status === 'COMPLETED' && (txn.blockNumber || txn.blockchain_block_number) && (
                        <span className="text-[10px] text-emerald-600 block font-mono">
                          Block #{txn.blockNumber || txn.blockchain_block_number}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{getPropertyLabel(txn)}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[11px] text-slate-400">Parcel ID: {txn.propertyId}</span>
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border',
                          allocation.isFractional
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        )}
                      >
                        {allocation.badgeLabel}
                      </span>
                    </div>
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
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                        {txn.escrowStatus}
                      </span>
                      {txn.status === 'COMPLETED' && (txn.blockchainTxHash || txn.blockchain_tx_hash) && (
                        <div>
                          <HashDisplay
                            value={txn.blockchainTxHash || txn.blockchain_tx_hash}
                            explorerLink
                            className="text-[10px] py-0 px-1 border-0 bg-emerald-50 text-emerald-800"
                          />
                        </div>
                      )}
                    </div>
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
              )})}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Initiate Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSubmitError(null)
        }}
        title="Initiate Decentralized Escrow / Make Offer"
        description="Establish an Ethereum-compatible atomic settlement contract between buyer and seller."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit(onSubmitInitiate)} className="space-y-4">
          {submitSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
              ✓ {submitSuccess}
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
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
              ...eligibleProperties.map((p) => {
                const tok = getPropertyTokenomics(p)
                return {
                  value: p.id || p.propertyId,
                  label: tok.isTokenized
                    ? `${getPropertyLabel(p)} • Tokenized (${formatCurrency(tok.tokenPrice)}/${tok.tokenSymbol}, ${tok.availableTokens.toLocaleString()} left)`
                    : `${getPropertyLabel(p)} • Entire Property (${formatCurrency(p.valuation)})`,
                }
              }),
            ]}
            disabled={eligibleProperties.length === 0}
            required
            error={errors.propertyId?.message}
            {...register('propertyId', { onChange: handlePropertyChange })}
          />

          {/* Offering Structure & Adaptive Purchase Scope Selector */}
          {selectedProperty && (
            <div className="space-y-3">
              {/* Offering Structure Banner */}
              <div
                className={cn(
                  'rounded-xl border p-3.5 text-xs',
                  selectedTokenomics.isTokenized
                    ? 'bg-purple-50/70 border-purple-200'
                    : 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {selectedTokenomics.isTokenized ? (
                      <Coins className="h-4 w-4 text-purple-600 shrink-0" />
                    ) : (
                      <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-900">
                      {selectedTokenomics.isTokenized
                        ? `Tokenized Fractional Property (${selectedTokenomics.tokenSymbol})`
                        : 'Entire Property Listing (Single Deed Parcel)'}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                      selectedTokenomics.isTokenized
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300'
                    )}
                  >
                    {selectedTokenomics.isTokenized ? 'Fractional + Buyout Eligible' : '100% Deed Only'}
                  </span>
                </div>

                {selectedTokenomics.isTokenized ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-purple-200/70 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Token Price</span>
                      <strong className="font-mono text-slate-900">{formatCurrency(selectedTokenomics.tokenPrice)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Available Supply</span>
                      <strong className="font-mono text-purple-800">
                        {selectedTokenomics.availableTokens.toLocaleString()} / {selectedTokenomics.totalTokens.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Min Purchase</span>
                      <strong className="font-mono text-slate-900">
                        {selectedTokenomics.minTokensPerBuyer.toLocaleString()} {selectedTokenomics.tokenSymbol}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Full Valuation</span>
                      <strong className="font-mono text-slate-900">
                        {formatCurrency(selectedProperty.valuation)}
                        {selectedTokenomics.projectedApy ? ` • ${selectedTokenomics.projectedApy}% APY` : ''}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    This asset is listed for whole-parcel conveyance ({formatCurrency(selectedProperty.valuation)} valuation). Fractional token purchases are disabled for non-tokenized properties.
                  </p>
                )}
              </div>

              {/* Purchase Mode Selector (2 Cards) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Offer Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={fractionalDisabled}
                    onClick={() => handleModeSwitch('TOKEN_PURCHASE')}
                    className={cn(
                      'text-left p-3 rounded-xl border transition-all flex items-start gap-2.5',
                      watchedPurchaseMode === 'TOKEN_PURCHASE' && !fractionalDisabled
                        ? 'border-purple-600 bg-purple-50/80 ring-1 ring-purple-600 shadow-xs'
                        : fractionalDisabled
                        ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-70'
                        : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/30 cursor-pointer'
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {fractionalDisabled ? (
                        <Lock className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Coins className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>Buy Fractional Tokens</span>
                        {selectedTokenomics.isTokenized && watchedPurchaseMode === 'TOKEN_PURCHASE' && !fractionalDisabled && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">Selected</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {!selectedTokenomics.isTokenized
                          ? 'Unavailable — property is not tokenized'
                          : selectedTokenomics.availableTokens <= 0
                          ? 'All tokens sold or reserved in active escrow'
                          : `Acquire ${selectedTokenomics.minTokensPerBuyer}+ ${selectedTokenomics.tokenSymbol} fractional shares`}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={entireLocked}
                    onClick={() => handleModeSwitch('ENTIRE_PROPERTY')}
                    className={cn(
                      'text-left p-3 rounded-xl border transition-all flex items-start gap-2.5',
                      watchedPurchaseMode === 'ENTIRE_PROPERTY' && !entireLocked
                        ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600 shadow-xs'
                        : entireLocked
                        ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-70'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {entireLocked ? (
                        <Lock className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Building2 className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>Buy Entire Property (100%)</span>
                        {watchedPurchaseMode === 'ENTIRE_PROPERTY' && !entireLocked && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">Selected</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {entireLocked
                          ? `Locked — ${selectedTokenomics.tokensSold.toLocaleString()} tokens already settled to buyers`
                          : selectedTokenomics.isTokenized
                          ? `100% buyout of all ${selectedTokenomics.totalTokens.toLocaleString()} ${selectedTokenomics.tokenSymbol} & deed`
                          : `Whole-parcel title deed acquisition (${formatCurrency(selectedProperty.valuation)})`}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Fractional Token Quantity Calculator */}
              {selectedTokenomics.isTokenized && watchedPurchaseMode === 'TOKEN_PURCHASE' && selectedTokenomics.availableTokens > 0 && (
                <div className="rounded-xl border border-purple-200 bg-white p-3.5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    <div>
                      <Input
                        type="number"
                        label={`Token Quantity (${selectedTokenomics.tokenSymbol})`}
                        min={1}
                        max={selectedTokenomics.availableTokens}
                        value={watchedTokenQuantity ?? ''}
                        onChange={(e) => handleTokenQuantityUpdate(Number(e.target.value))}
                        placeholder={`Min ${Math.min(selectedTokenomics.minTokensPerBuyer, selectedTokenomics.availableTokens)}`}
                        required
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        {selectedTokenomics.availableTokens < selectedTokenomics.minTokensPerBuyer
                          ? `Remnant lot available: up to ${selectedTokenomics.availableTokens.toLocaleString()} tokens`
                          : `Enter ${selectedTokenomics.minTokensPerBuyer.toLocaleString()} to ${selectedTokenomics.availableTokens.toLocaleString()} tokens`}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-100 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ownership Stake:</span>
                        <span className="font-mono font-bold text-purple-800">
                          {calculatedPct > 0 && calculatedPct < 0.01 ? calculatedPct.toFixed(4) : calculatedPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Listed Value @ {formatCurrency(selectedTokenomics.tokenPrice)}:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {formatCurrency(qtyNum * selectedTokenomics.tokenPrice)}
                        </span>
                      </div>
                      {selectedTokenomics.projectedApy && qtyNum > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Est. Annual Yield ({selectedTokenomics.projectedApy}%):</span>
                          <span className="font-mono font-medium text-emerald-700">
                            {formatCurrency((qtyNum * selectedTokenomics.tokenPrice * selectedTokenomics.projectedApy) / 100)}/yr
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {tokenPresetQuantities.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500 mr-1">Quick select:</span>
                      {tokenPresetQuantities.map((preset) => (
                        <button
                          key={preset.qty}
                          type="button"
                          onClick={() => handleTokenQuantityUpdate(preset.qty)}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer',
                            qtyNum === preset.qty
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-purple-50 hover:border-purple-300'
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isSoldOut && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                  All fractional tokens on this property have already been allocated. Select another property to make an offer.
                </div>
              )}
            </div>
          )}

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
              step="0.01"
              label={
                selectedTokenomics.isTokenized && watchedPurchaseMode === 'TOKEN_PURCHASE'
                  ? `Total Offer Price for ${qtyNum > 0 ? qtyNum.toLocaleString() : '0'} ${selectedTokenomics.tokenSymbol} ($ USD)`
                  : 'Proposed Offer / Purchase Price ($ USD)'
              }
              placeholder="1250000"
              required
              helperText={
                selectedProperty
                  ? selectedTokenomics.isTokenized && watchedPurchaseMode === 'TOKEN_PURCHASE' && qtyNum > 0
                    ? `Implied offer: ${formatCurrency((Number(watchedAmount) || 0) / qtyNum)} / ${selectedTokenomics.tokenSymbol} (listed ${formatCurrency(selectedTokenomics.tokenPrice)})`
                    : `Listed property valuation: ${formatCurrency(selectedProperty.valuation)}`
                  : undefined
              }
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false)
                setSubmitError(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSoldOut}>
              {selectedTokenomics.isTokenized && watchedPurchaseMode === 'TOKEN_PURCHASE'
                ? 'Submit Fractional Token Offer'
                : 'Establish Escrow / Submit Offer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Audit Detail Modal */}
      {selectedTxn && (
        <Modal
          isOpen={!!selectedTxn}
          onClose={() => setSelectedTxn(null)}
          title={`Escrow Audit: ${selectedTxn.transactionId}${
            selectedTxn.status === 'COMPLETED'
              ? ` — Block #${selectedTxn.blockNumber || selectedTxn.blockchain_block_number || ''}`
              : ''
          }`}
          description={`Initiated on ${formatDate(selectedTxn.initiatedAt)}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Unified 6-Stage Conveyance Timeline */}
            <TransactionLifecycleTimeline
              status={selectedTxn.status}
              blockchainError={selectedTxn.blockchain_error}
              blockchainBlockNumber={selectedTxn.blockNumber || selectedTxn.blockchain_block_number}
              blockchainTxHash={selectedTxn.blockchainTxHash || selectedTxn.blockchain_tx_hash}
            />

            <div className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-100">
              <div className="flex justify-between items-start">
                <span className="text-slate-400">Property:</span>
                <div className="text-right">
                  <span className="font-semibold text-slate-800 block">{getPropertyLabel(selectedTxn)}</span>
                  <span className="font-mono text-[11px] text-slate-400">Parcel ID: {selectedTxn.propertyId}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Allocation Scope:</span>
                <span className="font-semibold text-slate-800">
                  {formatOfferAllocation(selectedTxn).detailLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Escrow Value:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(selectedTxn.amount)} {selectedTxn.currency}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Settlement State:</span>
                {selectedTxn.status === 'COMPLETED' ? (
                  <div className="text-right">
                    <span className="font-mono text-emerald-600 font-semibold block text-[11px]">
                      Concluded in Block #{selectedTxn.blockNumber || selectedTxn.blockchain_block_number}
                    </span>
                    {(selectedTxn.blockchainTxHash || selectedTxn.blockchain_tx_hash) && (
                      <HashDisplay
                        value={selectedTxn.blockchainTxHash || selectedTxn.blockchain_tx_hash}
                        explorerLink
                        className="text-[10px] p-0 border-0 bg-transparent text-emerald-800"
                      />
                    )}
                  </div>
                ) : (
                  <span className="font-medium text-blue-600">{selectedTxn.escrowStatus}</span>
                )}
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
                <span className="text-slate-400 block text-[10px]">BUYER (Counterparty):</span>
                <span className="break-all font-semibold text-white">{selectedTxn.buyerName}</span>
                {selectedTxn.buyerWallet && (
                  <span className="text-slate-400 block text-[10px] break-all">{selectedTxn.buyerWallet}</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">SELLER (Counterparty):</span>
                <span className="break-all font-semibold text-white">{selectedTxn.sellerName}</span>
                {selectedTxn.sellerWallet && (
                  <span className="text-slate-400 block text-[10px] break-all">{selectedTxn.sellerWallet}</span>
                )}
              </div>
              {selectedTxn.status === 'COMPLETED' && (selectedTxn.blockchainTxHash || selectedTxn.blockchain_tx_hash) && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-emerald-400 block text-[10px] font-semibold">ON-CHAIN PROOF OF CONVEYANCE:</span>
                  <div className="text-[10px] mt-0.5">
                    <span>Block: #{selectedTxn.blockNumber || selectedTxn.blockchain_block_number}</span>
                    <HashDisplay
                      value={selectedTxn.blockchainTxHash || selectedTxn.blockchain_tx_hash}
                      explorerLink
                      className="bg-transparent border-0 p-0 text-emerald-300 text-[10px]"
                    />
                  </div>
                </div>
              )}
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
