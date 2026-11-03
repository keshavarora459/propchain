import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Building2,
  FileCheck2,
  CheckSquare,
  CheckCircle2,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { formatCurrency, formatDate, truncateHash, getPropertyLabel } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'
import { propertyService } from '@/services/propertyService'

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'overview' | 'assigned' | 'manage' | 'progress' | 'tracking' | 'activities'>('overview')
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [allProperties, setAllProperties] = useState<any[]>([])
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadAgentData = async () => {
    try {
      const [dashRes, propsRes] = await Promise.allSettled([
        apiClient.get('/analytics/dashboard'),
        propertyService.getProperties({ page_size: 50 }),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value.data) {
        setDashboardData(dashRes.value.data)
      }
      if (propsRes.status === 'fulfilled' && propsRes.value.items) {
        setAllProperties(propsRes.value.items)
      }
    } catch (err) {
      console.error('Failed to load agent dashboard data:', err)
    }
  }

  useEffect(() => {
    loadAgentData()
  }, [])

  const verifierMetrics = dashboardData?.verifier_metrics || {}
  const pendingProps = verifierMetrics?.properties_to_verify || allProperties.filter((p) => p.verificationStatus === 'PENDING')
  const recentDocs = verifierMetrics?.recent_documents || []

  const handleVerifyPropertyAction = async (propId: string) => {
    setActionInProgress(propId)
    try {
      await propertyService.updatePropertyStatus(propId, { verification_status: 'VERIFIED' })
      setActionMessage('✓ Property verified successfully and marked eligible for marketplace transactions.')
      await loadAgentData()
      setTimeout(() => setActionMessage(null), 5000)
    } catch (err: any) {
      console.error('Failed to verify property:', err)
      setActionMessage(`Error verifying property: ${err.response?.data?.message || err.message}`)
      setTimeout(() => setActionMessage(null), 5000)
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Title Verification Console: ${user?.full_name || 'Agent Verifier'}`}
        description="Review submitted cadastral records, perform deed verification, validate OCR documents, and approve properties for consensus settlement."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAgentData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh Queue
            </Button>
            <Link to="/documents">
              <Button size="sm" leftIcon={<FileCheck2 className="h-4 w-4" />}>
                Document Verification Queue
              </Button>
            </Link>
          </div>
        }
      />

      {actionMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* Verifier Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Properties Needing Verification"
          value={pendingProps.length.toString()}
          subtitle={pendingProps.length > 0 ? 'Requires title inspection' : 'Queue cleared'}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Verified Properties"
          value={(dashboardData?.verified_properties ?? 0).toString()}
          subtitle="Accredited for marketplace offers"
          icon={<CheckSquare className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Pending Document Reviews"
          value={(verifierMetrics?.pending_documents_count ?? recentDocs.length).toString()}
          subtitle="Scanned deeds awaiting OCR audit"
          icon={<FileCheck2 className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Pending Approval Tasks"
          value={(verifierMetrics?.pending_approval_tasks_count ?? 0).toString()}
          subtitle="Conveyance deals awaiting verifier sign-off"
          icon={<ShieldCheck className="h-5 w-5" />}
          iconBg="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Agent Overview' },
          { id: 'assigned', label: 'Assigned Properties', count: pendingProps.length },
          { id: 'manage', label: 'Property Registry', count: allProperties.length },
          { id: 'progress', label: 'Verification Progress' },
          { id: 'tracking', label: 'Client & Transaction Tracking' },
          { id: 'activities', label: 'Recent Activities' },
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
                  <CardTitle>High-Priority Properties for Review</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('assigned')} className="text-xs">
                    View All ({pendingProps.length})
                  </Button>
                </div>
                <CardDescription>Properties with pending verification submitted by property owners.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {pendingProps.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                    <p className="font-semibold text-slate-700">Verification queue is completely up to date!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Valuation</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingProps.slice(0, 4).map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(p)}</TableCell>
                          <TableCell className="text-xs text-slate-500">{p.city}, {p.state}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">{formatCurrency(p.valuation)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={actionInProgress === p.id}
                              onClick={() => handleVerifyPropertyAction(p.id)}
                              className="text-xs h-7 px-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Verify
                            </Button>
                          </TableCell>
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
                  <CardTitle>Recent Documents Submitted</CardTitle>
                  <Link to="/documents">
                    <Button size="sm" variant="outline" className="text-xs">
                      All Documents
                    </Button>
                  </Link>
                </div>
                <CardDescription>Title deeds and survey plans uploaded for review.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {recentDocs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p>No document submissions logged recently.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentDocs.slice(0, 4).map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-slate-900 text-xs">{d.title}</TableCell>
                          <TableCell className="text-xs text-slate-600">{d.document_type}</TableCell>
                          <TableCell><StatusBadge status={d.status} /></TableCell>
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

      {/* Tab 2: Assigned Properties */}
      {activeTab === 'assigned' && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Properties Awaiting Title Clearance</CardTitle>
            <CardDescription>Check registry boundaries, title deed consistency, and mark properties as Verified.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {pendingProps.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-slate-700">No pending properties</p>
                <p className="mt-1">All real estate property registrations have been verified.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcel ID</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Valuation</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead className="text-right">Inspection & Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingProps.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-800">{p.property_number || p.propertyId}</TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(p)}</TableCell>
                      <TableCell className="text-xs text-slate-600">{p.city}, {p.state}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900">{formatCurrency(p.valuation)}</TableCell>
                      <TableCell><StatusBadge status={p.verification_status || p.verificationStatus} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/properties/${p.id}`}>
                            <Button size="sm" variant="outline" className="text-xs h-8">
                              Inspect Title
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            disabled={actionInProgress === p.id}
                            onClick={() => handleVerifyPropertyAction(p.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                          >
                            {actionInProgress === p.id ? 'Verifying...' : 'Approve & Verify'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Property Registry */}
      {activeTab === 'manage' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Comprehensive Property Registry</CardTitle>
                <CardDescription>Browse and inspect all properties indexed across the PropChain network.</CardDescription>
              </div>
              <Link to="/properties">
                <Button size="sm" variant="outline" className="text-xs">
                  Full Property Search Bar
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
                  <TableHead>Verification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allProperties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-slate-600">{p.propertyId}</TableCell>
                    <TableCell className="font-medium text-slate-900 text-xs">
                      <Link to={`/properties/${p.id}`} className="hover:text-blue-600">
                        {getPropertyLabel(p)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{p.propertyType}</TableCell>
                    <TableCell className="text-xs text-slate-600">{p.city}, {p.state}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">{formatCurrency(p.valuation)}</TableCell>
                    <TableCell><StatusBadge status={p.verificationStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Verification Progress */}
      {activeTab === 'progress' && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastral Title Verification Checklist</CardTitle>
            <CardDescription>Multi-step technical & legal assurance procedure performed by certified title verifiers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Step 1: Scanned Deed Integrity & OCR Extraction</h4>
                  <p className="text-slate-500 mt-0.5">SHA-256 cryptographic hash calculated on deed upload; OCR extracts owner name, boundary coordinates, and prior conveyance stamps.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-3 border-t border-slate-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Step 2: Title Verifier Manual Inspection</h4>
                  <p className="text-slate-500 mt-0.5">Cross-reference government land records against seller identity to ensure zero undisclosed encumbrances or duplicate claims.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-3 border-t border-slate-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Step 3: Smart Contract Consensus Anchoring</h4>
                  <p className="text-slate-500 mt-0.5">Upon approval, property state switches to VERIFIED on-chain, unlocking buyer escrow deposits and automated conveyance execution.</p>
                </div>
              </div>
            </div>
            <Link to="/documents">
              <Button size="sm" className="mt-2">
                Open Documents Inspection Console
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Client & Transaction Tracking */}
      {activeTab === 'tracking' && (
        <Card>
          <CardHeader>
            <CardTitle>Conveyance Transactions Under Title Review</CardTitle>
            <CardDescription>Deals currently undergoing title verification before advancing to statutory legal recording.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(!dashboardData?.recent_transactions || dashboardData.recent_transactions.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <p>No active transactions requiring verifier review at this time.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Escrow Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.recent_transactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">{tx.transaction_number}</TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(tx)}</TableCell>
                      <TableCell className="text-xs text-slate-600">{tx.buyer_name}</TableCell>
                      <TableCell className="text-xs text-slate-600">{tx.seller_name}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{formatCurrency(tx.purchase_price)}</TableCell>
                      <TableCell><StatusBadge status={tx.status} /></TableCell>
                      <TableCell className="text-right">
                        <Link to="/approvals">
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            Review Deal
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

      {/* Tab 6: Recent Activities */}
      {activeTab === 'activities' && (
        <Card>
          <CardHeader>
            <CardTitle>Verifier Audit Trail & Blockchain Events</CardTitle>
            <CardDescription>Real-time audit log of title verification approvals and consensus blocks.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(!dashboardData?.recent_events || dashboardData.recent_events.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <p>No recent activity events found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>TX Hash</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.recent_events.map((ev: any) => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                          {ev.event_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-900">{getPropertyLabel(ev)}</TableCell>
                      <TableCell className="font-mono text-xs text-blue-600">{truncateHash(ev.tx_hash)}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">#{ev.block_number || 1}</TableCell>
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
export default AgentDashboard
