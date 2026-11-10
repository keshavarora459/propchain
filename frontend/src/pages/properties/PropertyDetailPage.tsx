import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  MapPin,
  FileText,
  ShieldCheck,
  Cpu,
  ArrowLeft,
  ExternalLink,
  Loader2,
  AlertCircle,
  Trash2,
  Coins,
  Building2,
  Lock,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { HashDisplay } from '@/components/common/HashDisplay'
import { PropertyEmblem } from '@/components/common/PropertyEmblem'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import {
  truncateHash,
  formatCurrency,
  formatDate,
  getPropertyLabel,
  getPropertyTokenomics,
  cn,
} from '@/lib/utils'
import { propertyService } from '@/services/propertyService'
import type { Property } from '@/types/property'
import apiClient from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'

export const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [property, setProperty] = useState<Property | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'transfer' | 'documents'>('details')
  const [ownershipRecords, setOwnershipRecords] = useState<any[]>([])
  const [conveyanceCount, setConveyanceCount] = useState<number>(1)

  // Direct Make Offer modal states
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false)
  const [directOfferMode, setDirectOfferMode] = useState<'TOKEN_PURCHASE' | 'ENTIRE_PROPERTY'>('ENTIRE_PROPERTY')
  const [offerTokenQuantity, setOfferTokenQuantity] = useState<number>(1)
  const [offerAmount, setOfferAmount] = useState<number>(0)
  const [offerNotes, setOfferNotes] = useState('Standard real estate conveyance escrow purchase agreement')
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false)
  const [offerSuccessMessage, setOfferSuccessMessage] = useState<string | null>(null)
  const [offerErrorMessage, setOfferErrorMessage] = useState<string | null>(null)

  const tokenomics = useMemo(() => getPropertyTokenomics(property), [property])

  const directPresetQuantities = useMemo(() => {
    if (!tokenomics.isTokenized || tokenomics.availableTokens <= 0) return []
    const avail = tokenomics.availableTokens
    const min = tokenomics.minTokensPerBuyer
    const total = tokenomics.totalTokens
    const raw = [
      { label: `Min (${Math.min(min, avail).toLocaleString()})`, qty: Math.min(min, avail) },
      { label: '10', qty: 10 },
      { label: '50', qty: 50 },
      { label: '1%', qty: Math.max(min, Math.round(total * 0.01)) },
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
  }, [tokenomics])

  useEffect(() => {
    if (!id) return
    setIsLoading(true)

    propertyService
      .getPropertyById(id)
      .then((data) => {
        if (data) {
          setProperty(data)
          const tok = getPropertyTokenomics(data)
          if (tok.isTokenized && tok.availableTokens > 0) {
            const initQty = Math.min(tok.minTokensPerBuyer, tok.availableTokens)
            const calcAmt = Math.round(initQty * tok.tokenPrice * 100) / 100
            const pct = ((initQty / tok.totalTokens) * 100).toFixed(2)
            setDirectOfferMode('TOKEN_PURCHASE')
            setOfferTokenQuantity(initQty)
            setOfferAmount(calcAmt)
            setOfferNotes(`Fractional token acquisition of ${initQty.toLocaleString()} ${tok.tokenSymbol} (${pct}% ownership stake)`)
          } else {
            setDirectOfferMode('ENTIRE_PROPERTY')
            setOfferTokenQuantity(tok.isTokenized ? tok.totalTokens : 1)
            setOfferAmount(Number(data.valuation || 0))
            setOfferNotes('Full 100% property title conveyance escrow purchase agreement')
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load property details:', err)
        setProperty(null)
      })
      .finally(() => {
        setIsLoading(false)
      })

    // Fetch attached documents for this property
    apiClient
      .get<any[]>(`/properties/${id}/documents`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          setDocuments(res.data)
        }
      })
      .catch((err) => {
        console.warn('Could not load property documents from backend:', err)
      })

    // Fetch complete conveyance records
    apiClient
      .get<any>(`/properties/${id}/ownership-history`)
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : (res.data?.items && Array.isArray(res.data.items) ? res.data.items : [])
        setOwnershipRecords(items)
        setConveyanceCount(Math.max(1, items.length))
      })
      .catch(() => {
        setOwnershipRecords([])
        setConveyanceCount(1)
      })
  }, [id])

  const openDirectOfferModal = () => {
    setOfferErrorMessage(null)
    setOfferSuccessMessage(null)
    if (tokenomics.isTokenized && tokenomics.availableTokens > 0) {
      const initQty = Math.min(tokenomics.minTokensPerBuyer, tokenomics.availableTokens)
      const calcAmt = Math.round(initQty * tokenomics.tokenPrice * 100) / 100
      const pct = ((initQty / tokenomics.totalTokens) * 100).toFixed(2)
      setDirectOfferMode('TOKEN_PURCHASE')
      setOfferTokenQuantity(initQty)
      setOfferAmount(calcAmt)
      setOfferNotes(`Fractional token acquisition of ${initQty.toLocaleString()} ${tokenomics.tokenSymbol} (${pct}% ownership stake)`)
    } else if (property) {
      setDirectOfferMode('ENTIRE_PROPERTY')
      setOfferTokenQuantity(tokenomics.isTokenized ? tokenomics.totalTokens : 1)
      setOfferAmount(Number(property.valuation || 0))
      setOfferNotes('Full 100% property title conveyance escrow purchase agreement')
    }
    setIsOfferModalOpen(true)
  }

  const switchDirectOfferMode = (mode: 'TOKEN_PURCHASE' | 'ENTIRE_PROPERTY') => {
    if (!property) return
    setOfferErrorMessage(null)
    if (mode === 'TOKEN_PURCHASE') {
      if (!tokenomics.isTokenized || tokenomics.availableTokens <= 0) return
      const initQty = Math.min(tokenomics.minTokensPerBuyer, tokenomics.availableTokens)
      const calcAmt = Math.round(initQty * tokenomics.tokenPrice * 100) / 100
      const pct = ((initQty / tokenomics.totalTokens) * 100).toFixed(2)
      setDirectOfferMode('TOKEN_PURCHASE')
      setOfferTokenQuantity(initQty)
      setOfferAmount(calcAmt)
      setOfferNotes(`Fractional token acquisition of ${initQty.toLocaleString()} ${tokenomics.tokenSymbol} (${pct}% ownership stake)`)
    } else {
      if (tokenomics.isTokenized && tokenomics.tokensSold > 0) return
      setDirectOfferMode('ENTIRE_PROPERTY')
      setOfferTokenQuantity(tokenomics.isTokenized ? tokenomics.totalTokens : 1)
      setOfferAmount(Number(property.valuation || 0))
      setOfferNotes('Full 100% property title conveyance escrow purchase agreement')
    }
  }

  const updateDirectTokenQuantity = (rawQty: number) => {
    if (!tokenomics.isTokenized) return
    const qty = Number.isFinite(rawQty) ? Math.max(0, Math.floor(rawQty)) : 0
    setOfferTokenQuantity(qty)
    setOfferErrorMessage(null)
    if (qty > 0) {
      const calcAmt = Math.round(qty * tokenomics.tokenPrice * 100) / 100
      const pct = ((qty / tokenomics.totalTokens) * 100).toFixed(2)
      setOfferAmount(calcAmt)
      setOfferNotes(`Fractional token acquisition of ${qty.toLocaleString()} ${tokenomics.tokenSymbol} (${pct}% ownership stake)`)
    }
  }

  const [verifyNotice, setVerifyNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleDeleteProperty = async () => {
    if (!property?.id) return
    const label = getPropertyLabel(property) || 'this property'
    if (!window.confirm(`Are you sure you want to permanently delete "${label}"? This will delete all records from the database and MongoDB Atlas.`)) {
      return
    }
    try {
      await propertyService.deleteProperty(property.id)
      navigate('/properties')
    } catch (err: any) {
      console.error('Failed to delete property:', err)
      alert(err.response?.data?.message || err.response?.data?.detail || 'Failed to delete property.')
    }
  }

  const handleVerifyProperty = async () => {
    if (!property?.id) return
    setIsVerifying(true)
    setVerifyNotice(null)
    try {
      const updated = await propertyService.verifyProperty(property.id)
      setProperty(updated)
      const blkStr = updated.blockchain_block_number ? `Block #${updated.blockchain_block_number}` : ''
      const txHash = updated.blockchain_tx_hash || updated.anchor_tx_hash
      const txStr = txHash ? ` (Tx: ${truncateHash(txHash, 8, 6)})` : ''
      setVerifyNotice({
        type: 'success',
        message: `✓ Property verified and recorded on blockchain ${blkStr}${txStr}!`,
      })
      setTimeout(() => setVerifyNotice(null), 8000)
    } catch (err: any) {
      console.error('Failed to verify property:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Failed to verify property'
      setVerifyNotice({
        type: 'error',
        message: `Error verifying property: ${errorMsg}`,
      })
      setTimeout(() => setVerifyNotice(null), 8000)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDirectOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property?.id) return
    setOfferErrorMessage(null)
    setOfferSuccessMessage(null)

    const isTokenMode = tokenomics.isTokenized && directOfferMode === 'TOKEN_PURCHASE'
    const qty = Number(offerTokenQuantity || 0)

    if (isTokenMode) {
      if (qty < 1) {
        setOfferErrorMessage('Please enter at least 1 token to bid on.')
        return
      }
      if (qty > tokenomics.availableTokens) {
        setOfferErrorMessage(
          `Requested ${qty.toLocaleString()} ${tokenomics.tokenSymbol} exceeds available supply (${tokenomics.availableTokens.toLocaleString()} left).`
        )
        return
      }
      if (qty < tokenomics.minTokensPerBuyer && qty < tokenomics.availableTokens) {
        setOfferErrorMessage(
          `Minimum token purchase is ${tokenomics.minTokensPerBuyer} ${tokenomics.tokenSymbol} tokens.`
        )
        return
      }
    }

    setIsSubmittingOffer(true)
    try {
      await apiClient.post('/transactions', {
        property_id: property.id,
        purchase_mode: isTokenMode ? 'TOKEN_PURCHASE' : 'ENTIRE_PROPERTY',
        token_quantity: isTokenMode ? qty : undefined,
        proposed_amount: Number(offerAmount),
        purchase_price: Number(offerAmount),
        currency: 'USD',
        transaction_type: isTokenMode ? 'TOKEN_PURCHASE' : 'SALE',
        description: offerNotes,
      })
      setOfferSuccessMessage(
        isTokenMode
          ? `Offer for ${qty.toLocaleString()} ${tokenomics.tokenSymbol} submitted to escrow!`
          : 'Entire-property offer submitted and escrow established successfully!'
      )
      setTimeout(() => {
        setIsOfferModalOpen(false)
        navigate('/transactions')
      }, 1500)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Unable to submit purchase offer. Please review your offer details.'
      setOfferErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setIsSubmittingOffer(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Loading property title details...</p>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            to="/properties"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Properties
          </Link>
        </div>
        <Card className="p-12 text-center">
          <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Property Not Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            The requested property record could not be found in the registry. It may have been removed or the ID is incorrect.
          </p>
          <div className="mt-5">
            <Link to="/properties">
              <Button size="sm">Return to Property Registry</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const isVerified =
    (property.verificationStatus || (property as any).verification_status || '').toString().toUpperCase() === 'VERIFIED'
  const isActive =
    !(property.status) || property.status.toString().toUpperCase() === 'ACTIVE'
  const isOwner = Boolean(
    user?.id && (
      (property.current_owner_id && String(property.current_owner_id).toLowerCase() === String(user.id).toLowerCase()) ||
      (property.creator_user_id && String(property.creator_user_id).toLowerCase() === String(user.id).toLowerCase()) ||
      ((property as any).owner_id && String((property as any).owner_id).toLowerCase() === String(user.id).toLowerCase())
    ) || (
      user?.email && (
        (property.ownerAddress && property.ownerAddress.toLowerCase() === user.email.toLowerCase()) ||
        (property.currentOwner && property.currentOwner.toLowerCase() === user.email.toLowerCase())
      )
    )
  )
  // Item 1: Show Make Offer ONLY to BUYER role, and never on own property
  const canMakeOffer = user?.role === 'BUYER' && !isOwner
  const isTokenSoldOut = tokenomics.isTokenized && tokenomics.availableTokens <= 0
  const entireLocked = tokenomics.isTokenized && tokenomics.tokensSold > 0
  const fractionalDisabled = !tokenomics.isTokenized || tokenomics.availableTokens <= 0
  const directEquityPct =
    tokenomics.isTokenized && tokenomics.totalTokens > 0 && offerTokenQuantity > 0
      ? (offerTokenQuantity / tokenomics.totalTokens) * 100
      : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/properties"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to Properties
        </Link>
      </div>

      <PageHeader
        title={getPropertyLabel(property)}
        description={`Reference No.: ${property.registrationReference || 'REG-PENDING'}`}
        breadcrumbs={[
          { label: 'Properties', href: '/properties' },
          { label: getPropertyLabel(property) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={property.verificationStatus} />
            {(user?.role === 'ADMIN' || isOwner) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteProperty}
                className="text-red-600 hover:bg-red-50 hover:border-red-200"
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Delete Property
              </Button>
            )}
            {(user?.role === 'REGISTRAR' || user?.role === 'VERIFIER') &&
              (property.verificationStatus?.toLowerCase() === 'pending' || (property.verification_status || '').toUpperCase() === 'SUBMITTED') && (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={isVerifying}
                  disabled={isVerifying}
                  onClick={handleVerifyProperty}
                  leftIcon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
                >
                  Verify Property
                </Button>
            )}
            {canMakeOffer && (
              isVerified && isActive ? (
                isOwner ? (
                  <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                    Your Listed Property
                  </span>
                ) : isTokenSoldOut ? (
                  <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg border border-amber-200 font-semibold">
                    All Tokens Allocated
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={openDirectOfferModal}
                    >
                      {tokenomics.isTokenized ? 'Buy Tokens / Make Offer' : 'Make Offer'}
                    </Button>
                    <Link to={`/transactions?propertyId=${property.id}&initiate=true`}>
                      <Button size="sm" variant="outline">
                        Initiate Escrow
                      </Button>
                    </Link>
                  </div>
                )
              ) : (
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                  {!isVerified ? 'Pending Title Verification' : 'Inactive'}
                </span>
              )
            )}
          </div>
        }
      />

      {verifyNotice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            verifyNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{verifyNotice.message}</span>
          <button onClick={() => setVerifyNotice(null)} className="ml-2 font-bold hover:opacity-75">×</button>
        </div>
      )}

      {isVerified && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">Recorded on blockchain {property.blockchain_block_number ? `(Block #${property.blockchain_block_number})` : ''}</span>
          {(property.blockchain_tx_hash || property.anchor_tx_hash) && (
            <HashDisplay
              value={property.blockchain_tx_hash || property.anchor_tx_hash}
              explorerLink
              className="bg-transparent border-0 px-0 py-0 text-emerald-900"
            />
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'details', label: 'Physical Asset Specifications' },
          { id: 'documents', label: 'Title Deeds & Records', count: documents.length },
          { id: 'transfer', label: 'Ownership Transfer', count: ownershipRecords.length },
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
      />

      {/* Top Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Metadata Card */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'transfer' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span>On-Chain Ownership Conveyance Proof</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ownershipRecords.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <p>No recorded ownership transfer events for this property yet.</p>
                    {(property.blockchain_tx_hash || (property as any).anchor_tx_hash) && (
                      <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-left space-y-2">
                        <span className="font-semibold text-emerald-800 text-xs">Genesis Property Anchor:</span>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Block:</span>
                          <span className="font-mono font-bold text-slate-800">
                            #{property.blockchain_block_number || 1}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Transaction Hash:</span>
                          <HashDisplay
                            value={property.blockchain_tx_hash || (property as any).anchor_tx_hash}
                            explorerLink
                          />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Initial Owner:</span>
                          <span className="font-semibold text-slate-800">{property.currentOwner}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ownershipRecords.map((rec: any, idx: number) => {
                      const isTokenTransfer =
                        rec.event_type === 'TOKEN_TRANSFER' ||
                        String(rec.property_number || '').includes('-TKN-')
                      const isTransfer =
                        !isTokenTransfer &&
                        (rec.event_type === 'TRANSFER' || rec.previous_owner_name || rec.previous_owner_address)
                      return (
                        <div key={rec.id || idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-xs font-bold px-2 py-0.5 rounded font-mono',
                                  isTokenTransfer
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                )}
                              >
                                {isTokenTransfer
                                  ? 'Token Share Transferred'
                                  : isTransfer
                                  ? 'Ownership Transferred'
                                  : 'Initial Registration'}
                              </span>
                              {rec.transaction_id && (
                                <span className="font-mono text-xs text-slate-500 font-semibold">{rec.transaction_id}</span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatDate(rec.confirmed_at || rec.created_at)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Previous Owner</span>
                              <strong className="text-slate-700 block">
                                {rec.previous_owner_name || (rec.previous_owner_address ? truncateHash(rec.previous_owner_address, 6, 4) : 'Genesis')}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">New Owner</span>
                              <strong className="text-slate-900 block">
                                {rec.new_owner_name || (rec.new_owner_address ? truncateHash(rec.new_owner_address, 6, 4) : property.currentOwner)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Recorded Block</span>
                              <strong className="font-mono text-blue-600 block">
                                #{rec.block_number || rec.blockchain_block_number || 'N/A'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">On-Chain Transfer Proof</span>
                              <HashDisplay
                                value={rec.blockchain_tx_hash || rec.tx_hash}
                                explorerLink
                                className="text-[11px] p-0 border-0 bg-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'details' && (
          <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <PropertyEmblem
                    propertyType={property.propertyType}
                    isTokenized={tokenomics.isTokenized}
                    size={46}
                  />
                  <div>
                    <CardTitle>Physical Asset Specifications</CardTitle>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {property.propertyType} · {property.city}, {property.state}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-0.5 rounded-full border',
                    tokenomics.isTokenized
                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  )}
                >
                  {tokenomics.isTokenized
                    ? `Tokenized (${tokenomics.tokenSymbol})`
                    : 'Entire Property (100% Deed Buyout)'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                {tokenomics.cleanDescription || 'Verified property entry in the decentralized title registry.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Parcel ID
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {property.propertyId}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Classification
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{property.propertyType}</span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Gross Area
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {property.area.toLocaleString()} {property.areaUnit}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Assessed Valuation
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(property.valuation)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Registration Date
                  </span>
                  <span className="text-xs text-slate-700">{formatDate(property.registeredAt)}</span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Current Deeds
                  </span>
                  <span className="text-xs font-medium text-blue-600">
                    {conveyanceCount} Conveyance {conveyanceCount === 1 ? 'Record' : 'Records'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {tokenomics.isTokenized && (
            <Card className="border-purple-200/80 bg-gradient-to-br from-white to-purple-50/30">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-purple-950">
                    <Coins className="h-4 w-4 text-purple-600" />
                    <span>Fractional Tokenization Offering</span>
                  </CardTitle>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                    {tokenomics.tokenSymbol}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Token Price</span>
                    <span className="font-mono text-sm font-bold text-slate-900">{formatCurrency(tokenomics.tokenPrice)}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Available Supply</span>
                    <span className="font-mono text-sm font-bold text-purple-700">
                      {tokenomics.availableTokens.toLocaleString()} / {tokenomics.totalTokens.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Min Purchase</span>
                    <span className="font-mono text-sm font-semibold text-slate-800">
                      {tokenomics.minTokensPerBuyer.toLocaleString()} {tokenomics.tokenSymbol}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Projected APY</span>
                    <span className="font-mono text-sm font-semibold text-emerald-700">
                      {tokenomics.projectedApy !== null ? `${tokenomics.projectedApy}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Token Supply Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>
                      Settled: <strong className="text-slate-800">{tokenomics.tokensSold.toLocaleString()}</strong>
                      {tokenomics.tokensPending > 0 ? ` • In Escrow: ${tokenomics.tokensPending.toLocaleString()}` : ''}
                    </span>
                    <span className="font-mono">
                      {tokenomics.totalTokens > 0
                        ? `${Math.round((tokenomics.availableTokens / tokenomics.totalTokens) * 100)}% available`
                        : '0% available'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-purple-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 transition-all"
                      style={{
                        width: `${
                          tokenomics.totalTokens > 0
                            ? Math.min(100, ((tokenomics.tokensSold + tokenomics.tokensPending) / tokenomics.totalTokens) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {canMakeOffer && isVerified && isActive && !isTokenSoldOut && (
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600">
                      {tokenomics.tokensSold > 0
                        ? 'Partial shares already settled — fractional offers open.'
                        : 'Buyers may purchase fractional token stakes or bid on 100% buyout.'}
                    </span>
                    <Button size="sm" onClick={openDirectOfferModal}>
                      Make Token or Buyout Offer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </>
          )}

          {/* Legal Documents */}
          {(activeTab === 'details' || activeTab === 'documents') && (
          <Card>
            <CardHeader>
              <CardTitle>Authenticated Title Deeds & Deeds of Conveyance</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p>No deed documents currently attached to this registry entry.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {doc.document_type || doc.title || 'Title Document'}
                          </p>

                          <div className="pt-0.5">
                            <HashDisplay
                              value={doc.file_hash || (doc as any).document_hash}
                              label="SHA-256"
                              explorerLink
                              className="text-[10px] py-0 px-1.5"
                            />
                          </div>





                        </div>
                      </div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            doc.status === 'VERIFIED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {doc.status || 'Verified'}
                        </span>
                        {doc.ipfs_url && (
                          <a
                            href={doc.ipfs_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-600"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>

        {/* Right Sidebar: Ownership & Blockchain Ledger */}
        <div className="space-y-6">
          {/* Owner Card */}
          <Card>
            <CardHeader>
              <CardTitle>Title Holder Record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Registered Legal Owner</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">{property.currentOwner}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Owner Address / Email</span>
                <p className="font-mono text-slate-700 break-all bg-slate-50 p-2 rounded border border-slate-100 text-[11px] mt-0.5">
                  {property.ownerAddress || 'Unassigned'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px]">Location Jurisdiction</span>
                <div className="flex items-center gap-1.5 text-slate-700 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>
                    {property.address}, {property.city}, {property.state} {property.postalCode}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-600" />
                <span>On-Chain Settlement State</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ERC-721 Token ID</span>
                <span className="font-mono font-bold text-slate-800">
                  {property.blockchainTokenId ? `#${property.blockchainTokenId}` : 'Anchored on Hardhat'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Network</span>
                <span className="font-semibold text-slate-800">Local Hardhat (31337)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Smart Contract</span>
                <span className="font-mono text-slate-600">0x5FbD...aa3</span>
              </div>
              <div className="pt-2">
                <Link
                  to="/blockchain-explorer"
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>View in Explorer</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Direct Make Offer Modal */}
      <Modal
        isOpen={isOfferModalOpen}
        onClose={() => {
          setIsOfferModalOpen(false)
          setOfferErrorMessage(null)
        }}
        title={`Make Purchase Offer: ${getPropertyLabel(property)}`}
        description="Submit a formal purchase proposal and escrow contract request directly to the deed owner."
        maxWidth="lg"
      >
        <form onSubmit={handleDirectOfferSubmit} className="space-y-4">
          {offerSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
              ✓ {offerSuccessMessage}
            </div>
          )}

          {offerErrorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{offerErrorMessage}</span>
            </div>
          )}

          <div
            className={cn(
              'p-3 border rounded-lg space-y-1.5 text-xs',
              tokenomics.isTokenized ? 'bg-purple-50/70 border-purple-200' : 'bg-slate-50 border-slate-200'
            )}
          >
            <div className="flex justify-between">
              <span className="text-slate-500">Parcel ID:</span>
              <span className="font-mono text-slate-600">{property.propertyId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Registered Owner:</span>
              <span className="font-medium text-slate-800">{property.currentOwner}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Market Valuation:</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(property.valuation)}</span>
            </div>
            {tokenomics.isTokenized && (
              <div className="flex justify-between pt-1 border-t border-purple-200/70">
                <span className="text-purple-800 font-medium">Token Offering ({tokenomics.tokenSymbol}):</span>
                <span className="font-mono font-semibold text-purple-900">
                  {formatCurrency(tokenomics.tokenPrice)} / token • {tokenomics.availableTokens.toLocaleString()} left
                </span>
              </div>
            )}
          </div>

          {/* Purchase Mode Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">Offer Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={fractionalDisabled}
                onClick={() => switchDirectOfferMode('TOKEN_PURCHASE')}
                className={cn(
                  'text-left p-3 rounded-xl border transition-all flex items-start gap-2.5',
                  directOfferMode === 'TOKEN_PURCHASE' && !fractionalDisabled
                    ? 'border-purple-600 bg-purple-50/80 ring-1 ring-purple-600 shadow-xs'
                    : fractionalDisabled
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-70'
                    : 'border-slate-200 bg-white hover:border-purple-300 cursor-pointer'
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {fractionalDisabled ? <Lock className="h-4 w-4 text-slate-400" /> : <Coins className="h-4 w-4 text-purple-600" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Buy Fractional Tokens</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {!tokenomics.isTokenized
                      ? 'Unavailable (entire property listing)'
                      : tokenomics.availableTokens <= 0
                      ? 'All tokens sold / reserved'
                      : `Min ${tokenomics.minTokensPerBuyer} ${tokenomics.tokenSymbol}`}
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={entireLocked}
                onClick={() => switchDirectOfferMode('ENTIRE_PROPERTY')}
                className={cn(
                  'text-left p-3 rounded-xl border transition-all flex items-start gap-2.5',
                  directOfferMode === 'ENTIRE_PROPERTY' && !entireLocked
                    ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600 shadow-xs'
                    : entireLocked
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-70'
                    : 'border-slate-200 bg-white hover:border-blue-300 cursor-pointer'
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {entireLocked ? <Lock className="h-4 w-4 text-slate-400" /> : <Building2 className="h-4 w-4 text-blue-600" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Buy Entire Property (100%)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {entireLocked
                      ? `Locked (${tokenomics.tokensSold.toLocaleString()} tokens sold)`
                      : 'Full 100% ownership deed buyout'}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {tokenomics.isTokenized && directOfferMode === 'TOKEN_PURCHASE' && tokenomics.availableTokens > 0 && (
            <div className="p-3.5 rounded-xl border border-purple-200 bg-white space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <Input
                  type="number"
                  label={`Token Quantity (${tokenomics.tokenSymbol})`}
                  min={1}
                  max={tokenomics.availableTokens}
                  value={offerTokenQuantity}
                  onChange={(e) => updateDirectTokenQuantity(Number(e.target.value))}
                  required
                />
                <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-100 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ownership Share:</span>
                    <strong className="font-mono text-purple-800">
                      {directEquityPct > 0 && directEquityPct < 0.01 ? directEquityPct.toFixed(4) : directEquityPct.toFixed(2)}%
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Listed Value:</span>
                    <strong className="font-mono text-slate-900">
                      {formatCurrency(offerTokenQuantity * tokenomics.tokenPrice)}
                    </strong>
                  </div>
                </div>
              </div>

              {directPresetQuantities.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 mr-1">Quick select:</span>
                  {directPresetQuantities.map((preset) => (
                    <button
                      key={preset.qty}
                      type="button"
                      onClick={() => updateDirectTokenQuantity(preset.qty)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer',
                        offerTokenQuantity === preset.qty
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-purple-50'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Input
              type="number"
              step="0.01"
              label={
                tokenomics.isTokenized && directOfferMode === 'TOKEN_PURCHASE'
                  ? `Total Offer Price for ${offerTokenQuantity.toLocaleString()} ${tokenomics.tokenSymbol} ($ USD)`
                  : 'Your Offer Amount ($ USD)'
              }
              required
              value={offerAmount}
              onChange={(e) => setOfferAmount(Number(e.target.value))}
              helperText={
                tokenomics.isTokenized && directOfferMode === 'TOKEN_PURCHASE' && offerTokenQuantity > 0
                  ? `Implied price: ${formatCurrency(offerAmount / offerTokenQuantity)} / ${tokenomics.tokenSymbol} (listed ${formatCurrency(tokenomics.tokenPrice)})`
                  : `Market valuation: ${formatCurrency(property.valuation)}`
              }
              placeholder="e.g. 1200000"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Escrow Terms / Notes for Seller
            </label>
            <Input
              value={offerNotes}
              onChange={(e) => setOfferNotes(e.target.value)}
              placeholder="Standard real estate conveyance escrow purchase agreement"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOfferModalOpen(false)
                setOfferErrorMessage(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingOffer} disabled={isTokenSoldOut}>
              {tokenomics.isTokenized && directOfferMode === 'TOKEN_PURCHASE'
                ? 'Submit Fractional Token Offer'
                : 'Submit Offer & Lock Escrow'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PropertyDetailPage
