import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  MapPin,
  FileText,
  ShieldCheck,
  Cpu,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MOCK_PROPERTIES } from '@/mock-data/properties'
import { MOCK_OWNERSHIP_RECORDS } from '@/mock-data/ownership'
import { MOCK_DOCUMENTS } from '@/mock-data/documents'
import { formatCurrency, formatDate } from '@/lib/utils'
import { propertyService } from '@/services/propertyService'
import type { Property } from '@/types/property'

export const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()

  const [property, setProperty] = useState<Property>(() => {
    return MOCK_PROPERTIES.find((p) => p.id === id || p.propertyId === id) || MOCK_PROPERTIES[0]
  })

  useEffect(() => {
    if (!id) return
    propertyService
      .getPropertyById(id)
      .then((data) => {
        if (data) setProperty(data)
      })
      .catch(() => {
        const mock = MOCK_PROPERTIES.find((p) => p.id === id || p.propertyId === id)
        if (mock) setProperty(mock)
      })
  }, [id])
  const ownership = MOCK_OWNERSHIP_RECORDS.find((o) => o.propertyId === property.propertyId)
  const documents = MOCK_DOCUMENTS.filter((d) => d.propertyId === property.propertyId)

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
        description={`Government Registry Ref: ${property.registrationReference}`}
        breadcrumbs={[
          { label: 'Properties', href: '/properties' },
          { label: property.propertyId },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={property.verificationStatus} />
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
              <p className="text-sm text-slate-600 leading-relaxed">{property.description}</p>

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

          {/* Attached Verified Documents */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attached Deeds & Cadastral Records</CardTitle>
              <Link to="/documents" className="text-xs text-blue-600 hover:underline">
                Upload New
              </Link>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 p-0">
              {documents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No documents attached for this parcel yet.
                </div>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{doc.documentName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          SHA256: {doc.documentHash.slice(0, 16)}...
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      <span className="text-xs font-mono text-slate-500">{doc.fileSize}</span>
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
                <span className="font-medium text-slate-800">
                  {ownership?.acquisitionType || 'Fee Simple Direct'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chain History</span>
                <Link to="/ownership" className="text-blue-600 font-semibold hover:underline">
                  {ownership?.history.length || 1} Conveyance(s)
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
                  {property.blockchainTokenId ? `#${property.blockchainTokenId}` : 'Unminted (Pending)'}
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
