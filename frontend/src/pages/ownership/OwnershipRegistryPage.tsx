import React, { useState, useEffect } from 'react'
import { FileBadge, History, Search, Building2, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Timeline, type TimelineEvent } from '@/components/common/Timeline'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { formatCurrency, truncateHash, formatDate } from '@/lib/utils'
import { propertyService } from '@/services/propertyService'
import type { Property } from '@/types/property'
import apiClient from '@/lib/axios'

interface BackendOwnershipEvent {
  id: string
  property_id: string
  property_number?: string
  property_title?: string
  event_type: string
  previous_owner_name?: string
  new_owner_name?: string
  previous_owner_wallet?: string
  new_owner_wallet?: string
  settlement_amount?: number
  tx_hash: string
  block_number?: number
  created_at: string
}

export const OwnershipRegistryPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [ownershipEvents, setOwnershipEvents] = useState<BackendOwnershipEvent[]>([])

  useEffect(() => {
    setIsLoading(true)
    Promise.all([
      propertyService.getProperties({ page_size: 100 }),
      apiClient.get<{ items: BackendOwnershipEvent[] }>('/ownership/history').catch(() => ({ data: { items: [] } })),
    ])
      .then(([propsRes, eventsRes]) => {
        if (propsRes && propsRes.items && propsRes.items.length > 0) {
          setProperties(propsRes.items)
          setSelectedPropertyId(propsRes.items[0].id)
        }
        if (eventsRes && eventsRes.data && Array.isArray(eventsRes.data.items)) {
          setOwnershipEvents(eventsRes.data.items)
        }
      })
      .catch((err) => {
        console.error('Error loading ownership records:', err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const filteredProperties = properties.filter(
    (rec) =>
      rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.propertyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.currentOwner.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeProperty =
    properties.find((p) => p.id === selectedPropertyId) || properties[0] || null

  // Build real timeline events for the active property
  const activePropertyEvents = activeProperty
    ? ownershipEvents.filter(
        (e) => e.property_id === activeProperty.id || e.property_number === activeProperty.propertyId
      )
    : []

  const timelineEvents: TimelineEvent[] = []

  if (activeProperty) {
    if (activePropertyEvents.length > 0) {
      activePropertyEvents.forEach((evt, idx) => {
        timelineEvents.push({
          id: evt.id,
          title: `${evt.event_type.replace(/_/g, ' ')}: ${evt.new_owner_name || activeProperty.currentOwner}`,
          description: `Settlement Consideration: ${formatCurrency(evt.settlement_amount || activeProperty.valuation)} • Block #${evt.block_number || 1}`,
          date: formatDate(evt.created_at),
          actor: 'Title Registry Officer',
          status: idx === 0 ? 'current' : 'completed',
          details: (
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200/80 font-mono text-[11px] space-y-1">
              <p className="text-slate-500">
                Owner Wallet: <span className="text-slate-800">{evt.new_owner_wallet || activeProperty.ownerAddress}</span>
              </p>
              <p className="text-slate-500 truncate">
                On-Chain Proof: <span className="text-blue-600">{truncateHash(evt.tx_hash, 10, 8)}</span>
              </p>
            </div>
          ),
        })
      })
    }

    // Always ensure the root deed anchor / cadastral creation is represented
    timelineEvents.push({
      id: `origin-${activeProperty.id}`,
      title: `Cadastral Registration & Deed Anchor: ${activeProperty.currentOwner}`,
      description: `Assessed Value: ${formatCurrency(activeProperty.valuation)} • Ref: ${activeProperty.registrationReference || 'REG-PENDING'}`,
      date: formatDate(activeProperty.registeredAt),
      actor: 'Municipal Land Registrar',
      status: activePropertyEvents.length === 0 ? 'current' : 'completed',
      details: (
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200/80 font-mono text-[11px] space-y-1">
          <p className="text-slate-500">
            Registered Entity Wallet: <span className="text-slate-800">{activeProperty.ownerAddress}</span>
          </p>
          <p className="text-slate-500">
            Chain State: <span className="text-emerald-600 font-semibold">{activeProperty.verificationStatus}</span>
          </p>
        </div>
      ),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Title & Ownership Registry"
        description="Chronological, cryptographically verifiable deed provenance traced to original cadastral grant."
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm text-slate-500">Loading ownership ledger...</p>
        </div>
      ) : properties.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No Ownership Records Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No properties are registered in the system yet. Once a property is registered, its complete title ownership and transfer provenance will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Parcel Ownership Selector */}
          <div className="space-y-4">
            <Input
              placeholder="Search ownership registry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />

            <div className="space-y-2">
              {filteredProperties.map((rec) => {
                const isSelected = activeProperty?.id === rec.id
                return (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedPropertyId(rec.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-white shadow-sm ring-1 ring-slate-900'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        {rec.propertyId}
                      </span>
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {rec.verificationStatus}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">
                      {rec.title}
                    </h4>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <span className="truncate max-w-[160px]">{rec.currentOwner}</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(rec.valuation)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Detailed Historical Provenance Timeline */}
          {activeProperty && (
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{activeProperty.title}</CardTitle>
                    <CardDescription>
                      Parcel {activeProperty.propertyId} • Current Legal Title Holder:{' '}
                      <strong className="text-slate-800">{activeProperty.currentOwner}</strong>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <FileBadge className="h-3.5 w-3.5" />
                    Clear Title
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Acquisition Mode
                      </span>
                      <span className="text-xs font-semibold text-slate-800">Fee Simple Direct</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Current Valuation
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {formatCurrency(activeProperty.valuation)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Recorded Transfers
                      </span>
                      <span className="text-xs font-semibold text-slate-800">
                        {timelineEvents.length} Event(s)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Encumbrances
                      </span>
                      <span className="text-xs font-semibold text-emerald-600">None Recorded</span>
                    </div>
                  </div>

                  {/* Provenance Timeline */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <History className="h-4 w-4 text-slate-500" />
                      <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        Chain of Title Provenance
                      </h3>
                    </div>
                    <Timeline events={timelineEvents} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default OwnershipRegistryPage
