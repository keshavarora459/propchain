import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { HashDisplay } from '@/components/common/HashDisplay'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { truncateHash } from '@/lib/utils'
import { formatCurrency, formatDate, getPropertyLabel } from '@/lib/utils'
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
  const [offerAmount, setOfferAmount] = useState<number>(0)
  const [offerNotes, setOfferNotes] = useState('Standard real estate conveyance escrow purchase agreement')
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false)
  const [offerSuccessMessage, setOfferSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)

    propertyService
      .getPropertyById(id)
      .then((data) => {
        if (data) {
          setProperty(data)
          if (data.valuation) {
            setOfferAmount(Number(data.valuation))
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
    setIsSubmittingOffer(true)
    setOfferSuccessMessage(null)
    try {
      await apiClient.post('/transactions', {
        property_id: property.id,
        proposed_amount: Number(offerAmount),
        purchase_price: Number(offerAmount),
        currency: 'USD',
        transaction_type: 'SALE',
        description: offerNotes,
      })
      setOfferSuccessMessage('Offer submitted and escrow established successfully!')
      setTimeout(() => {
        setIsOfferModalOpen(false)
        navigate('/transactions')
      }, 1500)
    } catch (err: any) {
      console.warn('Backend offer failed, redirecting to settlement engine:', err)
      navigate(`/transactions?propertyId=${property.id}&initiate=true`)
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
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setIsOfferModalOpen(true)}
                    >
                      Make Offer
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
                      const isTransfer = rec.event_type === 'TRANSFER' || rec.previous_owner_name || rec.previous_owner_address
                      return (
                        <div key={rec.id || idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                                {isTransfer ? 'Ownership Transferred' : 'Initial Registration'}
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
          <Card>
            <CardHeader>
              <CardTitle>Physical Asset Specifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                {property.description || 'Verified property entry in the decentralized title registry.'}
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
        onClose={() => setIsOfferModalOpen(false)}
        title={`Make Purchase Offer: ${getPropertyLabel(property)}`}
        description="Submit a formal purchase proposal and escrow contract request directly to the deed owner."
        maxWidth="md"
      >
        <form onSubmit={handleDirectOfferSubmit} className="space-y-4">
          {offerSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
              ✓ {offerSuccessMessage}
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Parcel ID:</span>
              <span className="font-mono text-slate-500">{property.propertyId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Registered Owner:</span>
              <span className="font-medium text-slate-800">{property.currentOwner}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Market Valuation:</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(property.valuation)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Your Offer Amount ($ USD)
            </label>
            <Input
              type="number"
              required
              value={offerAmount}
              onChange={(e) => setOfferAmount(Number(e.target.value))}
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
            <Button type="button" variant="outline" onClick={() => setIsOfferModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingOffer}>
              Submit Offer & Lock Escrow
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PropertyDetailPage
