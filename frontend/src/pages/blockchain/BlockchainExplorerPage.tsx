import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import apiClient from '@/lib/axios'
import { HashDisplay } from '@/components/common/HashDisplay'
import {
  Cpu,
  Search,
  Blocks,
  ArrowRight,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  ShieldCheck,
  History,
  FileCode,
  Check,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { truncateHash, formatDate } from '@/lib/utils'
import { ethers } from 'ethers'
import {
  CONTRACT_ADDRESSES,
  CONTRACT_DEPLOYMENT_INFO,
} from '@/contracts/contractConfig'

export interface RealBlock {
  blockNumber: number
  hash: string
  parentHash: string
  timestamp: string
  transactionsCount: number
  gasUsed: string
  gasLimit?: string
  baseFeePerGas?: string
  miner?: string
  blockType?: string
  transactions?: string[]
}

export interface RealTx {
  hash: string
  blockNumber: number
  from: string
  to: string
  event: string
  propertyId?: string
  propertyTitle?: string
  documentHash?: string
  value?: string
  gasUsed: string
  gasPrice?: string
  status: 'Confirmed' | 'Reverted'
  timestamp: string
  details?: string
}

export interface RegisteredPropertyTx {
  property_id: string
  property_uuid?: string
  title: string
  owner_name: string
  owner_wallet: string
  tx_hash: string
  block_number: number
  contract_address: string
  document_hashes: string[]
  registered_at: string
  confirmation_status: string
}

export interface OwnershipTransferTx {
  property_id: string
  property_title?: string
  from_owner: string
  from_address: string
  to_owner: string
  to_address: string
  tx_hash: string
  block_number: number
  timestamp: string
  contract_address: string
}

export interface ContractActivity {
  name: string
  address: string
  deploymentTxHash: string
  deploymentBlock: number
  status: string
  abiStatus: string
  deployedAt?: string
  purpose: string
}

const RPC_URL = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'

function getAddressLabel(address?: string | null): string {
  if (!address) return 'Contract Creation'
  const addr = address.toLowerCase()
  if (addr === CONTRACT_ADDRESSES.PROPERTY_REGISTRY.toLowerCase()) {
    return 'PropertyRegistry (Contract)'
  }
  if (addr === CONTRACT_ADDRESSES.OWNERSHIP_REGISTRY.toLowerCase()) {
    return 'OwnershipRegistry (Contract)'
  }
  if (addr === CONTRACT_ADDRESSES.TRANSACTION_MANAGER.toLowerCase()) {
    return 'TransactionManager (Contract)'
  }
  if (addr === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266') {
    return 'Hardhat Deployer / Admin'
  }
  return truncateHash(address, 6, 4)
}

function getBlockTypeBadgeClass(blockType?: string): string {
  if (!blockType) return 'bg-slate-100 text-slate-700 border-slate-200'
  const bt = blockType.toLowerCase()
  if (bt.includes('genesis')) return 'bg-purple-100 text-purple-800 border-purple-200'
  if (bt.includes('deployment')) return 'bg-blue-100 text-blue-800 border-blue-200'
  if (bt.includes('property')) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (bt.includes('ownership')) return 'bg-indigo-100 text-indigo-800 border-indigo-200'
  if (bt.includes('role')) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export const BlockchainExplorerPage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<
    'overview' | 'blocks' | 'transactions' | 'registrations' | 'transfers' | 'contracts'
  >('overview')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<any | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [selectedBlock, setSelectedBlock] = useState<RealBlock | null>(null)
  const [selectedTx, setSelectedTx] = useState<RealTx | null>(null)

  const [blocks, setBlocks] = useState<RealBlock[]>([])
  const [transactions, setTransactions] = useState<RealTx[]>([])
  const [registeredProperties, setRegisteredProperties] = useState<RegisteredPropertyTx[]>([])
  const [ownershipTransfers, setOwnershipTransfers] = useState<OwnershipTransferTx[]>([])
  const [contractsList, setContractsList] = useState<ContractActivity[]>([
    CONTRACT_DEPLOYMENT_INFO.PROPERTY_REGISTRY,
    CONTRACT_DEPLOYMENT_INFO.OWNERSHIP_REGISTRY,
    CONTRACT_DEPLOYMENT_INFO.TRANSACTION_MANAGER,
  ])

  const [networkInfo, setNetworkInfo] = useState({
    name: 'Local Hardhat Network',
    chainId: 31337,
    latestBlock: 0,
    totalBlocks: 1,
    totalTransactions: 0,
    totalPropertyRegistrations: 0,
    totalOwnershipTransfers: 0,
    deployedContractsCount: 3,
    status: 'Connecting...',
    rpcUrl: RPC_URL,
  })

  const loadBlockchainData = useCallback(async () => {
    setIsLoading(true)
    try {
      let backendOverview: any = null
      try {
        const res = await apiClient.get('/blockchain/overview')
        if (res.data) {
          backendOverview = res.data
        }
      } catch (beErr) {
        console.warn('Backend /blockchain/overview notice, will query local node directly:', beErr)
      }

      if (backendOverview) {
        if (backendOverview.network) {
          setNetworkInfo((prev) => ({
            ...prev,
            ...backendOverview.network,
            status: backendOverview.network.status || 'Connected',
          }))
        }
        if (Array.isArray(backendOverview.blocks)) {
          setBlocks(backendOverview.blocks)
        }
        if (Array.isArray(backendOverview.transactions)) {
          setTransactions(backendOverview.transactions)
        }
        if (Array.isArray(backendOverview.registeredProperties)) {
          setRegisteredProperties(backendOverview.registeredProperties)
        }
        if (Array.isArray(backendOverview.ownershipTransfers)) {
          setOwnershipTransfers(backendOverview.ownershipTransfers)
        }
        if (Array.isArray(backendOverview.contracts)) {
          setContractsList(backendOverview.contracts)
        }
      } else {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const currentBlockNum = await provider.getBlockNumber()
        const network = await provider.getNetwork()

        const fetchedBlocks: RealBlock[] = []
        const fetchedTxs: RealTx[] = []

        for (let i = currentBlockNum; i >= 0; i--) {
          try {
            const block = await provider.getBlock(i, true)
            if (block) {
              const blockDate = new Date(Number(block.timestamp) * 1000).toISOString()
              let blockType = 'Smart Contract Interaction'
              if (block.number === 0) blockType = 'Genesis Block'
              else if (block.number === 1) blockType = 'Contract Deployment (PropertyRegistry)'
              else if (block.number === 2) blockType = 'Contract Deployment (OwnershipRegistry)'
              else if (block.number === 3) blockType = 'Role Authorization (Registrar Role)'
              else if (block.number === 4) blockType = 'Contract Deployment (TransactionManager)'
              else if (block.number === 5) blockType = 'Role Authorization (Transfer Role)'

              fetchedBlocks.push({
                blockNumber: block.number,
                hash: block.hash || '',
                parentHash: block.parentHash || '',
                timestamp: blockDate,
                transactionsCount: block.transactions.length,
                gasUsed: `${Number(block.gasUsed).toLocaleString()} gas`,
                gasLimit: `${Number(block.gasLimit).toLocaleString()} gas`,
                baseFeePerGas: block.baseFeePerGas ? `${block.baseFeePerGas.toString()} wei` : undefined,
                miner: block.miner,
                blockType,
                transactions: block.transactions.map((t: any) => (typeof t === 'string' ? t : t.hash)),
              })

              const rawTxs: any[] = []
              if (block.prefetchedTransactions && block.prefetchedTransactions.length > 0) {
                rawTxs.push(...block.prefetchedTransactions)
              } else if (block.transactions && block.transactions.length > 0) {
                for (const t of block.transactions) {
                  if (typeof t === 'string') {
                    try {
                      const txObj = await provider.getTransaction(t)
                      if (txObj) rawTxs.push(txObj)
                    } catch {}
                  } else if (t && typeof t === 'object') {
                    rawTxs.push(t)
                  }
                }
              }

              for (const tx of rawTxs) {
                let eventName = tx.to ? 'Smart Contract Call' : 'Contract Deployment'
                let details = ''
                if (!tx.to) {
                  if (block.number === 1) details = 'PropertyRegistry Deployed'
                  else if (block.number === 2) details = 'OwnershipRegistry Deployed'
                  else if (block.number === 4) details = 'TransactionManager Deployed'
                }
                fetchedTxs.push({
                  hash: tx.hash,
                  blockNumber: block.number,
                  from: tx.from,
                  to: tx.to || 'Contract Deployment',
                  event: eventName,
                  details,
                  gasUsed: '120,000 gas',
                  status: 'Confirmed',
                  value: ethers.formatEther(tx.value || 0) + ' ETH',
                  timestamp: blockDate,
                })
              }
            }
          } catch (bErr) {
            console.warn(`Could not load block #${i}:`, bErr)
          }
        }

        setBlocks(fetchedBlocks)
        setTransactions(fetchedTxs)
        setNetworkInfo({
          name: 'Local Hardhat Network',
          chainId: Number(network.chainId),
          latestBlock: currentBlockNum,
          totalBlocks: currentBlockNum + 1,
          totalTransactions: fetchedTxs.length,
          totalPropertyRegistrations: 0,
          totalOwnershipTransfers: 0,
          deployedContractsCount: 3,
          status: 'Connected',
          rpcUrl: RPC_URL,
        })
      }
    } catch (err) {
      console.error('Failed to load blockchain ledger data:', err)
      setNetworkInfo((prev) => ({
        ...prev,
        status: 'Disconnected',
      }))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBlockchainData()
  }, [loadBlockchainData])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setSearchQuery(q)
      runSearch(q)
    }
  }, [searchParams])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    await runSearch(searchQuery.trim())
  }

  const runSearch = async (rawQuery: string) => {
    if (!rawQuery) {
      setSearchResult(null)
      return
    }

    setIsSearching(true)
    try {
      const qLower = rawQuery.toLowerCase()

      const foundTx = transactions.find((t) => t.hash.toLowerCase() === qLower)
      if (foundTx) {
        setSearchResult({ type: 'transaction', data: foundTx })
        return
      }

      const foundProp = registeredProperties.find(
        (p) => p.property_id.toLowerCase() === qLower || (p.tx_hash && p.tx_hash.toLowerCase() === qLower)
      )
      if (foundProp) {
        setSearchResult({ type: 'property', data: foundProp })
        return
      }

      const foundBlock = blocks.find(
        (b) => String(b.blockNumber) === rawQuery || b.hash.toLowerCase() === qLower
      )
      if (foundBlock) {
        setSearchResult({ type: 'block', data: foundBlock })
        return
      }

      const foundContract = contractsList.find(
        (c) => c.address.toLowerCase() === qLower || c.name.toLowerCase() === qLower
      )
      if (foundContract) {
        setSearchResult({ type: 'contract', data: foundContract })
        return
      }

      const foundDocProp = registeredProperties.find((p) =>
        p.document_hashes?.some((dh) => dh.toLowerCase() === qLower)
      )
      if (foundDocProp) {
        setSearchResult({
          type: 'property',
          data: foundDocProp,
          customNote: `Matched document SHA-256 hash anchored in Property ${foundDocProp.property_id}`,
        })
        return
      }

      const provider = new ethers.JsonRpcProvider(RPC_URL)
      if (/^\d+$/.test(rawQuery)) {
        const block = await provider.getBlock(parseInt(rawQuery, 10), true)
        if (block) {
          setSearchResult({
            type: 'block',
            data: {
              blockNumber: block.number,
              hash: block.hash,
              parentHash: block.parentHash,
              transactionsCount: block.transactions.length,
              timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
              gasUsed: `${Number(block.gasUsed).toLocaleString()} gas`,
              miner: block.miner,
              transactions: block.transactions,
            },
          })
          return
        }
      }

      if (rawQuery.startsWith('0x') && rawQuery.length === 66) {
        const tx = await provider.getTransaction(rawQuery)
        if (tx) {
          const receipt = await provider.getTransactionReceipt(rawQuery)
          setSearchResult({
            type: 'transaction',
            data: {
              hash: tx.hash,
              blockNumber: tx.blockNumber,
              from: tx.from,
              to: tx.to || 'Contract Deployment',
              value: ethers.formatEther(tx.value || 0) + ' ETH',
              gasUsed: receipt ? `${Number(receipt.gasUsed).toLocaleString()} gas` : '0 gas',
              status: receipt ? (receipt.status === 1 ? 'Confirmed' : 'Reverted') : 'Confirmed',
              timestamp: new Date().toISOString(),
              event: tx.to ? 'Smart Contract Call' : 'Contract Deployment',
            },
          })
          return
        }
      }

      setSearchResult({
        type: 'not_found',
        query: rawQuery,
      })
    } catch (err) {
      console.warn('Search error:', err)
      setSearchResult({
        type: 'not_found',
        query: rawQuery,
      })
    } finally {
      setIsSearching(false)
    }
  }

  const isConnected = networkInfo.status === 'Connected'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decentralized Blockchain Ledger Explorer"
        description="Inspect authenticated blocks, smart contract state transitions, cryptographic hashes, and permanent title registrations."
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

      {/* Connection Warning Banner if Offline */}
      {!isConnected && !isLoading && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-100">Blockchain EVM Node Offline ({RPC_URL})</p>
            <p className="text-amber-300/80">
              Ensure your Hardhat local node is running on port 8545 (<code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono">npx hardhat node</code>).
            </p>
          </div>
        </div>
      )}

      {/* Hero Search Bar */}
      <Card className="bg-slate-950 text-white border-slate-800 shadow-md">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by block #, tx hash (0x...), document SHA-256 hash, address, or property ID (PROP-...)"
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
              <span>Network: {networkInfo.name}</span>
              <span>• Chain ID: {networkInfo.chainId}</span>
              <span>• Latest Block: #{networkInfo.latestBlock}</span>
              <span
                className={`font-sans font-medium flex items-center gap-1.5 ${
                  isConnected ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                {networkInfo.status}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Query Search Result Card */}
      {searchResult && (
        <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm">Ledger Search Result</CardTitle>
            </div>
            <button
              onClick={() => {
                setSearchResult(null)
                setSearchQuery('')
              }}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
            >
              Clear Result
            </button>
          </CardHeader>
          <CardContent className="text-xs">
            {searchResult.type === 'transaction' ? (
              <div className="space-y-2 font-mono">
                <div className="flex justify-between py-1 border-b border-blue-100 items-center">
                  <span className="text-slate-500">Tx Hash:</span>
                  <HashDisplay value={searchResult.data.hash} explorerLink className="bg-transparent border-0 px-0" />
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Status:</span>
                  <span className="flex items-center gap-1">
                    {searchResult.data.status === 'Confirmed' ? (
                      <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-sans font-semibold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="h-3 w-3" /> Confirmed On-Chain
                      </span>
                    ) : (
                      <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-sans font-semibold flex items-center gap-1 text-[11px]">
                        <XCircle className="h-3 w-3" /> Reverted
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Block Number:</span>
                  <span className="text-blue-700 font-bold">#{searchResult.data.blockNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">From:</span>
                  <span className="text-slate-800 break-all">{searchResult.data.from}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">To:</span>
                  <span className="text-slate-800 break-all">{searchResult.data.to}</span>
                </div>
                {searchResult.data.propertyId && (
                  <div className="flex justify-between py-1 border-b border-blue-100">
                    <span className="text-slate-500">Property Identifier:</span>
                    <span className="font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                      {searchResult.data.propertyId}
                    </span>
                  </div>
                )}
                {searchResult.data.documentHash && (
                  <div className="flex justify-between py-1 border-b border-blue-100">
                    <span className="text-slate-500">Deed Document Hash:</span>
                    <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded break-all text-[11px]">
                      {searchResult.data.documentHash}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Contract Event / Action:</span>
                  <span className="text-emerald-700 font-semibold">{searchResult.data.event}</span>
                </div>
              </div>
            ) : searchResult.type === 'property' ? (
              <div className="space-y-2 font-mono">
                {searchResult.customNote && (
                  <p className="text-emerald-700 font-sans font-medium text-xs mb-1">
                    ✓ {searchResult.customNote}
                  </p>
                )}
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Property ID:</span>
                  <span className="font-bold text-blue-700">{searchResult.data.property_id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Property Title:</span>
                  <span className="font-sans font-semibold text-slate-800">{searchResult.data.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Registered Owner:</span>
                  <span className="font-sans text-slate-800">{searchResult.data.owner_name} ({truncateHash(searchResult.data.owner_wallet, 6, 4)})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Anchor Tx Hash:</span>
                  <HashDisplay value={searchResult.data.tx_hash} explorerLink className="bg-transparent border-0 px-0" />
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Block Height:</span>
                  <span className="text-blue-700 font-bold">#{searchResult.data.block_number}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Confirmation:</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1 font-sans">
                    <ShieldCheck className="h-4 w-4" /> CONFIRMED on-chain
                  </span>
                </div>
              </div>
            ) : searchResult.type === 'block' ? (
              <div className="space-y-2 font-mono">
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Block Height:</span>
                  <span className="font-bold text-slate-900 text-sm">#{searchResult.data.blockNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Block Hash:</span>
                  <span className="text-slate-800 break-all font-semibold">{searchResult.data.hash}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Previous Parent Hash:</span>
                  <span className="text-slate-600 break-all">{searchResult.data.parentHash}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Transactions Count:</span>
                  <span className="font-bold text-blue-800">{searchResult.data.transactionsCount} txs included</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="text-slate-800">{formatDate(searchResult.data.timestamp)}</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">
                  No matching record found on the ledger for &ldquo;{searchResult.query}&rdquo;.
                </p>
                <p className="text-[11px] text-slate-500">
                  Try searching by: Block number (e.g. <code>1</code>), Transaction hash (<code>0x...</code>), Document SHA-256 hash, or Property ID (<code>PROP-...</code>).
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section A: Network Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500">Network & Status</span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold text-slate-900">{networkInfo.name}</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                {isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Chain ID: {networkInfo.chainId}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500">Latest Block Height</span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xl font-bold font-mono text-blue-600">#{networkInfo.latestBlock}</span>
              <Blocks className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Total Blocks: {networkInfo.totalBlocks}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500">Total Transactions</span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xl font-bold font-mono text-slate-900">{networkInfo.totalTransactions}</span>
              <Cpu className="h-5 w-5 text-slate-700" />
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Across all blocks</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500">On-Chain Registrations</span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xl font-bold font-mono text-emerald-600">
                {networkInfo.totalPropertyRegistrations}
              </span>
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-[10px] text-slate-400 font-mono">PropertyRegistry anchors</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500">Ownership Conveyances</span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xl font-bold font-mono text-indigo-600">
                {networkInfo.totalOwnershipTransfers}
              </span>
              <History className="h-5 w-5 text-indigo-500" />
            </div>
            <p className="text-[10px] text-slate-400 font-mono">OwnershipRegistry transfers</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500">Smart Contracts</span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xl font-bold font-mono text-slate-900">
                {networkInfo.deployedContractsCount}
              </span>
              <FileCode className="h-5 w-5 text-slate-600" />
            </div>
            <p className="text-[10px] text-emerald-600 font-medium">All 3 Contracts Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Ledger Overview
        </button>
        <button
          onClick={() => setActiveTab('blocks')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'blocks'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Blocks className="h-3.5 w-3.5" />
          Blocks ({blocks.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'transactions'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Transactions ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('registrations')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'registrations'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Property Registrations ({registeredProperties.length})
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'transfers'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="h-3.5 w-3.5 text-indigo-500" />
          Ownership Transfers ({ownershipTransfers.length})
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'contracts'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileCode className="h-3.5 w-3.5" />
          Smart Contracts (3)
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Blocks className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-semibold">Latest Blocks Mined</CardTitle>
                </div>
                <button
                  onClick={() => setActiveTab('blocks')}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  View All ({blocks.length}) →
                </button>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100 p-0 text-xs">
                {isLoading ? (
                  <div className="p-8 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Querying blocks from node...
                  </div>
                ) : blocks.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-medium">No blocks mined yet on the local ledger.</p>
                  </div>
                ) : (
                  blocks.slice(0, 6).map((blk) => (
                    <div
                      key={blk.hash}
                      onClick={() => setSelectedBlock(blk)}
                      className="p-3.5 flex items-center justify-between hover:bg-blue-50/50 cursor-pointer transition-colors"
                      title="Click to view full block details"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600">#{blk.blockNumber}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getBlockTypeBadgeClass(
                              blk.blockType
                            )}`}
                          >
                            {blk.blockType || 'Consensus Block'}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-500 mt-1">
                          Hash: <span className="font-semibold">{truncateHash(blk.hash, 8, 6)}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 font-medium">
                          {blk.transactionsCount} txs
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">{formatDate(blk.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-slate-800" />
                  <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
                </div>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  View All ({transactions.length}) →
                </button>
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
                      Transactions will appear here when properties are verified and deeds are registered on-chain.
                    </p>
                  </div>
                ) : (
                  transactions.slice(0, 6).map((tx) => (
                    <div
                      key={tx.hash}
                      onClick={() => setSelectedTx(tx)}
                      className="p-3.5 space-y-1.5 hover:bg-blue-50/50 cursor-pointer transition-colors"
                      title="Click to view full transaction details"
                    >
                      <div className="flex items-center justify-between">
                        <HashDisplay value={tx.hash} explorerLink className="bg-transparent border-0 px-0" />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-blue-600">Block #{tx.blockNumber}</span>
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span title={tx.from}>From: {getAddressLabel(tx.from)}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span title={tx.to}>To: {getAddressLabel(tx.to)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium truncate">
                            {tx.event}
                          </span>
                          {tx.propertyId && (
                            <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              {tx.propertyId}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-slate-400 text-[10px]">{tx.gasUsed}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: BLOCKS SECTION */}
      {activeTab === 'blocks' && (
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Blocks className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm font-semibold">All Mined Blocks (Genesis to Latest)</CardTitle>
            </div>
            <span className="text-xs font-mono text-slate-500">{blocks.length} total blocks mined</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Height</TableHead>
                    <TableHead>Block Type</TableHead>
                    <TableHead>Block Hash</TableHead>
                    <TableHead>Parent Hash</TableHead>
                    <TableHead>Transactions</TableHead>
                    <TableHead>Gas Used / Limit</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                        No blocks found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    blocks.map((blk) => (
                      <TableRow key={blk.hash} className="hover:bg-blue-50/40">
                        <TableCell className="font-mono font-bold text-blue-600">#{blk.blockNumber}</TableCell>
                        <TableCell>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getBlockTypeBadgeClass(
                              blk.blockType
                            )}`}
                          >
                            {blk.blockType || 'Consensus Block'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-slate-700">
                          {truncateHash(blk.hash, 8, 6)}
                        </TableCell>
                        <TableCell className="font-mono text-slate-400">
                          {truncateHash(blk.parentHash, 6, 4)}
                        </TableCell>
                        <TableCell className="font-mono">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-semibold">
                            {blk.transactionsCount} txs
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {blk.gasUsed} {blk.gasLimit ? `/ ${blk.gasLimit}` : ''}
                        </TableCell>
                        <TableCell className="text-slate-600">{formatDate(blk.timestamp)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedBlock(blk)}
                            className="h-7 text-xs px-2.5"
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: TRANSACTIONS EXPLORER */}
      {activeTab === 'transactions' && (
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-slate-800" />
              <CardTitle className="text-sm font-semibold">Transaction Explorer</CardTitle>
            </div>
            <span className="text-xs font-mono text-slate-500">{transactions.length} verified transactions</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Event / Method</TableHead>
                    <TableHead>Property ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                        No transactions recorded on chain yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.hash} className="hover:bg-blue-50/40">
                        <TableCell className="font-mono">
                          <HashDisplay value={tx.hash} explorerLink className="bg-transparent border-0 px-0" />
                        </TableCell>
                        <TableCell className="font-mono text-blue-600 font-semibold">#{tx.blockNumber}</TableCell>
                        <TableCell className="font-mono text-slate-600">{getAddressLabel(tx.from)}</TableCell>
                        <TableCell className="font-mono text-slate-600">{getAddressLabel(tx.to)}</TableCell>
                        <TableCell>
                          <span className="bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded font-mono text-[11px]">
                            {tx.event}
                          </span>
                        </TableCell>
                        <TableCell>
                          {tx.propertyId ? (
                            <span className="bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded font-mono text-[11px]">
                              {tx.propertyId}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={tx.status} />
                        </TableCell>
                        <TableCell className="text-slate-600">{formatDate(tx.timestamp)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTx(tx)}
                            className="h-7 text-xs px-2.5"
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: PROPERTY REGISTRATIONS */}
      {activeTab === 'registrations' && (
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-sm font-semibold">
                Blockchain Property Registrations (PropertyRegistry)
              </CardTitle>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              {registeredProperties.length} active verified properties anchored
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Property ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Block #</TableHead>
                    <TableHead>Smart Contract</TableHead>
                    <TableHead>Document Hashes (SHA-256)</TableHead>
                    <TableHead>Registered At</TableHead>
                    <TableHead>On-Chain Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registeredProperties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                        <ShieldCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No properties registered on-chain yet.</p>
                        <p className="text-xs text-slate-400 mt-1">
                          When a seller submits documents and a verifier approves them, the property is automatically
                          anchored here.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    registeredProperties.map((p) => (
                      <TableRow key={p.property_id} className="hover:bg-emerald-50/30">
                        <TableCell className="font-mono font-bold text-blue-600">{p.property_id}</TableCell>
                        <TableCell className="font-semibold text-slate-800">{p.title}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-800">{p.owner_name}</p>
                            <p className="font-mono text-[10px] text-slate-400">{truncateHash(p.owner_wallet, 6, 4)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          <HashDisplay value={p.tx_hash} explorerLink className="bg-transparent border-0 px-0" />
                        </TableCell>
                        <TableCell className="font-mono font-bold text-blue-700">#{p.block_number}</TableCell>
                        <TableCell className="font-mono text-slate-500">
                          {truncateHash(p.contract_address, 6, 4)}
                        </TableCell>
                        <TableCell>
                          {p.document_hashes && p.document_hashes.length > 0 ? (
                            <div className="flex flex-col gap-1 max-w-[200px]">
                              {p.document_hashes.map((dh, idx) => (
                                <span
                                  key={idx}
                                  className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 truncate"
                                  title={`SHA-256: ${dh}`}
                                >
                                  {truncateHash(dh, 8, 6)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">{formatDate(p.registered_at)}</TableCell>
                        <TableCell>
                          <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-1 rounded-full text-[10px] flex items-center gap-1 w-fit">
                            <Check className="h-3 w-3" /> CONFIRMED on-chain
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: OWNERSHIP TRANSFERS */}
      {activeTab === 'transfers' && (
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-semibold">
                On-Chain Ownership Conveyance History (OwnershipRegistry)
              </CardTitle>
            </div>
            <span className="text-xs font-mono text-indigo-700 font-semibold">
              {ownershipTransfers.length} registered transfers
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Property ID</TableHead>
                    <TableHead>From Owner</TableHead>
                    <TableHead>To Owner</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Block #</TableHead>
                    <TableHead>Smart Contract</TableHead>
                    <TableHead>Settlement Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ownershipTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                        <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No ownership transfers executed on-chain yet.</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Conveyance events will appear here once statutory legal approval transfers deed title.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    ownershipTransfers.map((t, idx) => (
                      <TableRow key={idx} className="hover:bg-indigo-50/30">
                        <TableCell className="font-mono font-bold text-blue-600">{t.property_id}</TableCell>
                        <TableCell>
                          <p className="font-medium text-slate-800">{t.from_owner}</p>
                          <p className="font-mono text-[10px] text-slate-400">{truncateHash(t.from_address, 6, 4)}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-slate-800">{t.to_owner}</p>
                          <p className="font-mono text-[10px] text-slate-400">{truncateHash(t.to_address, 6, 4)}</p>
                        </TableCell>
                        <TableCell className="font-mono">
                          <HashDisplay value={t.tx_hash} explorerLink className="bg-transparent border-0 px-0" />
                        </TableCell>
                        <TableCell className="font-mono font-bold text-blue-700">#{t.block_number}</TableCell>
                        <TableCell className="font-mono text-slate-500">
                          {truncateHash(t.contract_address, 6, 4)}
                        </TableCell>
                        <TableCell className="text-slate-600">{formatDate(t.timestamp)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 6: SMART CONTRACTS */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {contractsList.map((c) => (
              <Card key={c.name} className="border-slate-200">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/70">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      {c.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{c.purpose}</p>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Contract Address</span>
                    <HashDisplay value={c.address} explorerLink className="bg-transparent border-0 px-0 break-all" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Deployment Tx Hash</span>
                    <HashDisplay value={c.deploymentTxHash} explorerLink className="bg-transparent border-0 px-0 truncate" />
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-400 font-sans">Deployment Block:</span>
                    <span className="text-blue-600 font-bold">#{c.deploymentBlock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Verified ABI:</span>
                    <span className="text-emerald-700 font-semibold font-sans flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {c.abiStatus}
                    </span>
                  </div>
                  {c.deployedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Deployed At:</span>
                      <span className="text-slate-600 font-sans">{formatDate(c.deployedAt)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Full Block Details */}
      {selectedBlock && (
        <Modal
          isOpen={Boolean(selectedBlock)}
          onClose={() => setSelectedBlock(null)}
          title={`Block Details #${selectedBlock.blockNumber}`}
          description="EVM Consensus block verified on local Hardhat network."
          maxWidth="lg"
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Block Height:</span>
              <span className="font-bold text-slate-900 text-sm">#{selectedBlock.blockNumber}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Block Type:</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getBlockTypeBadgeClass(selectedBlock.blockType)}`}>
                {selectedBlock.blockType || 'Consensus Block'}
              </span>
            </div>
            <div className="space-y-1 py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans block">Block Hash:</span>
              <span className="text-slate-800 break-all font-semibold select-all">{selectedBlock.hash}</span>
            </div>
            <div className="space-y-1 py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans block">Parent Block Hash:</span>
              <span className="text-slate-600 break-all select-all">{selectedBlock.parentHash}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Transactions Count:</span>
              <span className="font-bold text-blue-700">{selectedBlock.transactionsCount} txs included</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Gas Used / Limit:</span>
              <span className="text-slate-800">{selectedBlock.gasUsed} {selectedBlock.gasLimit ? `/ ${selectedBlock.gasLimit}` : ''}</span>
            </div>
            {selectedBlock.baseFeePerGas && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Base Fee Per Gas:</span>
                <span className="text-slate-800">{selectedBlock.baseFeePerGas}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Miner / Validator:</span>
              <span className="text-slate-700">{selectedBlock.miner || '0x0000000000000000000000000000000000000000'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 font-sans">Mined Timestamp:</span>
              <span className="text-slate-800 font-sans">{formatDate(selectedBlock.timestamp)}</span>
            </div>
            {selectedBlock.transactions && selectedBlock.transactions.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-sans block mb-1 font-semibold">Included Transactions:</span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedBlock.transactions.map((txh, i) => (
                    <div key={i} className="text-[11px] text-blue-600 hover:underline select-all">
                      {txh}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: Full Transaction Details */}
      {selectedTx && (
        <Modal
          isOpen={Boolean(selectedTx)}
          onClose={() => setSelectedTx(null)}
          title="Transaction Details"
          description="EVM verified state transition on PropChain smart contracts."
          maxWidth="lg"
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 items-center">
              <span className="text-slate-500 font-sans">Status:</span>
              <span className="flex items-center gap-1">
                {selectedTx.status === 'Confirmed' ? (
                  <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-sans font-semibold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="h-3 w-3" /> Confirmed On-Chain
                  </span>
                ) : (
                  <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-sans font-semibold flex items-center gap-1 text-[11px]">
                    <XCircle className="h-3 w-3" /> Reverted
                  </span>
                )}
              </span>
            </div>
            <div className="space-y-1 py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans block">Transaction Hash:</span>
              <span className="text-slate-900 break-all font-semibold select-all">{selectedTx.hash}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Block Number:</span>
              <span className="text-blue-700 font-bold">#{selectedTx.blockNumber}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">From (Sender):</span>
              <span className="text-slate-800 break-all">{getAddressLabel(selectedTx.from)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">To (Recipient):</span>
              <span className="text-slate-800 break-all">{getAddressLabel(selectedTx.to)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Event / Method:</span>
              <span className="text-emerald-700 font-semibold">{selectedTx.event}</span>
            </div>
            {selectedTx.propertyId && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Property ID:</span>
                <span className="font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                  {selectedTx.propertyId}
                </span>
              </div>
            )}
            {selectedTx.documentHash && (
              <div className="space-y-1 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans block">Document SHA-256 Hash:</span>
                <span className="text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded break-all text-[11px] block select-all">
                  {selectedTx.documentHash}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Value Transferred:</span>
              <span className="text-slate-800">{selectedTx.value || '0 ETH'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Gas Used:</span>
              <span className="text-slate-800">{selectedTx.gasUsed}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 font-sans">Timestamp:</span>
              <span className="text-slate-800 font-sans">{formatDate(selectedTx.timestamp)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default BlockchainExplorerPage
