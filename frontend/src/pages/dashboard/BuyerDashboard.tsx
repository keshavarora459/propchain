import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.full_name || 'Buyer'}`}
        description="Buyer Portal: Browse authenticated properties, track active bids, manage title deeds, and monitor your wallet."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadBuyerData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
            <Link to="/properties">
              <Button size="sm" leftIcon={<Search className="h-4 w-4" />}>
                Explore All Properties
              </Button>
            </Link>
          </div>
        }
      />

      {/* Buyer Quick Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Verified Available Properties"
          value={browseProperties.length.toString()}
          subtitle="Deed & title verified by county registrars"
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="My Active Offers"
          value={(buyerMetrics?.active_offers_count ?? myOffers.length).toString()}
          subtitle={myOffers.length > 0 ? 'Pending seller action' : 'No active bids'}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Acquired Properties"
          value={(buyerMetrics?.owned_properties_count ?? myOwnedProperties.length).toString()}
          subtitle="Deeds registered in your name"
          icon={<FileBadge className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Saved Favorites"
          value={savedPropertyIds.length.toString()}
          subtitle="Quick access to properties of interest"
          icon={<BookmarkCheck className="h-5 w-5" />}
          iconBg="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* Tab Navigation */}
      <Tabs
        tabs={[
          { id: 'browse', label: 'Browse Properties', count: browseProperties.length },
          { id: 'saved', label: 'Saved Properties', count: savedPropertyIds.length },
          { id: 'offers', label: 'My Offers', count: myOffers.length },
          { id: 'transactions', label: 'My Transactions', count: myTransactions.length },
          { id: 'properties', label: 'My Properties', count: myOwnedProperties.length },
          { id: 'wallet', label: 'My Wallet' },
          { id: 'blockchain', label: 'Blockchain Records' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* Tab 1: Browse Properties */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-full sm:w-96">
              <Input
                placeholder="Search verified properties by title, city, type..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
                className="bg-slate-50"
              />
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Showing {filteredBrowse.length} verified & active properties
            </div>
          </div>

          {filteredBrowse.length === 0 ? (
            <Card className="p-12 text-center">
              <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No properties found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or check back soon.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBrowse.map((prop) => {
                const isSaved = savedPropertyIds.includes(prop.id) || savedPropertyIds.includes(prop.propertyId)
                return (
                  <Card key={prop.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {prop.propertyType}
                          </span>
                          <h4 className="font-semibold text-slate-900 mt-1 text-sm line-clamp-1">{getPropertyLabel(prop)}</h4>
                          <p className="text-xs text-slate-500">{prop.city}, {prop.state}</p>
                        </div>
                        <button
                          onClick={() => toggleSaveProperty(prop.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition-colors"
                          title={isSaved ? 'Remove from saved' : 'Save property'}
                        >
                          {isSaved ? (
                            <BookmarkCheck className="h-5 w-5 text-amber-500 fill-amber-500" />
                          ) : (
                            <Bookmark className="h-5 w-5" />
                          )}
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Valuation</p>
                          <p className="text-sm font-bold font-mono text-slate-900">{formatCurrency(prop.valuation)}</p>
                        </div>
                        <StatusBadge status={prop.verificationStatus} label={getVerificationLabel(prop, user?.role)} />
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        <Link to={`/properties/${prop.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            View Deed Details
                          </Button>
                        </Link>
                        {!(
                          user?.id && (
                            String(prop.current_owner_id || '').toLowerCase() === String(user.id).toLowerCase() ||
                            String(prop.creator_user_id || '').toLowerCase() === String(user.id).toLowerCase()
                          )
                        ) && (
                          <Link to={`/transactions?propertyId=${prop.id}&initiate=true`} className="flex-1">
                            <Button size="sm" className="w-full text-xs">
                              Make Offer
                            </Button>
                          </Link>
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
              <Bookmark className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No saved properties yet</p>
              <p className="text-xs text-slate-400 mt-1">Browse active properties and click the bookmark icon to save them here for quick review.</p>
              <Button size="sm" onClick={() => setActiveTab('browse')} className="mt-4">
                Browse Properties
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedPropsList.map((prop) => (
                <Card key={prop.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {prop.propertyType}
                      </span>
                      <h4 className="font-semibold text-slate-900 mt-1 text-sm">{getPropertyLabel(prop)}</h4>
                      <p className="text-xs text-slate-500">{prop.city}, {prop.state}</p>
                    </div>
                    <button
                      onClick={() => toggleSaveProperty(prop.id)}
                      className="text-amber-500 p-1"
                      title="Remove bookmark"
                    >
                      <BookmarkCheck className="h-5 w-5 fill-amber-500" />
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-slate-900">{formatCurrency(prop.valuation)}</span>
                    <StatusBadge status={prop.verificationStatus} />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Link to={`/properties/${prop.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        View Details
                      </Button>
                    </Link>
                    <Link to={`/transactions?propertyId=${prop.id}&initiate=true`} className="flex-1">
                      <Button size="sm" className="w-full text-xs">
                        Make Offer
                      </Button>
                    </Link>
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
            <CardTitle>My Active Purchase Offers</CardTitle>
            <CardDescription>Offers you have submitted that are currently under review or awaiting seller acceptance.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {myOffers.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No active purchase offers</p>
                <p className="mt-1">When you make an offer on a verified property, it will be tracked here in real time.</p>
                <Button size="sm" onClick={() => setActiveTab('browse')} className="mt-4">
                  Browse Properties to Buy
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Property</TableHead>
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
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">{offer.transaction_number}</TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(offer)}</TableCell>
                      <TableCell className="text-xs text-slate-600">{offer.seller_name}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900">{formatCurrency(offer.amount)}</TableCell>
                      <TableCell><StatusBadge status={offer.status} /></TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(offer.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Link to="/transactions">
                          <Button size="sm" variant="outline" className="text-xs">
                            View Deal
                          </Button>
                        </Link>
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
              <div className="p-12 text-center text-xs text-slate-400">
                <ArrowLeftRight className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No transaction records found</p>
                <p className="mt-1">You have not initiated any property purchase transactions yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Blockchain TX</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">{tx.transaction_number}</TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(tx)}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell><StatusBadge status={tx.status} /></TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {tx.blockchain_tx_hash ? (
                          <Link to="/blockchain-explorer" className="text-blue-600 hover:underline">
                            {truncateHash(tx.blockchain_tx_hash)}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Pending Settlement</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(tx.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: My Properties */}
      {activeTab === 'properties' && (
        <div className="space-y-4">
          {myOwnedProperties.length === 0 ? (
            <Card className="p-12 text-center">
              <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No acquired properties yet</p>
              <p className="text-xs text-slate-400 mt-1">Once your purchase transaction completes statutory legal confirmation, legal title deeds will appear here.</p>
              <Button size="sm" onClick={() => setActiveTab('browse')} className="mt-4">
                Explore Properties to Acquire
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {myOwnedProperties.map((p: any) => (
                <Card key={p.id} className="p-4 space-y-3 border-emerald-200/80 bg-emerald-50/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Title Registered
                      </span>
                      <h4 className="font-semibold text-slate-900 mt-1 text-sm">{getPropertyLabel(p)}</h4>
                      <p className="text-xs text-slate-500">{p.city}, {p.state}</p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500">Parcel ID: {p.property_number}</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(p.valuation)}</span>
                  </div>
                  <Link to={`/properties/${p.id}`}>
                    <Button variant="outline" size="sm" className="w-full text-xs mt-2">
                      View Official Title & Documents
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: My Wallet */}
      {activeTab === 'wallet' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-blue-600" />
                Web3 Settlement Wallet
              </CardTitle>
              <CardDescription>Your connected Ethereum wallet used for escrow funding and title token custody.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Connection Status</span>
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                    <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {isConnected ? 'Connected to EVM' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Connected Address</span>
                  <span className="font-mono text-slate-900 font-semibold">{account ? truncateHash(account) : 'Not Connected'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Network ID</span>
                  <span className="font-mono text-slate-900">{chainId ? `Chain ID ${chainId} (Hardhat Node)` : 'Local Node (31337)'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Available Balance</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">100.0000 ETH (Testnet)</span>
                </div>
              </div>

              {!isConnected ? (
                <Button onClick={connectWallet} className="w-full">
                  Connect Wallet
                </Button>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                  ✓ Your wallet is fully synchronized and authorized to transact on the PropChain consensus network.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile & Buyer Settings</CardTitle>
              <CardDescription>Manage account credentials, KYC verification status, and communication preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-semibold text-slate-900">{user?.full_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Email Address</span>
                  <span className="font-mono text-slate-900">{user?.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Assigned Network Role</span>
                  <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {getRoleLabel(user?.role) || 'Buyer'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Account Status</span>
                  <span className="font-semibold text-emerald-600">{user?.account_status || 'ACTIVE'}</span>
                </div>
              </div>
              <Link to="/settings" className="block pt-2">
                <Button variant="outline" size="sm" className="w-full gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Edit Profile & Preferences
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 7: Blockchain Records */}
      {activeTab === 'blockchain' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-indigo-600" />
                  Consensus Ledger & Ownership Deeds
                </CardTitle>
                <CardDescription>Immutable on-chain verification events and transaction digests logged on EVM node 31337.</CardDescription>
              </div>
              <Link to="/blockchain-explorer">
                <Button size="sm" variant="outline" className="gap-1 text-xs">
                  Full Blockchain Explorer <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(!dashboardData?.recent_events || dashboardData.recent_events.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Cpu className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p>No recent blockchain events recorded yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Transaction Hash</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.recent_events.map((ev: any) => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {ev.event_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-900">{getPropertyLabel(ev)}</TableCell>
                      <TableCell className="font-mono text-xs text-blue-600">{truncateHash(ev.tx_hash)}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">#{ev.block_number || 1}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(ev.created_at)}</TableCell>
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
