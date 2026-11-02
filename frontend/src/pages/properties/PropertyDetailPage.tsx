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
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate, truncateHash } from '@/lib/utils'
import { propertyService } from '@/services/propertyService'
import { ownershipService } from '@/services/ownershipService'
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

    // Fetch conveyance count if available
    apiClient
      .get<any>(`/properties/${id}/ownership-history`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          setConveyanceCount(Math.max(1, res.data.length))
        } else if (res.data?.items && Array.isArray(res.data.items)) {
          setConveyanceCount(Math.max(1, res.data.items.length))
        }
      })
      .catch(() => {
        setConveyanceCount(1)
      })
  }, [id])

  const handleVerifyProperty = async () => {
    if (!property?.id) return
    setIsVerifying(true)
    try {
      const updated = await propertyService.updatePropertyStatus(property.id, {
        verification_status: 'VERIFIED',
      })
      setProperty(updated)
      try {
        const anchorRes = await ownershipService.anchorProperty(property.id)
        if (anchorRes?.property_number) {
          setProperty((prev) => prev ? { ...prev, blockchainPropertyId: anchorRes.property_number } : prev)
        }
      } catch (anchorErr) {
        console.warn('Blockchain anchor call notice:', anchorErr)
      }
    } catch (err) {
      console.error('Failed to verify property:', err)
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
  const canMakeOffer =
    user?.role === 'BUYER' || user?.role === 'PROPERTY_OWNER' || user?.role === 'ADMIN'
  const isOwner = Boolean(
    user?.email &&
      (user.email.toLowerCase() === (property.ownerAddress || '').toLowerCase() ||
        user.email.toLowerCase() === (property.currentOwner || '').toLowerCase())
  )

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
        title={property.title}
        description={`Government Registry Ref: ${property.registrationReference || 'REG-PENDING'}`}
        breadcrumbs={[
          { label: 'Properties', href: '/properties' },
          { label: property.propertyId },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={property.verificationStatus} />
            {(user?.role === 'VERIFIER' || user?.role === 'ADMIN') &&
              property.verificationStatus?.toLowerCase() === 'pending' && (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={isVerifying}
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

      {/* Top Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Metadata Card */}
        <div className="lg:col-span-2 space-y-6">
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
                    Property ID
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-800">
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

          {/* Legal Documents */}
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
                          <span className="text-[10px] font-mono text-slate-400 block truncate">
                            SHA-256: {truncateHash(doc.file_hash || '0xda39a3ee5e6b4b0d3255bfef95601890afd80709', 10, 8)}
                          </span>
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
                  {property.ownerAddress || '0x0000000000000000000000000000000000000000'}
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
        title={`Make Purchase Offer: ${property.title}`}
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
              <span className="font-mono font-semibold text-slate-900">{property.propertyId}</span>
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
