import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { RegisterPropertyModal } from '@/pages/properties/RegisterPropertyModal'
import { formatCurrency, formatDate, getPropertyLabel } from '@/lib/utils'
import { HashDisplay } from '@/components/common/HashDisplay'
import type { SellerDashboardData, SellerProperty, SellerOffer, SellerDocument } from '@/types/seller'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'

export const SellerDashboard: React.FC = () => {
  const { user } = useAuth()

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
    <div className="space-y-6">
      <PageHeader
        title={`Seller Console: ${user?.full_name || 'Property Owner'}`}
        description="Manage listed properties, evaluate incoming buyer purchase offers, upload title deeds, and track escrow settlements."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadSellerData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Register Property
            </Button>
          </div>
        }
      />

      {actionMessage && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 text-xs text-blue-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-blue-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* Seller Key Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="My Listed Properties"
          value={(sellerMetrics?.listed_properties_count ?? myProperties.length).toString()}
          subtitle={`${sellerMetrics?.verified_properties_count ?? 0} Verified on-chain`}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Portfolio Valuation"
          value={formatCurrency(sellerMetrics?.portfolio_valuation_usd ?? 0)}
          subtitle="Total assessed market valuation"
          icon={<FileBadge className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Received Offers"
          value={pendingOffers.length.toString()}
          subtitle={pendingOffers.length > 0 ? 'Purchase proposals awaiting action' : 'All offers answered'}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Active Conveyance Deals"
          value={(sellerMetrics?.active_sales_count ?? 0).toString()}
          subtitle={`${sellerMetrics?.completed_sales_count ?? 0} Completed sales`}
          icon={<FileText className="h-5 w-5" />}
          iconBg="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Seller Overview' },
          { id: 'properties', label: 'My Listed Properties', count: myProperties.length },
          { id: 'documents', label: 'Document Uploads', count: myDocuments.length },
          { id: 'verification', label: 'Verification Status' },
          { id: 'offers', label: 'Received Offers', count: pendingOffers.length },
          { id: 'transactions', label: 'My Transactions', count: receivedOffers.length },
          { id: 'transfer', label: 'Ownership Transfer Status' },
          { id: 'blockchain', label: 'Wallet & Blockchain' },
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
                  <CardTitle>Recent Incoming Offers</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('offers')} className="text-xs">
                    View All ({receivedOffers.length})
                  </Button>
                </div>
                <CardDescription>Bids placed by buyers on your registered properties.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {receivedOffers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p>No offers received yet. Make sure your properties are verified so buyers can submit bids.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Offer Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivedOffers.slice(0, 4).map((offer: SellerOffer) => (
                        <TableRow key={offer.id}>
                          <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(offer)}</TableCell>
                          <TableCell className="text-xs text-slate-600">{offer.buyer_name}</TableCell>
                          <TableCell className="font-mono text-xs font-bold text-slate-900">{formatCurrency(offer.amount)}</TableCell>
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
                  <CardTitle>My Listed Properties</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('properties')} className="text-xs">
                    Manage Properties
                  </Button>
                </div>
                <CardDescription>Properties currently registered under your ownership profile.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {myProperties.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Building2 className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p>You have not registered any properties yet.</p>
                    <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} className="mt-3">
                      Register First Property
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Valuation</TableHead>
                        <TableHead>Verification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myProperties.slice(0, 4).map((p: SellerProperty) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(p)}</TableCell>
                          <TableCell className="text-xs text-slate-500">{p.city}, {p.state}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">{formatCurrency(p.valuation)}</TableCell>
                          <TableCell><StatusBadge status={p.verification_status} /></TableCell>
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

      {/* Tab 2: My Listed Properties */}
      {activeTab === 'properties' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-mono text-slate-500">
              {myProperties.length} total properties registered by your account
            </span>
            <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Add New Property
            </Button>
          </div>

          {myProperties.length === 0 ? (
            <Card className="p-12 text-center">
              <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No properties listed yet</p>
              <p className="text-xs text-slate-400 mt-1">Register a property to begin title verification and receive buyer bids.</p>
              <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} className="mt-4">
                Register Property
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {myProperties.map((p: SellerProperty) => (
                <Card key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {p.property_type}
                      </span>
                      <h4 className="font-semibold text-slate-900 mt-1 text-sm">{getPropertyLabel(p)}</h4>
                      <p className="text-xs text-slate-500">{p.city}, {p.state}</p>
                    </div>
                    <StatusBadge status={p.verification_status} />
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Property No.:</span>
                    <span className="font-mono text-slate-500">{p.property_number}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Valuation:</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(p.valuation)}</span>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <Link to={`/properties/${p.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        View Deed
                      </Button>
                    </Link>
                    <Link to="/documents" className="flex-1">
                      <Button size="sm" variant="secondary" className="w-full text-xs gap-1">
                        <UploadCloud className="h-3 w-3" /> Upload Deeds
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Document Uploads */}
      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Uploaded Title Documents & Deeds</CardTitle>
                <CardDescription>Deed certificates, survey plans, and encumbrance certificates uploaded for title clearance.</CardDescription>
              </div>
              <Link to="/documents">
                <Button size="sm" leftIcon={<UploadCloud className="h-4 w-4" />}>
                  Upload Documents Portal
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myDocuments.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No documents uploaded yet</p>
                <p className="mt-1">Upload scanned deed files and survey maps so verifiers can approve your property.</p>
                <Link to="/documents">
                  <Button size="sm" className="mt-4">
                    Open Document Uploader
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SHA-256 Hash</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myDocuments.map((doc: SellerDocument) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium text-slate-900 text-xs">
                        <div>{doc.title || doc.file_name}</div>
                        {doc.review_notes && (doc.status === 'REJECTED' || doc.status === 'REQUIRES_CORRECTION' || doc.status === 'CORRECTION_REQUESTED') && (
                          <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                            <strong>Review Note:</strong> {doc.review_notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{doc.document_type}</TableCell>
                      <TableCell><StatusBadge status={doc.status} /></TableCell>
                      <TableCell>
                        <HashDisplay value={doc.document_hash} explorerLink label="SHA-256" />
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{doc.created_at ? formatDate(doc.created_at) : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Property Verification Status */}
      {activeTab === 'verification' && (
        <Card>
          <CardHeader>
            <CardTitle>Property Verification Pipeline</CardTitle>
            <CardDescription>Current verification and cryptographic anchoring status of your listed properties.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myProperties.map((p: SellerProperty) => (
                <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{getPropertyLabel(p)}</h4>
                      <p className="text-xs text-slate-400 font-mono">Parcel ID: {p.property_number}</p>
                    </div>
                    <StatusBadge status={p.verification_status} />
                  </div>

                  {p.blockchain_property_id && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Blockchain Asset Token:</span>
                      <HashDisplay value={p.blockchain_property_id} explorerLink />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.verification_status === 'VERIFIED' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                      <span>1. Title Verifier Review: <strong>{p.verification_status === 'VERIFIED' ? 'Complete' : 'In Progress'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.verification_status === 'VERIFIED' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span>2. Cryptographic Hash Digest: <strong>{p.verification_status === 'VERIFIED' ? 'Anchored' : 'Pending'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span>3. Active Marketplace Bidding: <strong>{p.status === 'ACTIVE' && p.verification_status === 'VERIFIED' ? 'Eligible' : 'Locked'}</strong></span>
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
            <CardTitle>Incoming Buyer Offers</CardTitle>
            <CardDescription>Review and accept or reject purchase offers submitted by authenticated buyers.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {receivedOffers.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <ArrowLeftRight className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No buyer offers received yet</p>
                <p className="mt-1">When buyers initiate purchase proposals on your verified properties, you can review and accept them here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Property</TableHead>
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
                        <TableCell className="font-mono text-xs font-semibold text-blue-600">{offer.transaction_number}</TableCell>
                        <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(offer)}</TableCell>
                        <TableCell className="text-xs text-slate-600">{offer.buyer_name}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900">{formatCurrency(offer.amount)}</TableCell>
                        <TableCell><StatusBadge status={offer.status} /></TableCell>
                        <TableCell className="text-xs text-slate-500">{offer.created_at ? formatDate(offer.created_at) : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                disabled={inProgress}
                                onClick={() => handleAcceptOffer(offer.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-2.5"
                              >
                                {inProgress ? 'Processing...' : 'Accept'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={inProgress}
                                onClick={() => handleRejectOffer(offer.id)}
                                className="text-red-600 hover:bg-red-50 text-xs h-8 px-2.5"
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Actioned</span>
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

      {/* Tab 6: My Transactions */}
      {activeTab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Transactions & Escrow Pipeline</CardTitle>
            <CardDescription>Lifecycle tracking of all sales agreements involving your properties.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {receivedOffers.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <p>No transactions recorded yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Settlement Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedOffers.map((tx: SellerOffer) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">{tx.transaction_number}</TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(tx)}</TableCell>
                      <TableCell className="text-xs text-slate-600">{tx.buyer_name}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell><StatusBadge status={tx.status} /></TableCell>
                      <TableCell>
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

      {/* Tab 7: Ownership Transfer Status */}
      {activeTab === 'transfer' && (
        <Card>
          <CardHeader>
            <CardTitle>Ownership Conveyance & Statutory Deed Transfer</CardTitle>
            <CardDescription>Detailed stage-by-stage status of property deed re-assignments.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {receivedOffers.map((tx: SellerOffer) => (
                <div key={tx.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-600">{tx.transaction_number}</span>
                      <h4 className="font-semibold text-slate-900 text-sm">{getPropertyLabel(tx)}</h4>
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Buyer</span>
                      <strong className="text-slate-800">{tx.buyer_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Escrow Amount</span>
                      <strong className="font-mono text-slate-800">{formatCurrency(tx.amount)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Deed Re-assignment</span>
                      <strong className={tx.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600'}>
                        {tx.status === 'COMPLETED' ? 'Title Transferred' : 'In Settlement'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">On-Chain Deed</span>
                      <div className="pt-0.5">
                        <HashDisplay value={tx.blockchain_tx_hash} explorerLink pendingText="Pending Confirmation" className="text-[10px] py-0 px-1" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 8: Wallet & Blockchain */}
      {activeTab === 'blockchain' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
                Seller Escrow Payout Wallet
              </CardTitle>
              <CardDescription>Address authorized to receive released purchase funds upon transaction settlement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payout Network</span>
                  <span className="font-mono font-semibold text-slate-900">EVM Hardhat Node (31337)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Settlement Currency</span>
                  <span className="font-semibold text-slate-900">USDC / Native ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Escrow Security</span>
                  <span className="text-emerald-600 font-semibold">Multi-sig Consensus Guaranteed</span>
                </div>
              </div>
              <p className="text-slate-500 leading-relaxed">
                When the Legal Authority registers the deed, the smart contract automatically settles buyer escrow and transfers funds directly to your wallet.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-indigo-600" />
                Consensus Events Ledger
              </CardTitle>
              <CardDescription>On-chain ownership records anchored for your real estate holdings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-slate-600">
                All property tokens and title hashes registered by your account are permanently etched onto the local EVM blockchain.
              </p>
              <Link to="/blockchain-explorer">
                <Button variant="outline" size="sm" className="w-full gap-1.5 mt-2">
                  <Cpu className="h-4 w-4" />
                  View Blockchain Explorer
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Property Registration Modal */}
      <RegisterPropertyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={() => {
          setIsRegisterModalOpen(false)
          loadSellerData()
        }}
      />
    </div>
  )
}
export default SellerDashboard
