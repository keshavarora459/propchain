import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Building2,
  FileBadge,
  ArrowLeftRight,
  Cpu,
  Clock,
  RefreshCw,
  Trash2,
  Database,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { formatCurrency, formatDate, truncateHash, getPropertyLabel, getRoleLabel, getVerificationLabel } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'
import authService from '@/services/authService'
import { propertyService } from '@/services/propertyService'

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'roles' | 'properties' | 'transactions' | 'blockchain' | 'logs'>('overview')
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [userList, setUserList] = useState<any[]>([])
  const [propertyList, setPropertyList] = useState<any[]>([])
  const [isSyncingMongo, setIsSyncingMongo] = useState<boolean>(false)

  const handleSyncMongo = async () => {
    setIsSyncingMongo(true)
    try {
      await apiClient.post('/health/mongodb/sync')
      await loadAdminData()
      alert('Database cache successfully synchronized with MongoDB Atlas!')
    } catch (err: any) {
      console.error('Failed to sync with MongoDB:', err)
      alert('Failed to sync with MongoDB Atlas: ' + (err.message || 'Unknown error'))
    } finally {
      setIsSyncingMongo(false)
    }
  }

  const handleDeletePropertyAdmin = async (propertyId: string, title?: string) => {
    const label = title || 'this property'
    if (!window.confirm(`Are you sure you want to permanently delete "${label}"? This will delete all records from the database and MongoDB Atlas.`)) {
      return
    }
    try {
      await propertyService.deleteProperty(propertyId)
      await loadAdminData()
    } catch (err: any) {
      console.error('Failed to delete property:', err)
      alert(err.response?.data?.message || err.response?.data?.detail || 'Failed to delete property.')
    }
  }

  const handleDeleteUserAdmin = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${email}"? This action cannot be undone.`)) {
      return
    }
    try {
      await authService.deleteUser(userId)
      await loadAdminData()
    } catch (err: any) {
      console.error('Failed to delete user:', err)
      alert(err.response?.data?.message || err.response?.data?.detail || 'Failed to delete user.')
    }
  }

  const loadAdminData = async () => {
    try {
      const [dashRes, usersRes, propsRes] = await Promise.allSettled([
        apiClient.get('/analytics/dashboard'),
        authService.listUsers({ page_size: 15 }),
        propertyService.getProperties({ page_size: 15 }),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value.data) {
        setDashboardData(dashRes.value.data)
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.users) {
        setUserList(usersRes.value.users)
      }
      if (propsRes.status === 'fulfilled' && propsRes.value.items) {
        setPropertyList(propsRes.value.items)
      }
    } catch (err) {
      console.error('Failed to load admin telemetry:', err)
    }
  }

  useEffect(() => {
    loadAdminData()
  }, [])

  const adminMetrics = dashboardData?.admin_metrics || {}
  const auditLogs = adminMetrics?.audit_logs || []
  const recentEvents = dashboardData?.recent_events || []
  const recentTransactions = dashboardData?.recent_transactions || []

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Executive Governance & Network Oversight`}
        description={`Console for ${user?.full_name || 'System Administrator'}. Comprehensive telemetry across institutional participants, verified luxury real estate, consensus contracts, and audit trails.`}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncMongo}
              isLoading={isSyncingMongo}
              leftIcon={<Database className="h-3.5 w-3.5 text-[#657565]" />}
              className="border-[#D4CBBC] text-[#252B28] hover:bg-[#EAE4D9]/50"
            >
              Sync Atlas
            </Button>
            <Button variant="outline" size="sm" onClick={loadAdminData} leftIcon={<RefreshCw className="h-3.5 w-3.5 text-[#657565]" />}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/admin/users')} leftIcon={<Users className="h-4 w-4" />}>
              Identity Registry
            </Button>
          </div>
        }
      />

      {/* Admin KPI Stat Cards - Luxury Theme */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Network Identities"
          value={(adminMetrics?.total_users_count ?? userList.length).toString()}
          subtitle={`${adminMetrics?.active_users_count ?? userList.length} Active accounts provisioned`}
          icon={<Users className="h-5 w-5 text-[#657565]" />}
          iconBg="bg-[#EAE4D9]/60"
        />
        <StatCard
          title="Enrolled Residences"
          value={(dashboardData?.total_properties ?? propertyList.length).toString()}
          subtitle={`${dashboardData?.verified_properties ?? 0} Authenticated titles`}
          icon={<Building2 className="h-5 w-5 text-[#B49A70]" />}
          iconBg="bg-[#FAF8F3]"
        />
        <StatCard
          title="Platform Gross Valuation"
          value={formatCurrency(dashboardData?.total_valuation_usd ?? 0)}
          subtitle="Consolidated real estate capitalization"
          icon={<FileBadge className="h-5 w-5 text-[#657565]" />}
          iconBg="bg-[#EAE4D9]/60"
        />
        <StatCard
          title="Active Conveyances"
          value={(dashboardData?.active_transactions ?? 0).toString()}
          subtitle={`${dashboardData?.completed_transactions ?? 0} Transferred on blockchain`}
          icon={<ArrowLeftRight className="h-5 w-5 text-[#B49A70]" />}
          iconBg="bg-[#FAF8F3]"
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Platform Overview' },
          { id: 'users', label: 'User Directory', count: userList.length },
          { id: 'roles', label: 'RBAC Security Matrix' },
          { id: 'properties', label: 'Real Estate Catalog', count: propertyList.length },
          { id: 'transactions', label: 'Escrow Settlements', count: recentTransactions.length },
          { id: 'blockchain', label: 'EVM Node Telemetry', count: recentEvents.length },
          { id: 'logs', label: 'Audit Log Archive', count: auditLogs.length },
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
                  <CardTitle>Recent Network Transactions</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('transactions')} className="text-xs">
                    View All
                  </Button>
                </div>
                <CardDescription>Escrow and purchase deals active across buyers and sellers.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {recentTransactions.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#6B726B]">
                    <Clock className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                    <p className="font-medium text-[#252B28]">No transactions recorded yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction #</TableHead>
                        <TableHead>Residence</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.slice(0, 5).map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs font-semibold text-[#657565]">{t.transaction_number}</TableCell>
                          <TableCell className="font-semibold text-[#252B28] text-xs">{t.property_title}</TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(t.purchase_price)}</TableCell>
                          <TableCell><StatusBadge status={t.status} /></TableCell>
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
                  <CardTitle>Recent Participant Activations</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => navigate('/admin/users')} className="text-xs">
                    Directory
                  </Button>
                </div>
                <CardDescription>Accounts provisioned across network roles.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {userList.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#6B726B]">
                    <p>No user accounts indexed.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userList.slice(0, 5).map((u: any) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium text-[#252B28] text-xs">{u.full_name}</TableCell>
                          <TableCell className="font-mono text-xs text-[#6B726B]">{u.email}</TableCell>
                          <TableCell>
                            <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]">
                              {getRoleLabel(u.role)}
                            </span>
                          </TableCell>
                          <TableCell><StatusBadge status={u.account_status} /></TableCell>
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

      {/* Tab 2: User Directory */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Registered Network Accounts</CardTitle>
                <CardDescription>Administrative view of authenticated identity accounts.</CardDescription>
              </div>
              <Button size="sm" onClick={() => navigate('/admin/users')}>
                Open Full User Directory
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead>Registered At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userList.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-[#252B28] text-xs">{u.full_name}</TableCell>
                    <TableCell className="font-mono text-xs text-[#6B726B]">{u.email}</TableCell>
                    <TableCell>
                      <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]">
                        {getRoleLabel(u.role)}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={u.account_status} /></TableCell>
                    <TableCell className="text-xs text-[#6B726B]">{formatDate(u.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {u.role !== 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUserAdmin(u.id, u.email)}
                          className="p-1.5 rounded-full text-[#6B726B] hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete user"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Role & Permissions Matrix */}
      {activeTab === 'roles' && (
        <Card>
          <CardHeader>
            <CardTitle>Enterprise RBAC Authorization Matrix</CardTitle>
            <CardDescription>Functional permissions granted per authenticated role in accordance with PropChain governance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-[#E8E2D5]">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F3] text-[#252B28] font-semibold border-b border-[#E8E2D5]">
                    <th className="p-3.5 font-medium">Permission Scope</th>
                    <th className="p-3.5 text-center font-medium">Buyer</th>
                    <th className="p-3.5 text-center font-medium">Seller</th>
                    <th className="p-3.5 text-center font-medium">Registrar</th>
                    <th className="p-3.5 text-center font-medium">Legal Authority</th>
                    <th className="p-3.5 text-center font-medium">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA]">
                  <tr>
                    <td className="p-3.5 font-medium text-[#252B28]">view_dashboard</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-[#252B28]">register_property</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-[#252B28]">initiate_transaction</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-[#252B28]">verify_documents</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-[#252B28]">confirm_legal_registration</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold bg-[#657565]/10">✓ (Exclusive)</td>
                    <td className="p-3.5 text-center text-rose-700 font-semibold bg-rose-50/50">✕ (Restricted)</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-[#252B28]">manage_users</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#D4CBBC]">—</td>
                    <td className="p-3.5 text-center text-[#657565] font-bold">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Property Management */}
      {activeTab === 'properties' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Network Properties Catalog</CardTitle>
                <CardDescription>Administrative view of all registered real estate assets.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/properties')} className="text-xs">
                All Properties View
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcel ID</TableHead>
                  <TableHead>Residence</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Valuation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyList.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-[#657565]">{p.propertyId}</TableCell>
                    <TableCell className="font-semibold text-[#252B28] text-xs">
                      <button
                        onClick={() => navigate(`/properties/${p.id}`)}
                        className="hover:text-[#657565] cursor-pointer text-left font-semibold"
                      >
                        {getPropertyLabel(p)}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-[#6B726B]">{p.propertyType}</TableCell>
                    <TableCell className="text-xs text-[#6B726B]">{p.city}, {p.state}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(p.valuation)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell><StatusBadge status={p.verificationStatus} label={getVerificationLabel(p, user?.role)} /></TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDeletePropertyAdmin(p.id, getPropertyLabel(p))}
                        className="p-1.5 rounded-full text-[#6B726B] hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete property"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Transaction Monitoring */}
      {activeTab === 'transactions' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Global Transaction Monitoring Ledger</CardTitle>
                <CardDescription>All purchase and escrow proposals moving through consensus settlement.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/transactions')} className="text-xs">
                Escrow Dashboard
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#6B726B]">
                <p>No transactions found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Purchase Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>TX Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs font-semibold text-[#657565]">{tx.transaction_number}</TableCell>
                      <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(tx)}</TableCell>
                      <TableCell className="text-xs text-[#6B726B] font-normal">{tx.buyer_name}</TableCell>
                      <TableCell className="text-xs text-[#6B726B] font-normal">{tx.seller_name}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(tx.purchase_price)}</TableCell>
                      <TableCell><StatusBadge status={tx.status} /></TableCell>
                      <TableCell className="font-mono text-xs text-[#6B726B]">
                        {tx.blockchain_tx_hash ? truncateHash(tx.blockchain_tx_hash) : 'Pending'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Blockchain Monitoring */}
      {activeTab === 'blockchain' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-[#657565]" />
                  EVM Blockchain Network Monitoring
                </CardTitle>
                <CardDescription>Hardhat node 31337 blocks, gas metrics, and smart contract event emissions.</CardDescription>
              </div>
              <Button size="sm" onClick={() => navigate('/blockchain-explorer')}>
                Open Full Ledger Explorer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentEvents.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#6B726B]">
                <p>No events recorded.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Transaction Hash</TableHead>
                    <TableHead>Block Height</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((ev: any) => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <span className="font-mono font-semibold text-[10px] px-2.5 py-0.5 rounded-full bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]">
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

      {/* Tab 7: Activity & Audit Logs */}
      {activeTab === 'logs' && (
        <Card>
          <CardHeader>
            <CardTitle>System Activity & Security Audit Logs</CardTitle>
            <CardDescription>Chronological log of administrative events, identity activations, and security actions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {auditLogs.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#6B726B]">
                <Clock className="h-8 w-8 mx-auto text-[#D4CBBC] mb-2" />
                <p>No security audit log entries recorded.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-[#8F764F] bg-[#B49A70]/15 px-2 py-0.5 rounded-full border border-[#B49A70]/30">
                          {log.activity_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-[#252B28]">{log.description}</TableCell>
                      <TableCell className="font-mono text-xs text-[#6B726B]">{log.ip_address || '127.0.0.1'}</TableCell>
                      <TableCell className="text-xs text-[#6B726B]">{formatDate(log.created_at)}</TableCell>
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
export default AdminDashboard
