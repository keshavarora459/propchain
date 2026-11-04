import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Building2,
  FileBadge,
  ArrowLeftRight,
  Cpu,
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
import { formatCurrency, formatDate, truncateHash, getPropertyLabel, getRoleLabel, getVerificationLabel } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'
import authService from '@/services/authService'
import { propertyService } from '@/services/propertyService'

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'roles' | 'properties' | 'transactions' | 'blockchain' | 'logs'>('overview')
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [userList, setUserList] = useState<any[]>([])
  const [propertyList, setPropertyList] = useState<any[]>([])

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
    <div className="space-y-6">
      <PageHeader
        title={`Enterprise Administration Console: ${user?.full_name || 'System Administrator'}`}
        description="Comprehensive network oversight: manage user credentials, monitor real estate listings, inspect atomic escrow transactions, and audit consensus telemetry."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAdminData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh Telemetry
            </Button>
            <Link to="/admin/users">
              <Button size="sm" leftIcon={<Users className="h-4 w-4" />}>
                User & Role Management
              </Button>
            </Link>
          </div>
        }
      />

      {/* Admin KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Registered Network Users"
          value={(adminMetrics?.total_users_count ?? userList.length).toString()}
          subtitle={`${adminMetrics?.active_users_count ?? userList.length} Active accounts across roles`}
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Cataloged Properties"
          value={(dashboardData?.total_properties ?? propertyList.length).toString()}
          subtitle={`${dashboardData?.verified_properties ?? 0} Verified properties`}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title="Platform Gross Valuation"
          value={formatCurrency(dashboardData?.total_valuation_usd ?? 0)}
          subtitle="Consolidated land value in catalog"
          icon={<FileBadge className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Active Conveyances"
          value={(dashboardData?.active_transactions ?? 0).toString()}
          subtitle={`${dashboardData?.completed_transactions ?? 0} Completed sales`}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          iconBg="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Platform Overview' },
          { id: 'users', label: 'User Management', count: userList.length },
          { id: 'roles', label: 'Role & Permissions Matrix' },
          { id: 'properties', label: 'Property Management', count: propertyList.length },
          { id: 'transactions', label: 'Transaction Monitoring', count: recentTransactions.length },
          { id: 'blockchain', label: 'Blockchain Monitoring', count: recentEvents.length },
          { id: 'logs', label: 'Activity & Audit Logs', count: auditLogs.length },
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
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p>No transactions registered yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction #</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.slice(0, 5).map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs font-semibold text-blue-600">{t.transaction_number}</TableCell>
                          <TableCell className="font-medium text-slate-900 text-xs">{t.property_title}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">{formatCurrency(t.purchase_price)}</TableCell>
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
                  <CardTitle>Recent User Sign-ups & Logins</CardTitle>
                  <Link to="/admin/users">
                    <Button size="sm" variant="outline" className="text-xs">
                      Directory
                    </Button>
                  </Link>
                </div>
                <CardDescription>Accounts provisioned across network roles.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {userList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
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
                          <TableCell className="font-medium text-slate-900 text-xs">{u.full_name}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-600">{u.email}</TableCell>
                          <TableCell>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
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

      {/* Tab 2: User Management */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Registered Network Accounts</CardTitle>
                <CardDescription>Administrative view of authenticated identity accounts.</CardDescription>
              </div>
              <Link to="/admin/users">
                <Button size="sm">Open Full User Management Page</Button>
              </Link>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {userList.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-slate-900 text-xs">{u.full_name}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{u.email}</TableCell>
                    <TableCell>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {getRoleLabel(u.role)}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={u.account_status} /></TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(u.created_at)}</TableCell>
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold">
                    <th className="p-3 border border-slate-200">Permission</th>
                    <th className="p-3 border border-slate-200 text-center">Buyer</th>
                    <th className="p-3 border border-slate-200 text-center">Seller</th>
                    <th className="p-3 border border-slate-200 text-center">Verifier</th>
                    <th className="p-3 border border-slate-200 text-center">Legal Authority</th>
                    <th className="p-3 border border-slate-200 text-center">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-3 font-medium">view_dashboard</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">register_property</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">initiate_transaction</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">verify_documents</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">confirm_legal_registration</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-purple-700 font-bold bg-purple-50">✓ (Exclusive)</td>
                    <td className="p-3 text-center text-red-500 font-semibold bg-red-50">✕ (Restricted)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">manage_users</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓</td>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Network Properties Catalog</CardTitle>
                <CardDescription>Administrative view of all registered properties.</CardDescription>
              </div>
              <Link to="/properties">
                <Button size="sm" variant="outline" className="text-xs">
                  All Properties View
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcel ID</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Valuation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyList.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-slate-700">{p.propertyId}</TableCell>
                    <TableCell className="font-medium text-slate-900 text-xs">
                      <Link to={`/properties/${p.id}`} className="hover:text-blue-600">
                        {getPropertyLabel(p)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{p.propertyType}</TableCell>
                    <TableCell className="text-xs text-slate-600">{p.city}, {p.state}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">{formatCurrency(p.valuation)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell><StatusBadge status={p.verificationStatus} label={getVerificationLabel(p, user?.role)} /></TableCell>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Global Transaction Monitoring Ledger</CardTitle>
                <CardDescription>All purchase and escrow proposals moving through consensus settlement.</CardDescription>
              </div>
              <Link to="/transactions">
                <Button size="sm" variant="outline" className="text-xs">
                  Escrow Dashboard
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <p>No transactions found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Property</TableHead>
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
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">{tx.transaction_number}</TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(tx)}</TableCell>
                      <TableCell className="text-xs text-slate-600">{tx.buyer_name}</TableCell>
                      <TableCell className="text-xs text-slate-600">{tx.seller_name}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{formatCurrency(tx.purchase_price)}</TableCell>
                      <TableCell><StatusBadge status={tx.status} /></TableCell>
                      <TableCell className="font-mono text-xs text-blue-600">
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-indigo-600" />
                  EVM Blockchain Network Monitoring
                </CardTitle>
                <CardDescription>Hardhat node 31337 blocks, gas metrics, and smart contract event emissions.</CardDescription>
              </div>
              <Link to="/blockchain-explorer">
                <Button size="sm">Open Full Ledger Explorer</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <p>No events recorded.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Transaction Hash</TableHead>
                    <TableHead>Block Height</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((ev: any) => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <span className="font-mono font-semibold text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
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

      {/* Tab 7: Activity & Audit Logs */}
      {activeTab === 'logs' && (
        <Card>
          <CardHeader>
            <CardTitle>System Activity & Security Audit Logs</CardTitle>
            <CardDescription>Chronological log of administrative events, identity activations, and security actions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
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
                        <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {log.activity_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-800">{log.description}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{log.ip_address || '127.0.0.1'}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(log.created_at)}</TableCell>
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
