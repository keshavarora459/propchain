import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  FileCheck2,
  CheckSquare,
  CheckCircle2,
  RefreshCw,
  XCircle,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { formatCurrency, formatDate, truncateHash, getPropertyLabel, getVerificationLabel } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'
import { propertyService } from '@/services/propertyService'

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'overview' | 'assigned' | 'verified' | 'manage' | 'progress' | 'tracking' | 'activities'>('overview')
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [allProperties, setAllProperties] = useState<any[]>([])
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [propertyVerifyErrors, setPropertyVerifyErrors] = useState<
    Record<string, { message: string; duplicatePropName?: string }>
  >({})
  const [recentlyVerifiedIds, setRecentlyVerifiedIds] = useState<Set<string>>(new Set())

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
  const submittedProps = (verifierMetrics?.properties_to_verify || allProperties).filter((p: any) => {
    const s = (p.verification_status || p.verificationStatus || '').toString().toUpperCase()
    return (
      s === 'SUBMITTED' ||
      s === 'CORRECTION_REQUESTED' ||
      s === 'REQUIRES_CORRECTION' ||
      recentlyVerifiedIds.has(p.id) ||
      recentlyVerifiedIds.has(p.propertyId)
    )
  })
  const verifiedProps = allProperties.filter((p) => {
    const s = (p.verification_status || p.verificationStatus || '').toString().toUpperCase()
    return s === 'VERIFIED'
  })
  const verifiedCount = dashboardData?.verified_properties ?? dashboardData?.verifier_metrics?.verified_properties_count ?? verifiedProps.length
  const recentDocs = verifierMetrics?.recent_documents || verifierMetrics?.documents_queue || []

  const handleVerifyPropertyAction = async (propId: string) => {
    setActionInProgress(propId)
    setPropertyVerifyErrors((prev) => {
      const next = { ...prev }
      delete next[propId]
      return next
    })
    try {
      const res = await propertyService.verifyProperty(propId)
      setAllProperties((prev) =>
        prev.map((p) =>
          p.id === propId || p.propertyId === propId
            ? { ...p, ...res, verification_status: 'VERIFIED', verificationStatus: 'Verified', status: 'ACTIVE' }
            : p
        )
      )
      setRecentlyVerifiedIds((prev) => new Set(prev).add(propId))
      setDashboardData((prev: any) => ({
        ...prev,
        verified_properties: (prev?.verified_properties ?? 0) + 1,
        verifier_metrics: {
          ...prev?.verifier_metrics,
          verified_properties_count: (prev?.verifier_metrics?.verified_properties_count ?? 0) + 1,
          properties_to_verify_count: Math.max(0, (prev?.verifier_metrics?.properties_to_verify_count ?? 1) - 1),
        },
      }))
      const blkStr = res.blockchain_block_number ? `Block #${res.blockchain_block_number}` : ''
      const txStr = (res.blockchain_tx_hash || res.anchor_tx_hash) ? ` (Tx: ${truncateHash(res.blockchain_tx_hash || res.anchor_tx_hash || '', 8, 6)})` : ''
      setActionMessage(`✓ Property verified on blockchain ${blkStr}${txStr} and marked active on the marketplace.`)
      loadAgentData()
      setTimeout(() => setActionMessage(null), 8000)
    } catch (err: any) {
      console.error('Failed to verify property:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Failed to verify property'
      
      let duplicatePropName: string | undefined
      if (errorMsg.toLowerCase().includes('duplicate')) {
        const match = errorMsg.match(/'([^']+)'\s+is a duplicate of\s+([^.]+)/i)
        if (match) {
          duplicatePropName = match[2].trim()
        }
      }

      setPropertyVerifyErrors((prev) => ({
        ...prev,
        [propId]: {
          message: errorMsg,
          duplicatePropName,
        },
      }))
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Title Verification & Accreditation Console`}
        description={`Welcome, ${user?.full_name || 'Land Registrar'}. Examine cadastral deeds, validate SHA-256 cryptographic hashes, audit surveyor maps, and certify luxury estates.`}
        actions={
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={loadAgentData} leftIcon={<RefreshCw className="h-3.5 w-3.5 text-[#657565]" />}>
              Refresh Queue
            </Button>
            <Button size="sm" onClick={() => navigate('/documents')} leftIcon={<FileCheck2 className="h-4 w-4" />}>
              Document Queue
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

      {/* Verifier Stat Cards - Luxury Theme */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Residences to Audit"
          value={submittedProps.length.toString()}
          subtitle={submittedProps.length > 0 ? 'Awaiting registrar verification' : 'Queue fully inspected'}
          icon={<Building2 className="h-5 w-5 text-[#657565]" />}
          iconBg="bg-[#EAE4D9]/60"
        />
        <div
          onClick={() => setActiveTab('verified')}
          className="cursor-pointer transition-transform hover:scale-[1.01]"
          title="Click to view verified properties"
        >
          <StatCard
            title="Certified On-Chain"
            value={verifiedCount.toString()}
            subtitle="Accredited for marketplace offers"
            icon={<CheckSquare className="h-5 w-5 text-[#B49A70]" />}
            iconBg="bg-[#FAF8F3]"
          />
        </div>
        <StatCard
          title="Pending Document Audits"
          value={(verifierMetrics?.pending_documents_count ?? recentDocs.length).toString()}
          subtitle="Deeds awaiting OCR inspection"
          icon={<FileCheck2 className="h-5 w-5 text-[#657565]" />}
          iconBg="bg-[#EAE4D9]/60"
        />
        <StatCard
          title="Pending Sign-Off Tasks"
          value={(verifierMetrics?.pending_approval_tasks_count ?? 0).toString()}
          subtitle="Conveyance deals awaiting approval"
          icon={<ShieldCheck className="h-5 w-5 text-[#B49A70]" />}
          iconBg="bg-[#FAF8F3]"
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Registrar Overview' },
          { id: 'assigned', label: 'Assigned Residences', count: submittedProps.length },
          { id: 'verified', label: 'Certified Residences', count: verifiedCount },
          { id: 'manage', label: 'Property Registry', count: allProperties.length },
          { id: 'progress', label: 'Verification Progress' },
          { id: 'tracking', label: 'Client Tracking' },
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
                  <CardTitle>Priority Residences for Inspection</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('assigned')} className="text-xs">
                    View All ({submittedProps.length})
                  </Button>
                </div>
                <CardDescription>Parcels submitted by estate owners awaiting title deed validation.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {submittedProps.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#6B726B]">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-[#657565] mb-2" />
                    <p className="font-semibold text-[#252B28]">Verification queue is completely up to date!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Residence</TableHead>
                        <TableHead>Seller</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Deeds</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submittedProps.slice(0, 4).map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(p)}</TableCell>
                          <TableCell className="text-xs text-[#6B726B]">{p.seller_name || p.owner_name || 'Seller'}</TableCell>
                          <TableCell className="text-xs text-[#6B726B]">{formatDate(p.submitted_at || p.created_at)}</TableCell>
                          <TableCell className="text-xs font-mono text-[#252B28]">{p.approved_docs_count ?? 0}/4 docs</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/documents?propertyId=${p.id}`)}
                              className="text-xs h-8 px-2.5"
                            >
                              Audit
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
                  <CardTitle>Pending Deeds Queue</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => navigate('/documents')} className="text-xs">
                    Review All
                  </Button>
                </div>
                <CardDescription>Individual deeds, tax receipts, and surveys queued for OCR clearance.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {recentDocs.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#6B726B]">
                    <p>No deeds currently in pending queue.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentDocs.slice(0, 4).map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-[#252B28] text-xs">{d.title || d.file_name}</TableCell>
                          <TableCell className="text-xs text-[#6B726B]">{d.document_type}</TableCell>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Assigned Residences for Official Verification</CardTitle>
                <CardDescription>Parcels requiring cadastral examination and cryptographic blockchain anchoring.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={loadAgentData} className="text-xs">
                Refresh Queue
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {submittedProps.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <CheckCircle2 className="h-10 w-10 mx-auto text-[#657565] mb-2" />
                <p className="text-sm font-semibold text-[#252B28]">No properties awaiting verification</p>
                <p className="mt-1 font-light">All submitted parcels have been accredited.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcel ID</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Inspection & Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submittedProps.map((p: any) => {
                    const isPropVerified =
                      (p.verification_status || p.verificationStatus || '').toString().toUpperCase() === 'VERIFIED' ||
                      recentlyVerifiedIds.has(p.id) ||
                      recentlyVerifiedIds.has(p.propertyId)

                    return (
                      <React.Fragment key={p.id}>
                        <TableRow>
                          <TableCell className="font-mono text-xs font-semibold text-[#657565]">{p.property_number || p.propertyId}</TableCell>
                          <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(p)}</TableCell>
                          <TableCell className="text-xs text-[#6B726B]">{p.seller_name || p.owner_name || p.currentOwner || 'Seller'}</TableCell>
                          <TableCell className="text-xs text-[#6B726B] whitespace-nowrap">{formatDate(p.submitted_at || p.created_at)}</TableCell>
                          <TableCell className="text-xs text-[#252B28] font-mono whitespace-nowrap">{p.approved_docs_count ?? 0} of 4 documents</TableCell>
                          <TableCell>
                            <StatusBadge status={p.verification_status || p.verificationStatus || 'SUBMITTED'} label={getVerificationLabel(p, user?.role, p.approved_docs_count ?? p.approved_documents_count, 4)} />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {isPropVerified ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#657565]/15 text-[#3F4B3F] border border-[#657565]/30 text-xs font-medium">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-[#657565] shrink-0" />
                                    Verified ✓
                                  </span>
                                  <span className="text-xs font-mono font-medium text-[#252B28] bg-[#FAF8F3] px-2 py-0.5 rounded-full border border-[#E8E2D5]">
                                    {p.blockchain_block_number ? `Block #${p.blockchain_block_number}` : 'Block #1'}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/properties/${p.id}`)}
                                    className="text-xs h-8 px-2.5"
                                  >
                                    Details
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/documents?propertyId=${p.id}`)}
                                    className="text-xs h-8"
                                  >
                                    Review Deeds
                                  </Button>
                                  {(p.approved_docs_count ?? 0) === 4 && (
                                    <Button
                                      size="sm"
                                      disabled={actionInProgress === p.id}
                                      isLoading={actionInProgress === p.id}
                                      onClick={() => handleVerifyPropertyAction(p.id)}
                                      className="bg-[#657565] hover:bg-[#526152] text-white text-xs h-8"
                                    >
                                      {actionInProgress === p.id ? 'Certifying...' : 'Verify Property'}
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {propertyVerifyErrors[p.id] && (
                          <TableRow className="bg-rose-50/50 hover:bg-rose-50/60 border-b border-rose-200">
                            <TableCell colSpan={7} className="p-3">
                              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-300 bg-rose-50 text-xs text-rose-900">
                                <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold text-rose-950">Verification Failed: </span>
                                  <span>{propertyVerifyErrors[p.id].message}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Certified Properties */}
      {activeTab === 'verified' && (
        <Card>
          <CardHeader>
            <CardTitle>Certified Residences Vault</CardTitle>
            <CardDescription>Residences successfully accredited and anchored onto EVM smart contract state.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {verifiedProps.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B726B]">
                <p>No verified properties in ledger.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcel ID</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Valuation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifiedProps.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs text-[#657565]">{p.propertyId || p.property_number}</TableCell>
                      <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(p)}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(p.valuation || p.price)}</TableCell>
                      <TableCell><StatusBadge status="VERIFIED" /></TableCell>
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

      {/* Tab 4: Property Registry */}
      {activeTab === 'manage' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Complete Land Registry</CardTitle>
                <CardDescription>All parcels registered across the network.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/properties')} className="text-xs">
                Properties Page
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcel</TableHead>
                  <TableHead>Residence</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Valuation</TableHead>
                  <TableHead>Verification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allProperties.slice(0, 10).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-[#657565]">{p.propertyId || p.property_number}</TableCell>
                    <TableCell className="font-semibold text-[#252B28] text-xs">{getPropertyLabel(p)}</TableCell>
                    <TableCell className="text-xs text-[#6B726B]">{p.propertyType}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-[#252B28]">{formatCurrency(p.valuation || p.price)}</TableCell>
                    <TableCell><StatusBadge status={p.verification_status || p.verificationStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Progress */}
      {activeTab === 'progress' && (
        <Card>
          <CardHeader>
            <CardTitle>Accreditation Throughput & Milestones</CardTitle>
            <CardDescription>Inspection velocity metrics for cadastral surveys and deeds.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 text-xs text-[#6B726B] space-y-4">
            <div className="p-5 rounded-2xl border border-[#E8E2D5] bg-[#FAF8F3] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#6B726B]">Total Verified Parcels</span>
                <span className="font-bold text-[#252B28] text-base">{verifiedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B726B]">Deeds in Review</span>
                <span className="font-semibold text-[#657565]">{submittedProps.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Tracking */}
      {activeTab === 'tracking' && (
        <Card>
          <CardHeader>
            <CardTitle>Deed Audits & Client Pipeline</CardTitle>
            <CardDescription>Track conveyance transactions passing through title validation.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 text-center text-xs text-[#6B726B]">
            <p>Active transactions and conveyance deals are monitored through the escrow pipeline.</p>
            <Button size="sm" onClick={() => navigate('/transactions')} className="mt-4">
              Open Conveyance Registry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tab 7: Activities */}
      {activeTab === 'activities' && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Inspection Activities</CardTitle>
            <CardDescription>Recent actions logged by accredited registrars.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 text-center text-xs text-[#6B726B]">
            <p>All verification approvals are anchored to smart contracts and signed by authenticated registrars.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default AgentDashboard
