import React, { useState } from 'react'
import { Cpu, Search, Blocks, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { MOCK_BLOCKS, MOCK_BLOCKCHAIN_TXS, MOCK_NETWORK_STATUS } from '@/mock-data/blockchain'
import { truncateHash, formatDate } from '@/lib/utils'

export const BlockchainExplorerPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<any | null>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResult(null)
      return
    }

    const matchedTx = MOCK_BLOCKCHAIN_TXS.find(
      (tx) => tx.hash.toLowerCase() === searchQuery.trim().toLowerCase()
    )
    const matchedBlock = MOCK_BLOCKS.find(
      (b) => String(b.blockNumber) === searchQuery.trim() || b.hash.toLowerCase() === searchQuery.trim().toLowerCase()
    )

    if (matchedTx) {
      setSearchResult({ type: 'transaction', data: matchedTx })
    } else if (matchedBlock) {
      setSearchResult({ type: 'block', data: matchedBlock })
    } else {
      setSearchResult({
        type: 'not_found',
        query: searchQuery,
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decentralized Ledger Explorer"
        description="Inspect on-chain blocks, cryptographic transaction hashes, smart contract state transitions, and emission events."
      />

      {/* Hero Search Bar */}
      <Card className="bg-slate-950 text-white border-slate-800">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by block number, tx hash (0x...), address or token contract..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <Button type="submit" leftIcon={<Search className="h-4 w-4" />}>
                Query Ledger
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono pt-1">
              <span>Chain: {MOCK_NETWORK_STATUS.networkName}</span>
              <span>• Chain ID: {MOCK_NETWORK_STATUS.chainId}</span>
              <span>• Latest Block: #{MOCK_NETWORK_STATUS.latestBlock}</span>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Query Search Result (if searched) */}
      {searchResult && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Query Result Inspection</CardTitle>
            <button
              onClick={() => {
                setSearchResult(null)
                setSearchQuery('')
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          </CardHeader>
          <CardContent className="text-xs">
            {searchResult.type === 'transaction' ? (
              <div className="space-y-2 font-mono">
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Tx Hash:</span>
                  <span className="font-bold text-slate-900 break-all">{searchResult.data.hash}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Block Number:</span>
                  <span className="text-blue-700">#{searchResult.data.blockNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Sender (From):</span>
                  <span className="text-slate-800">{searchResult.data.from}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Receiver (To):</span>
                  <span className="text-slate-800">{searchResult.data.to}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Emitted Event:</span>
                  <span className="text-emerald-700 font-semibold">{searchResult.data.event}</span>
                </div>
              </div>
            ) : searchResult.type === 'block' ? (
              <div className="space-y-2 font-mono">
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Block Height:</span>
                  <span className="font-bold text-slate-900">#{searchResult.data.blockNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Hash:</span>
                  <span className="text-slate-800 break-all">{searchResult.data.hash}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Transactions:</span>
                  <span className="text-slate-800">{searchResult.data.transactionsCount} txs included</span>
                </div>
              </div>
            ) : (
              <p className="text-slate-600">
                No matching block or transaction found for query "{searchResult.query}". Please check the hash format.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Blocks & Recent Transactions Dual Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Latest Blocks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Blocks className="h-4 w-4 text-blue-600" />
              <CardTitle>Latest Verified Blocks</CardTitle>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 font-medium">12s Avg Block Time</span>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0 text-xs">
            {MOCK_BLOCKS.map((blk) => (
              <div key={blk.blockNumber} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600">#{blk.blockNumber}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{formatDate(blk.timestamp)}</span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-400 mt-1">
                    Hash: {truncateHash(blk.hash, 8, 6)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                    {blk.transactionsCount} txs
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">{blk.gasUsed}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Latest Ledger Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-slate-800" />
              <CardTitle>Recent Consensus Transactions</CardTitle>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Validated</span>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0 text-xs">
            {MOCK_BLOCKCHAIN_TXS.map((tx) => (
              <div key={tx.hash} className="p-4 space-y-1.5 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-900">
                    {truncateHash(tx.hash, 8, 6)}
                  </span>
                  <StatusBadge status="Confirmed" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>From: {truncateHash(tx.from, 6, 4)}</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span>To: {truncateHash(tx.to, 6, 4)}</span>
                </div>
                <p className="text-[11px] font-mono text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded truncate">
                  {tx.event}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
