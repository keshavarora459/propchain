import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Bookmark,
  BookmarkCheck,
  ArrowLeftRight,
  FileBadge,
  ShieldCheck,
  Wallet,
  Cpu,
  Settings,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  RefreshCw,
  Compass,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate, truncateHash, getPropertyLabel, getRoleLabel, getVerificationLabel } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useWallet } from '@/context/WalletContext'
import apiClient from '@/lib/axios'
import type { Property } from '@/types/property'
import { propertyService } from '@/services/propertyService'

export const BuyerDashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { account, isConnected, connectWallet, chainId } = useWallet()

  const [activeTab, setActiveTab] = useState<'browse' | 'saved' | 'offers' | 'transactions' | 'properties' | 'wallet' | 'blockchain'>('browse')
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [browseProperties, setBrowseProperties] = useState<Property[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [savedPropertyIds, setSavedPropertyIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('propchain_saved_properties')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const loadBuyerData = async () => {
    try {
      const [dashRes, propsRes] = await Promise.allSettled([
        apiClient.get('/analytics/dashboard'),
        propertyService.getProperties({ page_size: 50, verification_status: 'VERIFIED' }),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value.data) {
        setDashboardData(dashRes.value.data)
      }

      if (propsRes.status === 'fulfilled' && propsRes.value.items) {
        setBrowseProperties(
          propsRes.value.items.filter((p) => {
            const v = (p.verificationStatus || (p as any).verification_status || '').toString().toUpperCase()
            const s = (p.status || '').toString().toUpperCase()
            return v === 'VERIFIED' && (!s || s === 'ACTIVE')
          })
        )
      }
    } catch (err) {
      console.error('Failed to load buyer data:', err)
    }
  }

  useEffect(() => {
    loadBuyerData()
  }, [])

  const toggleSaveProperty = (propId: string) => {
    setSavedPropertyIds((prev) => {
      const updated = prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId]
      try {
        localStorage.setItem('propchain_saved_properties', JSON.stringify(updated))
      } catch (err) {
        console.warn('Failed to persist saved properties:', err)
      }
      return updated
    })
  }

  const buyerMetrics = dashboardData?.buyer_metrics || {}
  const myOffers = buyerMetrics?.my_transactions?.filter((t: any) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED') || []
  const myTransactions = buyerMetrics?.my_transactions || []
  const myOwnedProperties = buyerMetrics?.my_properties || []
  const savedPropsList = browseProperties.filter((p) => savedPropertyIds.includes(p.id) || savedPropertyIds.includes(p.propertyId))

  const filteredBrowse = browseProperties.filter((p) =>
    searchFilter === '' ||
    p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.city.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.propertyType.toLowerCase().includes(searchFilter.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Acquisition & Estate Portfolio`}
        description={`Welcome back, ${user?.full_name || 'Buyer'}. Discover authenticated luxury residences, manage confidential purchase proposals, and monitor digital deeds.`}
        actions={
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={loadBuyerData} leftIcon={<RefreshCw className="h-3.5 w-3.5 text-[#657565]" />}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/properties')} leftIcon={<Compass className="h-4 w-4" />}>
              Explore Residences
            </Button>
          </div>
        }
      />

      {/* Buyer Quick Stat Cards - Luxury Theme */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Curated Residences"
          value={browseProperties.length.toString()}
          subtitle="Deed & title validated on blockchain"
          icon={<Building2 className="h-5 w-5 text-[#657565]" />}
          iconBg="bg-[#EAE4D9]/60"
        />
        <StatCard
          title="Active Proposals"
          value={(buyerMetrics?.active_offers_count ?? myOffers.length).toString()}
          subtitle={myOffers.length > 0 ? 'Awaiting titleholder response' : 'No pending offers'}
          icon={<ArrowLeftRight className="h-5 w-5 text-[#B49A70]" />}
          iconBg="bg-[#FAF8F3]"
        />
        <StatCard
          title="Acquired Estates"
          value={(buyerMetrics?.owned_properties_count ?? myOwnedProperties.length).toString()}
          subtitle="Deeds inscribed to your identity"
          icon={<FileBadge className="h-5 w-5 text-[#657565]" />}
          iconBg="bg-[#EAE4D9]/60"
        />
        <StatCard
          title="Private Wishlist"
          value={savedPropertyIds.length.toString()}
          subtitle="Bookmarked for acquisition review"
          icon={<BookmarkCheck className="h-5 w-5 text-[#B49A70]" />}
          iconBg="bg-[#FAF8F3]"
        />
      </div>

      {/* Tab Navigation */}
      <Tabs
        tabs={[
          { id: 'browse', label: 'Curated Residences', count: browseProperties.length },
          { id: 'saved', label: 'Saved Collection', count: savedPropertyIds.length },
          { id: 'offers', label: 'My Proposals', count: myOffers.length },
          { id: 'transactions', label: 'Escrow Transactions', count: myTransactions.length },
          { id: 'properties', label: 'Acquired Deeds', count: myOwnedProperties.length },
          { id: 'wallet', label: 'Web3 Settlement Wallet' },
          { id: 'blockchain', label: 'Consensus Proofs' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* Tab 1: Browse Properties */}
      {activeTab === 'browse' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 sm:p-5 rounded-2xl border border-[#E8E2D5] shadow-xs">
            <div className="w-full sm:w-96">
              <Input
                placeholder="Search by title, coastal district, villa..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                leftIcon={<Search className="h-4 w-4 text-[#B49A70]" />}
                className="bg-[#FAF8F3] border-[#E8E2D5]"
              />
            </div>
            <div className="text-xs text-[#6B726B] font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#657565]" />
              Showing {filteredBrowse.length} certified luxury residences
            </div>
          </div>

          {filteredBrowse.length === 0 ? (
            <Card className="p-12 text-center">
              <Building2 className="h-10 w-10 text-[#D4CBBC] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#252B28]">No properties matching criteria</p>
              <p className="text-xs text-[#6B726B] font-normal mt-1">Adjust search parameters or explore newly validated listings.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBrowse.map((prop) => {
                const isSaved = savedPropertyIds.includes(prop.id) || savedPropertyIds.includes(prop.propertyId)
                return (
                  <Card key={prop.id} className="overflow-hidden group hover:border-[#B49A70]/70 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(37,43,40,0.06)] transition-all duration-200">
                    <div className="p-4 sm:p-5 space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]">
                            {prop.propertyType}
                          </span>
                          <h4 className="font-semibold text-[#252B28] mt-1.5 text-base line-clamp-1 group-hover:text-[#657565] transition-colors">
                            {getPropertyLabel(prop)}
                          </h4>
                          <p className="text-xs text-[#6B726B] font-normal">{prop.city}, {prop.state || 'District'}</p>
                        </div>
                        <button
                          onClick={() => toggleSaveProperty(prop.id)}
                          className="p-1.5 rounded-full text-[#6B726B] hover:text-[#B49A70] hover:bg-[#FAF8F3] transition-colors cursor-pointer"
                          title={isSaved ? 'Remove from saved' : 'Save property'}
                        >
                          {isSaved ? (
                            <BookmarkCheck className="h-4.5 w-4.5 text-[#B49A70] fill-[#B49A70]" />
                          ) : (
                            <Bookmark className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </div>

                      <div className="pt-2.5 border-t border-[#F4F1EA] flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[#6B726B] font-semibold">Valuation</p>
                          <p className="text-base font-bold text-[#252B28]">{formatCurrency(prop.valuation)}</p>
                        </div>
                        <StatusBadge status={prop.verificationStatus} label={getVerificationLabel(prop, user?.role)} />
                      </div>

                      <div className="pt-1.5 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/properties/${prop.id}`)}
                          className="flex-1 text-xs"
                        >
                          View Details
                        </Button>
                        {!(
                          user?.id && (
                            String(prop.current_owner_id || '').toLowerCase() === String(user.id).toLowerCase() ||
                            String(prop.creator_user_id || '').toLowerCase() === String(user.id).toLowerCase()
                          )
                        ) && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/transactions?propertyId=${prop.id}&initiate=true`)}
                            className="flex-1 text-xs"
                          >
                            Make Offer
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Saved Properties */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedPropsList.length === 0 ? (
            <Card className="p-12 text-center">
              <Bookmark className="h-10 w-10 text-[#D4CBBC] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#252B28]">No saved properties in collection</p>
              <p className="text-xs text-[#6B726B] font-normal mt-1">Browse active residences and bookmark items to build your prospective portfolio.</p>
              <Button size="sm" onClick={() => setActiveTab('browse')} className="mt-4">
                Explore Available Residences
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedPropsList.map((prop) => (
                <Card key={prop.id} className="p-4 sm:p-5 space-y-3.5 hover:border-[#B49A70]/70 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(37,43,40,0.06)] transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]">
                        {prop.propertyType}
                      </span>
                      <h4 className="font-semibold text-[#252B28] mt-1.5 text-base">{getPropertyLabel(prop)}</h4>
                      <p className="text-xs text-[#6B726B] font-normal">{prop.city}, {prop.state}</p>
                    </div>
                    <button
                      onClick={() => toggleSaveProperty(prop.id)}
                      className="text-[#B49A70] p-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                      title="Remove bookmark"
                    >
                      <BookmarkCheck className="h-4.5 w-4.5 fill-[#B49A70]" />
                    </button>
                  </div>
                  <div className="pt-2.5 border-t border-[#F4F1EA] flex items-center justify-between">
                    <span className="text-base font-bold text-[#252B28]">{formatCurrency(prop.valuation)}</span>
                    <StatusBadge status={prop.verificationStatus} />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/properties/${prop.id}`)}
                      className="flex-1 text-xs"
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/transactions?propertyId=${prop.id}&initiate=true`)}
                      className="flex-1 text-xs"
                    >
                      Make Offer
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: My Offers */}
      {activeTab === 'offers' && (
        <Card>
          <CardHeader>
            <CardTitle>My Active Purchase Proposals</CardTitle>
            <CardDescription>Offers you have submitted that are currently under review or awaiting seller acceptance.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {myOffers.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <Clock className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                <p className="text-sm font-semibold text-[#252B28]">No active purchase offers</p>
                <p className="mt-1 font-normal">When you make an offer on a verified property, it will be tracked here in real time.</p>
                <Button size="sm" onClick={() => setActiveTab('browse')} className="mt-4">
                  Browse Properties to Buy
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Offer Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myOffers.map((offer: any) => (
                    <TableRow key={offer.id}>
                      <TableCell className="font-mono text-xs font-semibold text-[#657565]">{offer.transaction_number}</TableCell>
                      <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(offer)}</TableCell>
                      <TableCell className="text-xs text-[#6B726B] font-normal">{offer.seller_name}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(offer.amount)}</TableCell>
                      <TableCell><StatusBadge status={offer.status} /></TableCell>
                      <TableCell className="text-xs text-[#6B726B]">{formatDate(offer.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/transactions')}
                          className="text-xs h-8 px-3"
                        >
                          View Deal
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

      {/* Tab 4: My Transactions */}
      {activeTab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle>All Purchase Transactions</CardTitle>
            <CardDescription>Complete lifecycle of your buying proposals from escrow deposit to final on-chain conveyance.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {myTransactions.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <ArrowLeftRight className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                <p className="text-sm font-semibold text-[#252B28]">No transaction records found</p>
                <p className="mt-1 font-normal">You have not initiated any property purchase transactions yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Blockchain TX</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs font-semibold text-[#657565]">{tx.transaction_number}</TableCell>
                      <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(tx)}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell><StatusBadge status={tx.status} /></TableCell>
                      <TableCell className="font-mono text-xs text-[#6B726B]">
                        {tx.blockchain_tx_hash ? (
                          <button
                            onClick={() => navigate('/blockchain-explorer')}
                            className="text-[#657565] hover:underline cursor-pointer"
                          >
                            {truncateHash(tx.blockchain_tx_hash)}
                          </button>
                        ) : (
                          <span className="text-[#6B726B]">Pending Settlement</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[#6B726B]">{formatDate(tx.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Acquired Deeds */}
      {activeTab === 'properties' && (
        <div className="space-y-4">
          {myOwnedProperties.length === 0 ? (
            <Card className="p-12 text-center">
              <ShieldCheck className="h-10 w-10 text-[#D4CBBC] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#252B28]">No acquired residences yet</p>
              <p className="text-xs text-[#6B726B] font-normal mt-1">Once your purchase transaction completes statutory legal confirmation, legal title deeds will appear here.</p>
              <Button size="sm" onClick={() => setActiveTab('browse')} className="mt-4">
                Explore Residences to Acquire
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {myOwnedProperties.map((p: any) => (
                <Card key={p.id} className="p-5 space-y-4 border-[#657565]/30 bg-[#FAF8F3]/60">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-[#657565]/15 text-[#3F4B3F] border border-[#657565]/30">
                        Title Registered
                      </span>
                      <h4 className="font-semibold text-[#252B28] mt-2 text-base">{getPropertyLabel(p)}</h4>
                      <p className="text-xs text-[#6B726B] font-normal">{p.city}, {p.state}</p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-[#657565]" />
                  </div>
                  <div className="pt-3 border-t border-[#E8E2D5] flex items-center justify-between text-xs">
                    <span className="font-mono text-[#6B726B]">Parcel: {p.property_number}</span>
                    <span className="font-bold text-[#252B28]">{formatCurrency(p.valuation)}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/properties/${p.id}`)}
                    className="w-full text-xs mt-2"
                  >
                    View Official Title & Deeds
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Web3 Wallet */}
      {activeTab === 'wallet' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[#657565]" />
                Web3 Settlement Wallet
              </CardTitle>
              <CardDescription>Your connected Ethereum wallet used for escrow funding and title token custody.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-[#E8E2D5] bg-[#FAF8F3] p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B726B]">Connection Status</span>
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${isConnected ? 'text-[#657565]' : 'text-[#B49A70]'}`}>
                    <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-[#657565] animate-pulse' : 'bg-[#B49A70]'}`} />
                    {isConnected ? 'Connected to EVM' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B726B]">Connected Address</span>
                  <span className="font-mono text-[#252B28] font-semibold">{account ? truncateHash(account) : 'Not Connected'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B726B]">Network ID</span>
                  <span className="font-mono text-[#252B28]">{chainId ? `Chain ID ${chainId} (Hardhat Node)` : 'Local Node (31337)'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B726B]">Available Balance</span>
                  <span className="font-mono font-semibold text-[#252B28] text-sm">100.0000 ETH (Testnet)</span>
                </div>
              </div>

              {!isConnected ? (
                <Button onClick={connectWallet} className="w-full">
                  Connect Wallet
                </Button>
              ) : (
                <div className="p-3 bg-[#657565]/10 border border-[#657565]/30 rounded-xl text-xs text-[#252B28]">
                  ✓ Your wallet is fully synchronized and authorized to transact on the PropChain consensus network.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile & Preferences</CardTitle>
              <CardDescription>Manage account credentials, KYC verification status, and communication preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-[#F4F1EA]">
                  <span className="text-[#6B726B]">Full Name</span>
                  <span className="font-semibold text-[#252B28]">{user?.full_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#F4F1EA]">
                  <span className="text-[#6B726B]">Email Address</span>
                  <span className="font-mono text-[#252B28]">{user?.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#F4F1EA]">
                  <span className="text-[#6B726B]">Assigned Role</span>
                  <span className="font-semibold text-[#657565] bg-[#657565]/10 px-2 py-0.5 rounded-full border border-[#657565]/20">
                    {getRoleLabel(user?.role) || 'Buyer'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#F4F1EA]">
                  <span className="text-[#6B726B]">Account Status</span>
                  <span className="font-semibold text-[#657565]">{user?.account_status || 'ACTIVE'}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings')}
                className="w-full gap-2 mt-2"
              >
                <Settings className="h-3.5 w-3.5 text-[#657565]" />
                Edit Profile & Preferences
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 7: Blockchain Proofs */}
      {activeTab === 'blockchain' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-[#657565]" />
                  Consensus Ledger & Ownership Deeds
                </CardTitle>
                <CardDescription>Immutable on-chain verification events and transaction digests logged on EVM node 31337.</CardDescription>
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
            {(!dashboardData?.recent_events || dashboardData.recent_events.length === 0) ? (
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
                  {dashboardData.recent_events.map((ev: any) => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]">
                          {ev.event_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-[#252B28]">{getPropertyLabel(ev)}</TableCell>
                      <TableCell className="font-mono text-xs text-[#657565]">{truncateHash(ev.tx_hash)}</TableCell>
                      <TableCell className="font-mono text-xs text-[#6B726B]">#{ev.block_number || 1}</TableCell>
                      <TableCell className="text-xs text-[#6B726B]">{formatDate(ev.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default BuyerDashboard
