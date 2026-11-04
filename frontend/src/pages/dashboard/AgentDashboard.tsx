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
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { HashDisplay } from '@/components/common/HashDisplay'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { formatCurrency, formatDate, truncateHash, getPropertyLabel, getVerificationLabel, checkDocumentTypeMismatch } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'
import { propertyService } from '@/services/propertyService'

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth()

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
  // Item 7: Assigned properties must show properties with verification status SUBMITTED or CORRECTION_REQUESTED
  const submittedProps = (verifierMetrics?.properties_to_verify || allProperties).filter((p) => {
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
    // Clear any previous error on retry (Requirement 1)
    setPropertyVerifyErrors((prev) => {
      const next = { ...prev }
      delete next[propId]
      return next
    })
    try {
      const res = await propertyService.verifyProperty(propId)
      // Immediately update local allProperties
      setAllProperties((prev) =>
        prev.map((p) =>
          p.id === propId || p.propertyId === propId
            ? { ...p, ...res, verification_status: 'VERIFIED', verificationStatus: 'Verified', status: 'ACTIVE' }
            : p
        )
      )
      setRecentlyVerifiedIds((prev) => new Set(prev).add(propId))
      // Immediately update dashboard count
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

      // Requirement 1 & 2: Show backend message in a red banner. Keep visible until verifier clicks Dismiss or retries.
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
          value={submittedProps.length.toString()}
          subtitle={submittedProps.length > 0 ? 'Awaiting title inspection' : 'Queue cleared'}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
        />
        <div
          onClick={() => setActiveTab('verified')}
          className="cursor-pointer transition-transform hover:scale-[1.01]"
          title="Click to view verified properties"
        >
          <StatCard
            title="Verified Properties"
            value={verifiedCount.toString()}
            subtitle="Accredited for marketplace offers"
            icon={<CheckSquare className="h-5 w-5" />}
            iconBg="bg-emerald-50 text-emerald-600"
          />
        </div>
        <StatCard
          title="Pending Document Reviews"
          value={(verifierMetrics?.pending_documents_count ?? recentDocs.length).toString()}
          subtitle="Documents awaiting review"
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
          { id: 'assigned', label: 'Assigned Properties', count: submittedProps.length },
          { id: 'verified', label: 'Verified Properties', count: verifiedCount },
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
                    View All ({submittedProps.length})
                  </Button>
                </div>
                <CardDescription>Properties with pending verification submitted by property owners.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {submittedProps.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                    <p className="font-semibold text-slate-700">Verification queue is completely up to date!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Seller</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submittedProps.slice(0, 4).map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-slate-900 text-xs">
                            <span title={getPropertyLabel(p)}>{getPropertyLabel(p)}</span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {p.seller_name || p.owner_name || p.currentOwner || 'Seller'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(p.submitted_at || p.created_at)}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 font-mono whitespace-nowrap">
                            {p.approved_docs_count ?? 0} of {p.total_docs_count ?? 4} documents
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Link to="/documents">
                              <Button size="sm" className="text-xs h-7 px-2.5">
                                Review
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
                          <TableCell className="text-xs text-slate-600">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{d.document_type}</span>
                              {checkDocumentTypeMismatch(d.title, d.document_type) && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs whitespace-nowrap"
                                  title={`File name "${d.title}" does not match classified document type "${d.document_type}".`}
                                >
                                  <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                  Check document type
                                </span>
                              )}
                            </div>
                          </TableCell>
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
            {submittedProps.length === 0 ? (
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
                    <TableHead>Seller</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Current Status</TableHead>
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
                          <TableCell className="font-mono text-xs font-semibold text-slate-800">{p.property_number || p.propertyId}</TableCell>
                          <TableCell className="font-medium text-slate-900 text-xs">{getPropertyLabel(p)}</TableCell>
                          <TableCell className="text-xs text-slate-600">{p.seller_name || p.owner_name || p.currentOwner || 'Seller'}</TableCell>
                          <TableCell className="text-xs text-slate-500 whitespace-nowrap">{formatDate(p.submitted_at || p.created_at)}</TableCell>
                          <TableCell className="text-xs text-slate-700 font-mono whitespace-nowrap">{p.approved_docs_count ?? 0} of 4 documents</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <StatusBadge status={p.verification_status || p.verificationStatus || 'SUBMITTED'} label={getVerificationLabel(p, user?.role, p.approved_docs_count ?? p.approved_documents_count, 4)} />
                              {p.allow_duplicate_override && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap" title="Dev duplicate override active">
                                  Dev Override
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {isPropVerified ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold shadow-2xs">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    Verified ✓
                                  </span>
                                  <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {p.blockchain_block_number ? `Block #${p.blockchain_block_number}` : 'Block #1'}
                                  </span>
                                  {(p.blockchain_tx_hash || p.anchor_tx_hash) && (
                                    <HashDisplay
                                      value={p.blockchain_tx_hash || p.anchor_tx_hash}
                                      explorerLink
                                      className="bg-transparent border-0 px-0 py-0 text-xs"
                                    />
                                  )}
                                  <Link to={`/properties/${p.id}`}>
                                    <Button size="sm" variant="outline" className="text-xs h-8 px-2.5">
                                      Details
                                    </Button>
                                  </Link>
                                </div>
                              ) : (
                                <>
                                  <Link to={`/documents?propertyId=${p.id}`}>
                                    <Button size="sm" variant="outline" className="text-xs h-8">
                                      Review Documents
                                    </Button>
                                  </Link>
                                  {(p.approved_docs_count ?? 0) === 4 && (
                                    <Button
                                      size="sm"
                                      disabled={actionInProgress === p.id}
                                      isLoading={actionInProgress === p.id}
                                      onClick={() => handleVerifyPropertyAction(p.id)}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                                    >
                                      {actionInProgress === p.id ? 'Verifying...' : 'Verify Property'}
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Red Banner inside property row on verification failure (Requirement 1 & 2) */}
                        {propertyVerifyErrors[p.id] && (
                          <TableRow className="bg-rose-50/50 hover:bg-rose-50/60 border-b border-rose-200">
                            <TableCell colSpan={7} className="p-3">
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-3 rounded-lg border border-rose-300 bg-rose-50 text-xs text-rose-900 shadow-2xs">
                                <div className="flex items-start gap-2.5">
                                  <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                  <div className="space-y-1">
                                    <span className="font-bold text-rose-950">Verification Failed: </span>
                                    <span className="text-rose-900">{propertyVerifyErrors[p.id].message}</span>
                                    {propertyVerifyErrors[p.id].duplicatePropName && (
                                      <div className="text-[11px] text-rose-800 font-medium mt-1">
                                        Duplicates property: <strong className="font-bold text-rose-950">{propertyVerifyErrors[p.id].duplicatePropName}</strong>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                                  <Link to={`/documents?propertyId=${p.id}`}>
                                    <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 border-rose-300 text-rose-800 hover:bg-rose-100 bg-white">
                                      {propertyVerifyErrors[p.id].duplicatePropName ? 'Fix in Queue' : 'Review Documents'}
                                    </Button>
                                  </Link>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-7 px-2 text-rose-700 hover:bg-rose-100"
                                    onClick={() =>
                                      setPropertyVerifyErrors((prev) => {
                                        const next = { ...prev }
                                        delete next[p.id]
                                        return next
                                      })
                                    }
                                  >
                                    Dismiss
                                  </Button>
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

      {/* Tab: Verified Properties */}
      {activeTab === 'verified' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Verified Properties on PropChain</CardTitle>
                <CardDescription>
                  Properties accredited and permanently anchored to the blockchain network.
                </CardDescription>
              </div>
              <span className="font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-semibold">
                {verifiedCount} Verified on-chain
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {verifiedProps.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <ShieldCheck className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No verified properties yet</p>
                <p className="mt-1">Properties verified through the Title Verification queue will appear here.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Verified Date</TableHead>
                      <TableHead>Verified By</TableHead>
                      <TableHead>Block Number</TableHead>
                      <TableHead>Transaction Hash</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verifiedProps.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-slate-900 text-xs">
                          <div>
                            <span className="font-semibold">{getPropertyLabel(p)}</span>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.property_number || p.propertyId}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {p.seller_name || p.owner_name || p.currentOwner || 'Seller'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(p.verified_at || p.blockchain_registration_timestamp || p.registeredAt || p.created_at)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                          {p.verified_by_name || 'Verifier'}
                        </TableCell>
                        <TableCell className="text-xs text-emerald-700 font-mono font-semibold whitespace-nowrap">
                          {p.blockchain_block_number ? `Block #${p.blockchain_block_number}` : 'Block #1'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <HashDisplay
                            value={p.blockchain_tx_hash || p.anchor_tx_hash}
                            explorerLink
                            className="bg-transparent border-0 px-0 py-0"
                          />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Link to={`/properties/${p.id}`}>
                            <Button size="sm" variant="outline" className="text-xs h-7 px-3">
                              Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                    <TableCell><StatusBadge status={p.verificationStatus} label={getVerificationLabel(p, user?.role)} /></TableCell>
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
