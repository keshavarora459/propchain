import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Plus,
  ArrowLeftRight,
  FileBadge,
  Wallet,
  Cpu,
  Clock,
  FileText,
  UploadCloud,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TransactionLifecycleTimeline } from '@/components/common/TransactionLifecycleTimeline'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { RegisterPropertyModal } from '@/pages/properties/RegisterPropertyModal'
import { formatCurrency, formatDate, getPropertyLabel, getVerificationLabel, truncateHash } from '@/lib/utils'
import { HashDisplay } from '@/components/common/HashDisplay'
import type { SellerDashboardData, SellerProperty, SellerOffer, SellerDocument } from '@/types/seller'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'

export const SellerDashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'documents' | 'verification' | 'offers' | 'transactions' | 'transfer' | 'blockchain'>('overview')
  const [dashboardData, setDashboardData] = useState<SellerDashboardData | null>(null)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadSellerData = async () => {
    try {
      const res = await apiClient.get('/analytics/dashboard')
      if (res.data) {
        setDashboardData(res.data)
      }
    } catch (err) {
      console.error('Failed to load seller dashboard data:', err)
    }
  }

  useEffect(() => {
    loadSellerData()
  }, [])

  const sellerMetrics = dashboardData?.seller_metrics
  const myProperties: SellerProperty[] = sellerMetrics?.my_properties || []
  const receivedOffers: SellerOffer[] = sellerMetrics?.received_offers || []
  const myDocuments: SellerDocument[] = sellerMetrics?.my_documents || []
  const blockchainEvents = (dashboardData?.seller_metrics as any)?.blockchain_events || (dashboardData as any)?.recent_events || []

  const pendingOffers = receivedOffers.filter((o: SellerOffer) =>
    o.status === 'INITIATED' || o.status === 'PENDING_SELLER_ACCEPTANCE' || o.status === 'OFFER_MADE'
  )

  const handleAcceptOffer = async (txnId: string) => {
    setActionInProgress(txnId)
    try {
      await apiClient.post(`/transactions/${txnId}/accept`)
      setActionMessage('✓ Offer successfully accepted. Transaction transitioned to escrow verification.')
      await loadSellerData()
      setTimeout(() => setActionMessage(null), 5000)
    } catch (err: any) {
      console.error('Failed to accept offer:', err)
      setActionMessage(`Error accepting offer: ${err.response?.data?.message || err.message}`)
      setTimeout(() => setActionMessage(null), 5000)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleRejectOffer = async (txnId: string) => {
    setActionInProgress(txnId)
    try {
      await apiClient.post(`/transactions/${txnId}/reject`, { reason: 'Price or terms rejected by titleholder.' })
      setActionMessage('✓ Offer proposal rejected.')
      await loadSellerData()
      setTimeout(() => setActionMessage(null), 5000)
    } catch (err: any) {
      console.error('Failed to reject offer:', err)
      setActionMessage(`Error rejecting offer: ${err.response?.data?.message || err.message}`)
      setTimeout(() => setActionMessage(null), 5000)
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Seller Portfolio Console`}
        description={`Welcome back, ${user?.full_name || 'Estate Owner'}. Manage your luxury listings, evaluate purchase offers, and oversee smart escrow settlements.`}
        actions={
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={loadSellerData} leftIcon={<RefreshCw className="h-3.5 w-3.5 text-[#657565]" />}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              List New Residence
            </Button>
          </div>
        }
      />

      {actionMessage && (
        <div className="rounded-2xl border border-[#657565]/30 bg-[#FAF8F3] p-4 text-xs text-[#252B28] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#657565] shrink-0" />
            <span className="font-medium">{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-[#6B726B] hover:text-[#252B28] font-bold ml-2">×</button>
        </div>
      )}

      {/* Seller Key Stat Cards - Luxury Theme */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Portfolio Holdings"
          value={(sellerMetrics?.listed_properties_count ?? myProperties.length).toString()}
          subtitle={`${sellerMetrics?.verified_properties_count ?? 0} Anchored on-chain`}
          icon={<Building2 className="h-5 w-5 text-[#657565]" />}
          iconBg="bg-[#EAE4D9]/60"
        />
        <StatCard
          title="Portfolio Valuation"
          value={formatCurrency(sellerMetrics?.portfolio_valuation_usd ?? 0)}
          subtitle="Total appraised asset equity"
          icon={<FileBadge className="h-5 w-5 text-[#B49A70]" />}
          iconBg="bg-[#FAF8F3]"
        />
        <StatCard
          title="Incoming Offers"
          value={pendingOffers.length.toString()}
          subtitle={pendingOffers.length > 0 ? 'Buyer bids awaiting signature' : 'All inquiries answered'}
          icon={<ArrowLeftRight className="h-5 w-5 text-[#657565]" />}
          iconBg="bg-[#EAE4D9]/60"
        />
        <StatCard
          title="Settled Conveyances"
          value={(sellerMetrics?.completed_sales_count ?? 0).toString()}
          subtitle={`${sellerMetrics?.active_sales_count ?? 0} In smart escrow pipeline`}
          icon={<ShieldCheck className="h-5 w-5 text-[#B49A70]" />}
          iconBg="bg-[#FAF8F3]"
        />
      </div>

      {/* Hero Showcase Highlight Strip (Luxury real estate aesthetic) */}
      {myProperties.length > 0 && (
        <div className="rounded-2xl border border-[#E8E2D5] bg-gradient-to-r from-[#252B28] via-[#2A312E] to-[#252B28] text-white p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[#B49A70]">Featured Collection</span>
              <h2 className="text-xl sm:text-2xl font-editorial tracking-tight text-[#FAF8F3]">
                {getPropertyLabel(myProperties[0])}
              </h2>
              <p className="text-xs text-[#FAF8F3]/80 font-normal max-w-xl">
                {myProperties[0].city}, {myProperties[0].state || 'EVM Registry'} • Assessed at <span className="font-mono text-[#B49A70] font-semibold">{formatCurrency(myProperties[0].valuation)}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#FAF8F3]/10 border border-[#FAF8F3]/20 text-[#FAF8F3]">
                Parcel: {myProperties[0].property_number}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveTab('properties')}
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                className="bg-[#EAE4D9] text-[#252B28] hover:bg-white text-xs border-0"
              >
                Inspect Portfolio
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Portfolio Overview' },
          { id: 'properties', label: 'Listed Residences', count: myProperties.length },
          { id: 'documents', label: 'Deeds & Documents', count: myDocuments.length },
          { id: 'verification', label: 'Title Verification Pipeline' },
          { id: 'offers', label: 'Received Offers', count: pendingOffers.length },
          { id: 'transactions', label: 'Settlement Escrow', count: receivedOffers.length },
          { id: 'transfer', label: 'Deed Re-assignment' },
          { id: 'blockchain', label: 'Cryptographic Ledger' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Purchase Offers</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('offers')} className="text-xs">
                    View All ({receivedOffers.length})
                  </Button>
                </div>
                <CardDescription>Bids placed by verified buyers on your registered residences.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {receivedOffers.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#6B726B]">
                    <Clock className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                    <p className="font-medium text-[#252B28]">No active buyer offers currently.</p>
                    <p className="mt-1 font-light">As soon as buyers submit escrow deposits, proposals will populate here.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Residence</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Offer Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivedOffers.slice(0, 4).map((offer: SellerOffer) => (
                        <TableRow key={offer.id}>
                          <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(offer)}</TableCell>
                          <TableCell className="text-xs text-[#6B726B] font-normal">{offer.buyer_name}</TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(offer.amount)}</TableCell>
                          <TableCell><StatusBadge status={offer.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Registered Residences</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('properties')} className="text-xs">
                    Manage Properties
                  </Button>
                </div>
                <CardDescription>Real estate assets currently held under your ownership profile.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {myProperties.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#6B726B]">
                    <Building2 className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                    <p className="font-medium text-[#252B28]">No properties listed in your vault.</p>
                    <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} className="mt-3">
                      List First Property
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Valuation</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myProperties.slice(0, 4).map((prop: SellerProperty) => (
                        <TableRow key={prop.id}>
                          <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(prop)}</TableCell>
                          <TableCell className="text-xs text-[#6B726B] font-normal">{prop.city}, {prop.state || 'Primary'}</TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(prop.valuation)}</TableCell>
                          <TableCell><StatusBadge status={prop.verification_status} label={getVerificationLabel(prop, user?.role)} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Listed Properties */}
      {activeTab === 'properties' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Real Estate Vault</CardTitle>
                <CardDescription>All parcels registered with title deed references, land valuations and verification states.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Register Property
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myProperties.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <Building2 className="h-10 w-10 mx-auto text-[#D4CBBC] mb-2" />
                <p className="text-sm font-medium text-[#252B28]">No properties in portfolio</p>
                <p className="mt-1 font-light">Register a property and attach deeds to begin cryptographic verification.</p>
                <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} className="mt-4">
                  Register New Property
                </Button>
              </div>
            ) : (
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcel ID</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>City / Region</TableHead>
                    <TableHead>Valuation</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>On-Chain Token</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myProperties.map((p: SellerProperty) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs font-medium text-[#657565]">{p.property_number}</TableCell>
                      <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(p)}</TableCell>
                      <TableCell className="text-xs text-[#6B726B] font-normal">{p.city}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(p.valuation)}</TableCell>
                      <TableCell><StatusBadge status={p.verification_status} label={getVerificationLabel(p, user?.role)} /></TableCell>
                      <TableCell>
                        <HashDisplay value={p.blockchain_property_id} explorerLink pendingText="Pending Tokenization" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/properties/${p.id}`)}
                          className="text-xs h-8 px-3"
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Deeds & Documents */}
      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Uploaded Title Documents & Deeds</CardTitle>
                <CardDescription>Deed certificates, cadastral maps, and tax clearances uploaded for title clearance.</CardDescription>
              </div>
              <Button size="sm" onClick={() => navigate('/documents')} leftIcon={<UploadCloud className="h-4 w-4" />}>
                Upload Documents Portal
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myDocuments.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <FileText className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                <p className="text-sm font-medium text-[#252B28]">No documents uploaded yet</p>
                <p className="mt-1 font-light">Upload scanned deed files and survey maps so verifiers can approve your property.</p>
                <Button size="sm" onClick={() => navigate('/documents')} className="mt-4">
                  Open Document Uploader
                </Button>
              </div>
            ) : (
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Title</TableHead>
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="min-w-[180px] whitespace-nowrap">SHA-256 Hash</TableHead>
                    <TableHead className="whitespace-nowrap">Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myDocuments.map((doc: SellerDocument) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium text-[#252B28] text-xs">
                        <div>{doc.title || doc.file_name}</div>
                        {doc.review_notes && (doc.status === 'REJECTED' || doc.status === 'REQUIRES_CORRECTION' || doc.status === 'CORRECTION_REQUESTED') && (
                          <div className="mt-1 text-[11px] text-amber-800 bg-[#EAE4D9]/50 p-2 rounded-lg border border-[#D4CBBC]">
                            <strong>Review Note:</strong> {doc.review_notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[#6B726B] whitespace-nowrap">{doc.document_type}</TableCell>
                      <TableCell className="whitespace-nowrap"><StatusBadge status={doc.status} /></TableCell>
                      <TableCell className="min-w-[180px] whitespace-nowrap">
                        <HashDisplay value={doc.document_hash} explorerLink label="SHA-256" />
                      </TableCell>
                      <TableCell className="text-xs text-[#6B726B] whitespace-nowrap">{doc.created_at ? formatDate(doc.created_at) : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Verification Pipeline */}
      {activeTab === 'verification' && (
        <Card>
          <CardHeader>
            <CardTitle>Property Verification Pipeline</CardTitle>
            <CardDescription>Current verification milestones and cryptographic anchoring status of your listed residences.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myProperties.map((p: SellerProperty) => (
                <div key={p.id} className="p-5 rounded-2xl border border-[#E8E2D5] bg-[#FAF8F3]/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-[#252B28] text-base">{getPropertyLabel(p)}</h4>
                      <p className="text-xs text-[#6B726B] font-mono mt-0.5">Parcel ID: {p.property_number}</p>
                    </div>
                    <StatusBadge status={p.verification_status} label={getVerificationLabel(p, user?.role)} />
                  </div>

                  {p.blockchain_property_id && (
                    <div className="flex items-center gap-2 text-xs pt-1">
                      <span className="text-[#6B726B]">Blockchain Asset Token:</span>
                      <HashDisplay value={p.blockchain_property_id} explorerLink />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#E8E2D5] text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.verification_status === 'VERIFIED' ? 'bg-[#657565]' : 'bg-[#B49A70] animate-pulse'}`} />
                      <span className="text-[#252B28]">1. Title Verifier Review: <strong>{p.verification_status === 'VERIFIED' ? 'Complete' : 'In Progress'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.verification_status === 'VERIFIED' ? 'bg-[#657565]' : 'bg-[#D4CBBC]'}`} />
                      <span className="text-[#252B28]">2. Cryptographic Digest: <strong>{p.verification_status === 'VERIFIED' ? 'Anchored' : 'Pending'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-[#657565]' : 'bg-[#D4CBBC]'}`} />
                      <span className="text-[#252B28]">3. Marketplace Bidding: <strong>{p.status === 'ACTIVE' && p.verification_status === 'VERIFIED' ? 'Eligible' : 'Locked'}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Received Offers */}
      {activeTab === 'offers' && (
        <Card>
          <CardHeader>
            <CardTitle>Incoming Purchase Proposals</CardTitle>
            <CardDescription>Review and accept or decline bids submitted by authenticated buyers.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {receivedOffers.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <ArrowLeftRight className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                <p className="text-sm font-medium text-[#252B28]">No buyer offers received yet</p>
                <p className="mt-1 font-light">When buyers initiate purchase proposals on your verified properties, you can review and accept them here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Proposed Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedOffers.map((offer: SellerOffer) => {
                    const isPending = offer.status === 'INITIATED' || offer.status === 'PENDING_SELLER_ACCEPTANCE' || offer.status === 'OFFER_MADE'
                    const inProgress = actionInProgress === offer.id
                    return (
                      <TableRow key={offer.id}>
                        <TableCell className="font-mono text-xs font-semibold text-[#657565]">{offer.transaction_number}</TableCell>
                        <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(offer)}</TableCell>
                        <TableCell className="text-xs text-[#6B726B] font-normal">{offer.buyer_name}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(offer.amount)}</TableCell>
                        <TableCell><StatusBadge status={offer.status} /></TableCell>
                        <TableCell className="text-xs text-[#6B726B]">{offer.created_at ? formatDate(offer.created_at) : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                disabled={inProgress}
                                onClick={() => handleAcceptOffer(offer.id)}
                                className="bg-[#657565] hover:bg-[#526152] text-white text-xs h-8 px-3"
                              >
                                {inProgress ? 'Processing...' : 'Accept'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={inProgress}
                                onClick={() => handleRejectOffer(offer.id)}
                                className="text-rose-700 hover:bg-rose-50 text-xs h-8 px-3"
                              >
                                Decline
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-[#6B726B] font-medium">Actioned</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Transactions & Escrow */}
      {activeTab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Transactions & Escrow Pipeline</CardTitle>
            <CardDescription>Lifecycle tracking of all sales agreements involving your residences.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {receivedOffers.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <p>No transactions recorded yet.</p>
              </div>
            ) : (
              <Table className="min-w-[750px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Transaction #</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead className="whitespace-nowrap">Amount</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="min-w-[180px] whitespace-nowrap">Settlement Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedOffers.map((tx: SellerOffer) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs font-semibold text-[#657565] whitespace-nowrap">{tx.transaction_number}</TableCell>
                      <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(tx)}</TableCell>
                      <TableCell className="text-xs text-[#6B726B] font-normal">{tx.buyer_name}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap"><StatusBadge status={tx.status} /></TableCell>
                      <TableCell className="min-w-[180px] whitespace-nowrap">
                        <HashDisplay value={tx.blockchain_tx_hash} explorerLink pendingText="Pending Settlement" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 7: Deed Re-assignment */}
      {activeTab === 'transfer' && (
        <Card>
          <CardHeader>
            <CardTitle>Ownership Conveyance & Statutory Deed Transfer</CardTitle>
            <CardDescription>Detailed stage-by-stage status of property deed re-assignments across all 6 conveyance milestones.</CardDescription>
          </CardHeader>
          <CardContent>
            {receivedOffers.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <p>No transactions undergoing ownership conveyance at this time.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {receivedOffers.map((tx: SellerOffer) => (
                  <div key={tx.id} className="p-6 rounded-2xl border border-[#E8E2D5] bg-white space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#657565]">{tx.transaction_number}</span>
                        <h4 className="font-semibold text-[#252B28] text-base">{getPropertyLabel(tx)}</h4>
                      </div>
                      <StatusBadge status={tx.status} />
                    </div>

                    <TransactionLifecycleTimeline
                      status={tx.status}
                      blockchainTxHash={tx.blockchain_tx_hash}
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#F4F1EA] text-xs">
                      <div>
                        <span className="text-[#6B726B] block text-[11px]">New Owner / Buyer</span>
                        <strong className="text-[#252B28] font-medium">{tx.buyer_name}</strong>
                      </div>
                      <div>
                        <span className="text-[#6B726B] block text-[11px]">Escrow Amount</span>
                        <strong className="font-mono text-[#252B28] font-semibold">{formatCurrency(tx.amount)}</strong>
                      </div>
                      <div>
                        <span className="text-[#6B726B] block text-[11px]">Conveyance State</span>
                        <strong className={tx.status === 'COMPLETED' ? 'text-[#657565]' : 'text-[#B49A70]'}>
                          {tx.status === 'COMPLETED' ? 'Title Transferred ✓' : 'Settlement Active'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#6B726B] block text-[11px]">On-Chain Transfer Proof</span>
                        <div className="pt-0.5">
                          <HashDisplay
                            value={tx.blockchain_tx_hash}
                            explorerLink
                            pendingText="Pending Transfer"
                            className="text-[11px] py-0.5 px-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 8: Cryptographic Ledger */}
      {activeTab === 'blockchain' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-[#657565]" />
                  Seller Escrow Payout Wallet
                </CardTitle>
                <CardDescription>Address authorized to receive released purchase funds upon transaction settlement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-4 rounded-xl border border-[#E8E2D5] bg-[#FAF8F3] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#6B726B]">Payout Network</span>
                    <span className="font-mono font-semibold text-[#252B28]">EVM Hardhat Node (31337)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B726B]">Settlement Currency</span>
                    <span className="font-semibold text-[#252B28]">USDC / Native ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B726B]">Escrow Security</span>
                    <span className="text-[#657565] font-semibold">Consensus Guaranteed</span>
                  </div>
                </div>
                <p className="text-[#6B726B] leading-relaxed font-light">
                  When the Legal Authority registers the deed, the smart contract automatically settles buyer escrow and transfers funds directly to your wallet.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-[#B49A70]" />
                  Consensus Events Ledger
                </CardTitle>
                <CardDescription>On-chain ownership records anchored for your real estate holdings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-[#6B726B] font-light leading-relaxed">
                  All property tokens and title hashes registered by your account are permanently etched onto the EVM blockchain.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/blockchain-explorer')}
                  className="w-full gap-2 mt-2"
                >
                  <Cpu className="h-4 w-4 text-[#657565]" />
                  Open Decentralized Ledger Explorer
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-[#657565]" />
                    Consensus Ledger & Ownership Deeds
                  </CardTitle>
                  <CardDescription>
                    Immutable on-chain verification events and transaction digests logged on EVM node 31337.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/blockchain-explorer')}
                  className="gap-1.5 text-xs"
                >
                  Full Explorer <ExternalLink className="h-3.5 w-3.5 text-[#B49A70]" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {blockchainEvents.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#6B726B]">
                  <Cpu className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                  <p>No recent blockchain events recorded yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Residence</TableHead>
                      <TableHead>Transaction Hash</TableHead>
                      <TableHead>Block Height</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockchainEvents.map((ev: any) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]">
                            {ev.event_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-[#252B28]">
                          {ev.property_title || ev.property_number || 'Parcel'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[#657565]">
                          {truncateHash(ev.tx_hash)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[#6B726B]">
                          #{ev.block_number || 1}
                        </TableCell>
                        <TableCell className="text-xs text-[#6B726B]">
                          {formatDate(ev.created_at)}
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

      {/* Property Registration Modal */}
      <RegisterPropertyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={(newProp) => {
          setIsRegisterModalOpen(false)
          loadSellerData()
          const targetId = newProp?.propertyId || newProp?.id
          if (targetId) {
            navigate(`/documents?propertyId=${targetId}`)
          }
        }}
      />
    </div>
  )
}
export default SellerDashboard
