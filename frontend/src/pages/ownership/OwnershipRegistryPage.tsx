  import React, { useState } from 'react'
import { FileBadge, History, Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Timeline, type TimelineEvent } from '@/components/common/Timeline'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { MOCK_OWNERSHIP_RECORDS } from '@/mock-data/ownership'
import { formatCurrency, truncateHash } from '@/lib/utils'

export const OwnershipRegistryPage: React.FC = () => {
  const [selectedRecordId, setSelectedRecordId] = useState<string>(MOCK_OWNERSHIP_RECORDS[0].id)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredRecords = MOCK_OWNERSHIP_RECORDS.filter(
    (rec) =>
      rec.propertyTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.propertyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.currentOwnerName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeRecord =
    MOCK_OWNERSHIP_RECORDS.find((rec) => rec.id === selectedRecordId) || MOCK_OWNERSHIP_RECORDS[0]

  const timelineEvents: TimelineEvent[] = activeRecord.history.map((h, idx) => ({
    id: h.id,
    title: `${h.transferType}: ${h.ownerName}`,
    description: `Settlement Consideration: ${formatCurrency(h.transferAmount)} • Block #${h.blockNumber}`,
    date: h.fromDate,
    actor: h.verifiedBy,
    status: idx === 0 ? 'current' : 'completed',
    details: (
      <div className="bg-slate-50 p-2.5 rounded border border-slate-200/80 font-mono text-[11px] space-y-1">
        <p className="text-slate-500">
          Owner Wallet: <span className="text-slate-800">{h.ownerWallet}</span>
        </p>
        <p className="text-slate-500 truncate">
          On-Chain Proof: <span className="text-blue-600">{truncateHash(h.transactionHash, 10, 8)}</span>
        </p>
      </div>
    ),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Title & Ownership Registry"
        description="Chronological, cryptographically verifiable deed provenance traced to original cadastral grant."
      />

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
            {filteredRecords.map((rec) => {
              const isSelected = rec.id === activeRecord.id
              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecordId(rec.id)}
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
                    <span className="text-[11px] font-medium text-slate-500">
                      Block #{rec.blockchainBlockNumber}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">
                    {rec.propertyTitle}
                  </h4>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span className="truncate max-w-[160px]">{rec.currentOwnerName}</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(rec.purchasePrice)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Detailed Historical Provenance Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{activeRecord.propertyTitle}</CardTitle>
                <CardDescription>
                  Parcel {activeRecord.propertyId} • Current Legal Title Holder:{' '}
                  <strong className="text-slate-800">{activeRecord.currentOwnerName}</strong>
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
                  <span className="text-xs font-semibold text-slate-800">
                    {activeRecord.acquisitionType}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Latest Price
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {formatCurrency(activeRecord.purchasePrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Total Conveyances
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {activeRecord.history.length} Transfers
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
      </div>
    </div>
  )
}
