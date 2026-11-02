import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
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
import { formatCurrency, formatDate, truncateHash } from '@/lib/utils'
import { propertyService } from '@/services/propertyService'
import { ownershipService } from '@/services/ownershipService'
import type { Property } from '@/types/property'
import apiClient from '@/lib/axios'

export const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()

  const [property, setProperty] = useState<Property | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [conveyanceCount, setConveyanceCount] = useState<number>(1)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)

    propertyService
      .getPropertyById(id)
      .then((data) => {
        if (data) setProperty(data)
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
        // Default to initial grant (1)
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
      // Anchor on blockchain if not anchored yet
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
            {property.verificationStatus?.toLowerCase() === 'pending' && (
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
            <Link to="/transactions">
              <Button size="sm">Initiate Transfer / Escrow</Button>
            </Link>
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
                    Jurisdiction
                  </span>
                  <span className="text-xs text-slate-700">
                    {property.city}, {property.state}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  {property.address}, {property.city}, {property.state} {property.postalCode}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Attached Deeds & Cadastral Records */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Attached Deeds & Cadastral Records</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Documents uploaded and anchored for this parcel</p>
              </div>
              <Link to="/documents" className="text-xs text-blue-600 hover:underline">
                Upload New
              </Link>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 p-0">
              {documents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-600">No Deeds Uploaded Yet</p>
                  <p className="mt-1">
                    Upload deed surveys or conveyance certificates in the Verify Documents tab to anchor them to this parcel.
                  </p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {doc.title || doc.original_filename || 'Property Deed Document'}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          SHA256: {doc.document_hash ? truncateHash(doc.document_hash, 10, 8) : 'Verified on-chain'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge
                        status={
                          doc.status === 'VERIFIED'
                            ? 'Verified'
                            : doc.status === 'REJECTED'
                            ? 'Rejected'
                            : 'Pending'
                        }
                      />
                      <span className="text-xs font-mono text-slate-500">
                        {doc.file_size
                          ? doc.file_size > 1024 * 1024
                            ? `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`
                            : `${Math.round(doc.file_size / 1024)} KB`
                          : 'PDF'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Ownership & Blockchain Token Ledger */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Current Authenticated Owner</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Beneficial Entity</span>
                <span className="font-semibold text-slate-900 text-sm">{property.currentOwner}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Registered Ethereum Address</span>
                <span className="font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded block truncate mt-1">
                  {property.ownerAddress}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <span className="text-slate-500">Ownership Type</span>
                <span className="font-medium text-slate-800">Fee Simple Direct</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chain History</span>
                <Link to="/ownership" className="text-blue-600 font-semibold hover:underline">
                  {conveyanceCount} Conveyance(s)
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm">On-Chain Token State</CardTitle>
              </div>
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
    </div>
  )
}

export default PropertyDetailPage
