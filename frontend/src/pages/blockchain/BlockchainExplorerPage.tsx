import React, { useState, useEffect, useCallback } from 'react'
import { Cpu, Search, Blocks, ArrowRight, Loader2, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { truncateHash, formatDate } from '@/lib/utils'
import { ethers } from 'ethers'

interface RealBlock {
  blockNumber: number
  hash: string
  timestamp: string
  transactionsCount: number
  gasUsed: string
  miner?: string
}

interface RealTx {
  hash: string
  blockNumber: number
  from: string
  to: string
  event: string
  value?: string
}

const RPC_URL = 'http://127.0.0.1:8545'

export const BlockchainExplorerPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<any | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [blocks, setBlocks] = useState<RealBlock[]>([])
  const [transactions, setTransactions] = useState<RealTx[]>([])
  const [networkInfo, setNetworkInfo] = useState({
    name: 'Hardhat EVM Localhost',
    chainId: 31337,
    latestBlock: 0,
    status: 'Connected',
  })

  const loadBlockchainData = useCallback(async () => {
    setIsLoading(true)
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL)
      const currentBlockNum = await provider.getBlockNumber()
      const network = await provider.getNetwork()

      setNetworkInfo({
        name: 'Hardhat EVM Localhost',
        chainId: Number(network.chainId),
        latestBlock: currentBlockNum,
        status: 'Connected',
      })

      const fetchedBlocks: RealBlock[] = []
      const fetchedTxs: RealTx[] = []

      // Fetch the last up to 6 blocks
      const startBlock = currentBlockNum
      const endBlock = Math.max(0, currentBlockNum - 5)

      for (let i = startBlock; i >= endBlock; i--) {
        try {
          const block = await provider.getBlock(i, true)
          if (block) {
            fetchedBlocks.push({
              blockNumber: block.number,
              hash: block.hash || `0x${i}`,
              timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
              transactionsCount: block.transactions.length,
              gasUsed: `${Number(block.gasUsed).toLocaleString()} gas`,
              miner: block.miner,
            })

            // Extract real transactions from block
            for (const tx of block.prefetchedTransactions) {
              fetchedTxs.push({
                hash: tx.hash,
                blockNumber: block.number,
                from: tx.from,
                to: tx.to || 'Contract Deployment',
                event: tx.to ? 'Smart Contract Call' : 'Contract Deployed',
                value: ethers.formatEther(tx.value || 0) + ' ETH',
              })
            }
          }
        } catch (err) {
          console.warn(`Could not load block #${i}:`, err)
        }
      }

      setBlocks(fetchedBlocks)
      setTransactions(fetchedTxs)
    } catch (err) {
      console.error('Failed to connect to local blockchain RPC:', err)
      setNetworkInfo((prev) => ({
        ...prev,
        status: 'Offline / Standby',
      }))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBlockchainData()
  }, [loadBlockchainData])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) {
      setSearchResult(null)
      return
    }

    setIsSearching(true)
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL)

      // Check if number (block height)
      if (/^\d+$/.test(query)) {
        const blockNum = parseInt(query, 10)
        const block = await provider.getBlock(blockNum, true)
        if (block) {
          setSearchResult({
            type: 'block',
            data: {
              blockNumber: block.number,
              hash: block.hash,
              transactionsCount: block.transactions.length,
              timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
              gasUsed: `${Number(block.gasUsed).toLocaleString()} gas`,
            },
          })
          return
        }
      }

      // Check if transaction hash
      if (query.startsWith('0x') && query.length === 66) {
        const tx = await provider.getTransaction(query)
        if (tx) {
          setSearchResult({
            type: 'transaction',
            data: {
              hash: tx.hash,
              blockNumber: tx.blockNumber,
              from: tx.from,
              to: tx.to || 'Contract Creation',
              value: ethers.formatEther(tx.value || 0) + ' ETH',
              event: tx.to ? 'Smart Contract Call' : 'Contract Deployment',
            },
          })
          return
        }
      }

      // Check in locally loaded items
      const localTx = transactions.find((t) => t.hash.toLowerCase() === query.toLowerCase())
      if (localTx) {
        setSearchResult({ type: 'transaction', data: localTx })
        return
      }

      const localBlock = blocks.find(
        (b) => String(b.blockNumber) === query || b.hash.toLowerCase() === query.toLowerCase()
      )
      if (localBlock) {
        setSearchResult({ type: 'block', data: localBlock })
        return
      }

      setSearchResult({
        type: 'not_found',
        query,
      })
    } catch (err) {
      console.error('Search error:', err)
      setSearchResult({
        type: 'not_found',
        query,
      })
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decentralized Ledger Explorer"
        description="Inspect on-chain blocks, cryptographic transaction hashes, smart contract state transitions, and emission events."
        actions={
          <Button
            size="sm"
            variant="outline"
            isLoading={isLoading}
            onClick={loadBlockchainData}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh Ledger
          </Button>
        }
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
              <Button type="submit" isLoading={isSearching} leftIcon={<Search className="h-4 w-4" />}>
                Query Ledger
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono pt-1">
              <span>Chain: {networkInfo.name}</span>
              <span>• Chain ID: {networkInfo.chainId}</span>
              <span>• Latest Block: #{networkInfo.latestBlock}</span>
              <span className="text-emerald-400 font-sans font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {networkInfo.status}
              </span>
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
                  <span className="text-slate-800 break-all">{searchResult.data.from}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Receiver (To):</span>
                  <span className="text-slate-800 break-all">{searchResult.data.to}</span>
                </div>
                {searchResult.data.value && (
                  <div className="flex justify-between py-1 border-b border-blue-100">
                    <span className="text-slate-500">Value:</span>
                    <span className="text-slate-800">{searchResult.data.value}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Action:</span>
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
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Transactions:</span>
                  <span className="text-slate-800">{searchResult.data.transactionsCount} txs included</span>
                </div>
                {searchResult.data.timestamp && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Timestamp:</span>
                    <span className="text-slate-800">{formatDate(searchResult.data.timestamp)}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-600">
                No matching block or transaction found for query "{searchResult.query}". Please verify the hash format.
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
            <span className="text-[11px] font-mono text-emerald-600 font-medium">Local EVM Consensus</span>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0 text-xs">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                Querying blocks from node...
              </div>
            ) : blocks.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No blocks mined yet on the local ledger.
              </div>
            ) : (
              blocks.map((blk) => (
                <div key={blk.hash} className="p-4 flex items-center justify-between hover:bg-slate-50">
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
              ))
            )}
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
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-700" />
                Querying transactions...
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="font-medium text-slate-600">No on-chain transactions yet</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Transactions will appear here when contracts are deployed or escrows are executed.
                </p>
              </div>
            ) : (
              transactions.map((tx) => (
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
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded truncate">
                      {tx.event}
                    </span>
                    <span className="font-mono text-slate-600 font-medium">{tx.value}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default BlockchainExplorerPage
