import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  Link2,
  ChevronLeft,
  ChevronRight,
  Box,
  Info,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { truncateHash, formatDate, getRoleLabel } from '@/lib/utils'
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
  transactionsRoot?: string
  stateRoot?: string
  receiptsRoot?: string
  blockType?: string
  transferDetails?: any
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
  deal_number?: string
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
  return 'bg-cyan-100 text-cyan-800 border-cyan-200'
}

function getBlockVisualTheme(blockType?: string, isGenesis?: boolean) {
  if (isGenesis || (blockType && blockType.toLowerCase().includes('genesis'))) {
    return {
      containerClass:
        'bg-gradient-to-br from-purple-950/50 via-slate-900 to-slate-950 border-purple-500/30 hover:border-purple-400 hover:shadow-purple-500/10',
      topAccentClass: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      iconClass: 'text-purple-400',
      badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
      label: 'Genesis Block',
    }
  }
  const bt = (blockType || '').toLowerCase()
  if (bt.includes('deployment')) {
    return {
      containerClass:
        'bg-gradient-to-br from-blue-950/50 via-slate-900 to-slate-950 border-blue-500/30 hover:border-blue-400 hover:shadow-blue-500/10',
      topAccentClass: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      iconClass: 'text-blue-400',
      badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-500/40',
      label: 'Contract Deployment',
    }
  }
  if (bt.includes('role')) {
    return {
      containerClass:
        'bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-950 border-amber-500/30 hover:border-amber-400 hover:shadow-amber-500/10',
      topAccentClass: 'bg-gradient-to-r from-amber-500 to-yellow-500',
      iconClass: 'text-amber-400',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
      label: 'Role Authorization',
    }
  }
  if (bt.includes('property')) {
    return {
      containerClass:
        'bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 border-emerald-500/30 hover:border-emerald-400 hover:shadow-emerald-500/10',
      topAccentClass: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      iconClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
      label: 'Property Registration',
    }
  }
  if (bt.includes('ownership')) {
    return {
      containerClass:
        'bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-950 border-indigo-500/30 hover:border-indigo-400 hover:shadow-indigo-500/10',
      topAccentClass: 'bg-gradient-to-r from-indigo-500 to-purple-500',
      iconClass: 'text-indigo-400',
      badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
      label: 'Ownership Transferred',
    }
  }
  return {
    containerClass:
      'bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border-slate-700/60 hover:border-cyan-500/60 hover:shadow-cyan-500/10',
    topAccentClass: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    iconClass: 'text-cyan-400',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    label: 'Smart Contract Interaction',
  }
}

export const BlockchainExplorerPage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<
    'overview' | 'chain' | 'blocks' | 'transactions' | 'registrations' | 'transfers' | 'contracts'
  >('overview')

  const [blockDetailView, setBlockDetailView] = useState<'basic' | 'advanced'>('basic')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<any | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [selectedBlock, setSelectedBlock] = useState<RealBlock | null>(null)
  const [selectedTx, setSelectedTx] = useState<RealTx | null>(null)
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [showSystemEvents, setShowSystemEvents] = useState(false)

  const [blocks, setBlocks] = useState<RealBlock[]>([])
  const [transactions, setTransactions] = useState<RealTx[]>([])
  const [registeredProperties, setRegisteredProperties] = useState<RegisteredPropertyTx[]>([])
  const [ownershipTransfers, setOwnershipTransfers] = useState<OwnershipTransferTx[]>([])
  const [failedOperations, setFailedOperations] = useState<any[]>([])
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

  const visualChainRef = useRef<HTMLDivElement>(null)

  const scrollChain = (direction: 'left' | 'right') => {
    if (visualChainRef.current) {
      const scrollAmount = 300
      visualChainRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

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
        if (Array.isArray(backendOverview.failedOperations)) {
          setFailedOperations(backendOverview.failedOperations)
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

              let hasDeployment = false
              let hasPropReg = false
              let hasTransfer = false
              let hasRoleAuth = false

              const blockTxs: RealTx[] = []
              for (const tx of rawTxs) {
                let eventName = 'Smart Contract Call'
                let details = ''
                let gasUsedFmt = '0 gas'
                let txStatus: 'Confirmed' | 'Reverted' = 'Confirmed'
                let contractAddress: string | null = null

                try {
                  const receipt = await provider.getTransactionReceipt(tx.hash)
                  if (receipt) {
                    gasUsedFmt = `${Number(receipt.gasUsed).toLocaleString()} gas`
                    txStatus = receipt.status === 1 ? 'Confirmed' : 'Reverted'
                    contractAddress = receipt.contractAddress
                  }
                } catch {}

                const txTo = (tx.to || '').toLowerCase()
                const txData = (tx.data || '').toLowerCase()
                const isRoleGrant = txData.startsWith('0x2f2ff15d')

                if (!tx.to) {
                  hasDeployment = true
                  eventName = 'Contract deployed'
                  const ca = (contractAddress || '').toLowerCase()
                  if (ca && ca === CONTRACT_ADDRESSES.PROPERTY_REGISTRY.toLowerCase()) {
                    details = 'PropertyRegistry Deployed'
                  } else if (ca && ca === CONTRACT_ADDRESSES.OWNERSHIP_REGISTRY.toLowerCase()) {
                    details = 'OwnershipRegistry Deployed'
                  } else if (ca && ca === CONTRACT_ADDRESSES.TRANSACTION_MANAGER.toLowerCase()) {
                    details = 'TransactionManager Deployed'
                  } else {
                    details = 'Smart Contract Deployed'
                  }
                } else if (isRoleGrant) {
                  hasRoleAuth = true
                  eventName = 'Role granted'
                  details = 'AccessControl Role Granted'
                } else if (txTo === CONTRACT_ADDRESSES.PROPERTY_REGISTRY.toLowerCase()) {
                  hasPropReg = true
                  eventName = 'Property registered'
                  details = 'Property Registered On-Chain'
                } else if (txTo === CONTRACT_ADDRESSES.OWNERSHIP_REGISTRY.toLowerCase()) {
                  hasTransfer = true
                  eventName = 'Ownership transferred'
                  details = 'Ownership Conveyance Recorded'
                } else if (txTo === CONTRACT_ADDRESSES.TRANSACTION_MANAGER.toLowerCase()) {
                  eventName = 'Transaction initiated'
                  details = 'TransactionManager Call'
                }

                blockTxs.push({
                  hash: tx.hash,
                  blockNumber: block.number,
                  from: tx.from,
                  to: tx.to || 'Contract Deployment',
                  event: eventName,
                  details,
                  gasUsed: gasUsedFmt,
                  status: txStatus,
                  value: ethers.formatEther(tx.value || 0) + ' ETH',
                  timestamp: blockDate,
                })
              }

              let blockType = 'Smart Contract Interaction'
              if (block.number === 0) {
                blockType = 'Genesis Block'
              } else if (hasPropReg) {
                blockType = 'Property Registration'
              } else if (hasTransfer) {
                blockType = 'Ownership Transfer'
              } else if (hasDeployment) {
                blockType = 'Contract Deployment'
              } else if (hasRoleAuth) {
                blockType = 'Role Authorization'
              }

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

              fetchedTxs.push(...blockTxs)
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

  // Render Section B: Visual Blockchain Structure
  const renderVisualChain = (isExpandedView: boolean = false) => {
    // Sort blocks in ascending chronological order: Block #0 -> Block #1 -> ...
    const sortedBlocks = [...blocks].sort((a, b) => a.blockNumber - b.blockNumber)

    return (
      <div
        className={`relative bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg overflow-hidden ${
          isExpandedView ? 'min-h-[480px]' : ''
        }`}
      >
        {/* Subtle Background EVM Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {/* Header bar */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                Visual Blockchain Structure
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-500/30">
                  {sortedBlocks.length} Blocks Linked
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Horizontally connected block sequence sealed by local Hardhat EVM consensus. Each block cryptographically verifies its parent hash.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => scrollChain('left')}
              className="h-7 w-7 rounded-md bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
              title="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollChain('right')}
              className="h-7 w-7 rounded-md bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
              title="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {(() => {
              let brokenBlock: number | null = null
              let checkedCount = 0
              if (sortedBlocks.length > 1) {
                for (let i = 1; i < sortedBlocks.length; i++) {
                  const prev = sortedBlocks[i - 1]
                  const curr = sortedBlocks[i]
                  checkedCount++
                  if (
                    !curr.parentHash ||
                    !prev.hash ||
                    curr.parentHash.toLowerCase() !== prev.hash.toLowerCase()
                  ) {
                    brokenBlock = curr.blockNumber
                    break
                  }
                }
              }
              return brokenBlock === null ? (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-md flex items-center gap-1 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Chain integrity OK ({checkedCount} of {checkedCount} links checked)
                </span>
              ) : (
                <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2.5 py-1 rounded-md flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" /> Broken link detected at Block #{brokenBlock}
                </span>
              )
            })()}
          </div>
        </div>

        {/* Legend */}
        <div className="relative z-10 flex flex-wrap items-center gap-2 pb-3 text-[10px] font-mono">
          <span className="text-slate-400 font-sans">Block Types:</span>
          <span className="px-2 py-0.5 rounded border bg-purple-950/70 text-purple-300 border-purple-500/40">
            Genesis Block
          </span>
          <span className="px-2 py-0.5 rounded border bg-blue-950/70 text-blue-300 border-blue-500/40">
            Contract Deployment
          </span>
          <span className="px-2 py-0.5 rounded border bg-amber-950/70 text-amber-300 border-amber-500/40">
            Role Authorization
          </span>
          <span className="px-2 py-0.5 rounded border bg-emerald-950/70 text-emerald-300 border-emerald-500/40">
            Property Registration
          </span>
          <span className="px-2 py-0.5 rounded border bg-indigo-950/70 text-indigo-300 border-indigo-500/40">
            Ownership Transferred
          </span>
          <span className="px-2 py-0.5 rounded border bg-cyan-950/70 text-cyan-300 border-cyan-500/40">
            Smart Contract Interaction
          </span>
        </div>

        {/* Horizontally scrolling sequence */}
        <div
          ref={visualChainRef}
          className="relative z-10 flex items-center gap-2 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        >
          {sortedBlocks.length === 0 ? (
            <div className="w-full py-12 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading blockchain structure from RPC...
            </div>
          ) : (
            sortedBlocks.map((blk, idx) => {
              const prevBlock = idx > 0 ? sortedBlocks[idx - 1] : null
              const isGenesis = blk.blockNumber === 0
              const theme = getBlockVisualTheme(blk.blockType, isGenesis)

              return (
                <React.Fragment key={blk.hash || blk.blockNumber}>
                  {/* Consecutive Chain Link Connector */}
                  {idx > 0 && prevBlock && (
                    <div className="flex flex-col items-center justify-center px-1 shrink-0 select-none group/link">
                      <div className="flex items-center">
                        <div className="h-0.5 w-4 bg-gradient-to-r from-blue-500/60 to-indigo-500/80 relative">
                          <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-blue-400 animate-ping opacity-25" />
                        </div>
                        <div
                          className="flex items-center justify-center h-7 w-7 rounded-full bg-slate-900 border border-blue-500/40 text-blue-400 shadow-md transition-transform group-hover/link:scale-110"
                          title={`Parent Link: Block #${blk.blockNumber} references parent ${truncateHash(blk.parentHash, 6, 4)}`}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="h-0.5 w-4 bg-gradient-to-r from-indigo-500/80 to-blue-500/60" />
                        <ArrowRight className="h-3.5 w-3.5 text-blue-400 -ml-1" />
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 mt-1">
                        #{prevBlock.blockNumber} → #{blk.blockNumber}
                      </span>
                    </div>
                  )}

                  {/* 3D-styled Block Card */}
                  <div
                    onClick={() => {
                      setSelectedBlock(blk)
                      setBlockDetailView('basic')
                      setSidePanelOpen(true)
                    }}
                    className={`min-w-[260px] w-[260px] max-w-[260px] rounded-xl p-4 border transition-all duration-300 cursor-pointer shrink-0 select-none relative group hover:-translate-y-1.5 shadow-md hover:shadow-xl ${theme.containerClass}`}
                    title="Click to inspect block details"
                  >
                    {/* Glowing accent top line */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${theme.topAccentClass}`} />

                    {/* Header: Block Number & Type */}
                    <div className="flex items-center justify-between gap-1.5 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <Box className={`h-4 w-4 ${theme.iconClass}`} />
                        <span className="font-mono font-bold text-sm text-white">Block #{blk.blockNumber}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${theme.badgeClass}`}>
                        {blk.blockType?.toLowerCase().includes('ownership') ? 'Ownership Transferred' : theme.label}
                      </span>
                    </div>

                    {/* Ownership Transfer Summary if applicable */}
                    {(() => {
                      const tInfo = blk.transferDetails || ownershipTransfers.find((ot) => ot.block_number === blk.blockNumber || (ot.tx_hash && blk.transactions?.includes(ot.tx_hash)))
                      if (!tInfo && !blk.blockType?.toLowerCase().includes('ownership')) return null
                      return (
                        <div className="mb-2 p-2 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-[10px] space-y-1">
                          <div className="flex items-center justify-between text-indigo-300 font-semibold">
                            <span className="truncate">{tInfo?.property_title || tInfo?.property_id || 'Property'}</span>
                            <span className="font-mono text-[9px] text-indigo-400 bg-indigo-900/60 px-1.5 py-0.5 rounded">{tInfo?.deal_number || 'TXN-CONVEY'}</span>
                          </div>
                          <div className="text-[10px] text-slate-300 flex items-center justify-between pt-0.5 border-t border-indigo-500/20">
                            <span className="truncate">From: {tInfo?.from_owner || 'Seller'}</span>
                            <span className="truncate">To: {tInfo?.to_owner || 'Buyer'}</span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Body: Hashes and Tx Count */}
                    <div className="space-y-1.5 text-[11px] font-mono">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-400">Block Hash:</span>
                        <span className="font-semibold text-slate-200" title={blk.hash}>
                          {truncateHash(blk.hash, 6, 4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-400">Parent Hash:</span>
                        <span className="text-slate-400" title={blk.parentHash}>
                          {isGenesis ? 'Genesis (0x00...00)' : truncateHash(blk.parentHash, 6, 4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">Txs Included:</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200">
                          {blk.transactionsCount} {blk.transactionsCount === 1 ? 'tx' : 'txs'}
                        </span>
                      </div>
                    </div>

                    {/* Footer Cue */}
                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-mono">{formatDate(blk.timestamp)}</span>
                      <span className="text-blue-400 group-hover:underline flex items-center gap-0.5 font-sans font-medium">
                        Inspect →
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              )
            })
          )}
        </div>
      </div>
    )
  }

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

      {/* Role-Based Visibility Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-sm">
            {getRoleLabel(user?.role).charAt(0) || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">
                Active Role: {getRoleLabel(user?.role) || 'Platform User'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Role-Scoped Ledger View
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {user?.role === 'PROPERTY_OWNER' &&
                'Showing your registered properties, verified document hashes, and personal transactions on the immutable ledger.'}
              {user?.role === 'BUYER' &&
                'Displaying publicly verified property titles, purchase transactions, and transparent blockchain records.'}
              {user?.role === 'VERIFIER' &&
                'Displaying verified property titles, deed authentication transactions, and cryptographic proofs.'}
              {user?.role === 'LEGAL_AUTHORITY' &&
                'Displaying verified cadastral records, statutory conveyance transfers, and deed confirmation events.'}
              {user?.role === 'ADMIN' &&
                'Full administrative ledger access: raw EVM state roots, gas metrics, and failed/pending operations.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center font-mono text-[11px] text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>EVM Chain: 31337</span>
        </div>
      </div>

      {/* Admin Notice for Failed or Pending Operations if any */}
      {user?.role === 'ADMIN' && failedOperations.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900">
              Admin Alert: {failedOperations.length} Pending / Failed Blockchain Operations
            </p>
            <p className="text-amber-800 text-[11px]">
              The following backend blockchain queuing operations require attention:
            </p>
            <ul className="list-disc pl-4 text-[11px] space-y-0.5 font-mono text-amber-950">
              {failedOperations.map((op, idx) => (
                <li key={idx}>
                  {op.operationType} ({op.status}) - Retries: {op.retryCount} - {op.errorMessage || 'Queued'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
                  <span className="font-sans text-slate-800">
                    {searchResult.data.owner_name} ({truncateHash(searchResult.data.owner_wallet, 6, 4)})
                  </span>
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

      {/* Tabs Navigation (Sections A, B, C, D, E, F, G) */}
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
          onClick={() => setActiveTab('chain')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'chain'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Link2 className="h-3.5 w-3.5" />
          Visual Chain View ({blocks.length})
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

      {/* TAB 1: OVERVIEW (Contains Section B Visual Chain + Quick Tables) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* SECTION B: VISUAL BLOCKCHAIN STRUCTURE */}
          {renderVisualChain(false)}

          {/* SECTION C: LEDGER ACTIVITY */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Activity</CardTitle>
                  <p className="text-[11px] text-slate-400">
                    Chronological events and verified transactions recorded on the immutable ledger.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={showSystemEvents}
                    onChange={(e) => setShowSystemEvents(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className="font-medium">Show system events</span>
                </label>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  View All ({transactions.length}) →
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0 text-xs">
              {isLoading ? (
                <div className="p-10 text-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                  Querying activity...
                </div>
              ) : (() => {
                const isSystemEvent = (t: RealTx) => {
                  const ev = (t.event || '').toLowerCase()
                  const dt = (t.details || '').toLowerCase()
                  return (
                    ev.includes('deploy') ||
                    ev.includes('role') ||
                    ev.includes('contract creation') ||
                    dt.includes('deploy') ||
                    dt.includes('role') ||
                    !t.to ||
                    t.to === 'Contract Deployment'
                  )
                }
                const filtered = transactions.filter((t) => showSystemEvents || !isSystemEvent(t))

                if (filtered.length === 0) {
                  return (
                    <div className="p-10 text-center text-slate-500">
                      <p className="font-semibold text-slate-700">No activity to display</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {showSystemEvents
                          ? 'No transactions found on the blockchain ledger.'
                          : 'No property activities yet. Turn on "Show system events" to view contract deployments and role grants.'}
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Property</TableHead>
                          <TableHead>Who</TableHead>
                          <TableHead>Deed Hash</TableHead>
                          <TableHead>Gas</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.slice(0, 10).map((tx) => {
                          const evLower = tx.event.toLowerCase()
                          const isProp = evLower.includes('property')
                          const isTrans = evLower.includes('ownership') || evLower.includes('transfer')
                          const isRole = evLower.includes('role')
                          const isDeploy = evLower.includes('deploy')
                          const badgeClass = isProp
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isTrans
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : isRole
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : isDeploy
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-slate-100 text-slate-800 border-slate-200'

                          const propLabel = tx.propertyTitle || tx.propertyId
                            ? getPropertyLabel({ title: tx.propertyTitle, property_number: tx.propertyId })
                            : null

                          return (
                            <TableRow key={tx.hash} className="hover:bg-slate-50/60 transition-colors">
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  <span className={`inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded border w-fit ${badgeClass}`}>
                                    {tx.event}
                                  </span>
                                  {tx.details && (
                                    <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={tx.details}>
                                      {tx.details}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {propLabel ? (
                                  <div>
                                    <p className="font-semibold text-slate-800">{propLabel}</p>
                                    {tx.propertyId && (
                                      <p className="font-mono text-[10px] text-blue-600">{tx.propertyId}</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-[11px] text-slate-700 font-medium">{getAddressLabel(tx.from)}</span>
                              </TableCell>
                              <TableCell>
                                {tx.documentHash ? (
                                  <HashDisplay value={tx.documentHash} explorerLink label="SHA-256" />
                                ) : (
                                  <span className="text-slate-400 font-mono">—</span>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-slate-600 text-[11px]">
                                {tx.gasUsed}
                              </TableCell>
                              <TableCell className="text-slate-500 whitespace-nowrap text-[11px]">
                                {formatDate(tx.timestamp)}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
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
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: DEDICATED VISUAL CHAIN VIEW (Section B) */}
      {activeTab === 'chain' && (
        <div className="space-y-6">
          {renderVisualChain(true)}

          {/* Educational Blockchain Structure Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-semibold">
                  How PropChain Connects Blocks & Ensures Immutability
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-3">
              <p>
                In the PropChain decentralized ledger, blocks form a continuous chronological chain where each block header includes the cryptographic SHA-256/Keccak-256 hash of the previous block (Parent Hash). This creates a tamper-proof link: any modification to a historical block would alter its hash and invalidate every subsequent block in the chain.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-900 block mb-1">1. Block Genesis (#0)</span>
                  <p className="text-[11px] text-slate-500">
                    The root anchor of the blockchain with null parent hash (<code className="font-mono text-[10px]">0x00...</code>), establishing consensus rules.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-900 block mb-1">2. Smart Contract Foundations (#1-#5)</span>
                  <p className="text-[11px] text-slate-500">
                    Deploys <code className="font-mono text-[10px]">PropertyRegistry</code>, <code className="font-mono text-[10px]">OwnershipRegistry</code>, and <code className="font-mono text-[10px]">TransactionManager</code> with strict multi-role governance.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-900 block mb-1">3. Deed Anchoring (#6+)</span>
                  <p className="text-[11px] text-slate-500">
                    Every verifier-approved property anchors cryptographic SHA-256 document proofs into immutable state, accessible to authorized stakeholders.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: BLOCKS SECTION (Section C) */}
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
                      <TableRow key={blk.hash || blk.blockNumber} className="hover:bg-blue-50/40">
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
                            onClick={() => {
                              setSelectedBlock(blk)
                              setBlockDetailView('basic')
                            }}
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

      {/* TAB 4: TRANSACTIONS EXPLORER (Section D) */}
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

      {/* TAB 5: PROPERTY REGISTRATIONS (Section E) */}
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
                    <TableHead>Recorded Owner</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Block #</TableHead>
                    <TableHead>Smart Contract</TableHead>
                    <TableHead>Verified Document Hashes (SHA-256)</TableHead>
                    <TableHead>Registration Timestamp</TableHead>
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

      {/* TAB 6: OWNERSHIP TRANSFERS (Section F) */}
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
                    <TableHead>Previous Owner</TableHead>
                    <TableHead>New Owner</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Block #</TableHead>
                    <TableHead>Smart Contract</TableHead>
                    <TableHead>Timestamp</TableHead>
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

      {/* TAB 7: SMART CONTRACTS (Section G) */}
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
                    <span className="text-[10px] text-slate-400 block font-sans">Contract Address</span>
                    <HashDisplay value={c.address} explorerLink className="bg-transparent border-0 px-0 break-all" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Deployment Tx Hash</span>
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
                      <span className="text-slate-400 font-sans">Deployment Timestamp:</span>
                      <span className="text-slate-600 font-sans">{formatDate(c.deployedAt)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* SIDE PANEL: BLOCK DETAILS */}
      {selectedBlock && sidePanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSidePanelOpen(false)}
          />
          <div className="relative z-10 w-full sm:w-[480px] bg-slate-900 border-l border-slate-700 text-white shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Blocks className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Block #{selectedBlock.blockNumber}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border inline-block mt-0.5 ${getBlockTypeBadgeClass(selectedBlock.blockType)}`}>
                      {selectedBlock.blockType?.toLowerCase().includes('ownership') ? 'Ownership Transferred' : (selectedBlock.blockType || 'Consensus Block')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSidePanelOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="flex items-center gap-2 border-b border-slate-800 py-3">
                  <button
                    onClick={() => setBlockDetailView('basic')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      blockDetailView === 'basic' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Block Overview
                  </button>
                  <button
                    onClick={() => setBlockDetailView('advanced')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      blockDetailView === 'advanced' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cryptographic Roots (Admin)
                  </button>
                </div>
              )}

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Block Hash</span>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-blue-300 break-all select-all">
                    {selectedBlock.hash}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Parent Hash</span>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                    {selectedBlock.parentHash}
                  </div>
                  {selectedBlock.blockNumber > 0 && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Cryptographically links to Block #{selectedBlock.blockNumber - 1}
                    </p>
                  )}
                </div>

                {/* Ownership Transfer Details Card */}
                {(() => {
                  const tInfo = selectedBlock.transferDetails || ownershipTransfers.find((ot) => ot.block_number === selectedBlock.blockNumber || (ot.tx_hash && selectedBlock.transactions?.includes(ot.tx_hash)))
                  if (!tInfo && !selectedBlock.blockType?.toLowerCase().includes('ownership')) return null
                  return (
                    <div className="p-3.5 rounded-xl bg-indigo-950/50 border border-indigo-500/50 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-indigo-500/30 pb-2">
                        <span className="text-xs font-bold text-indigo-300">Ownership Transferred</span>
                        <span className="font-mono text-[11px] font-bold text-indigo-200 bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-500/40">
                          {tInfo?.deal_number || 'TXN-CONVEYANCE'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Property Name</span>
                          <strong className="text-white block font-medium text-xs">{tInfo?.property_title || tInfo?.property_id || 'Property'}</strong>
                          {tInfo?.property_id && <span className="text-[10px] font-mono text-indigo-300">{tInfo.property_id}</span>}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Deal Number</span>
                          <strong className="text-white block font-mono font-medium text-xs">{tInfo?.deal_number || 'TXN-SETTLED'}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Previous Owner</span>
                          <strong className="text-slate-200 block text-xs">{tInfo?.from_owner || 'Previous Owner'}</strong>
                          {tInfo?.from_address && <span className="text-[9px] font-mono text-slate-400 truncate block">{tInfo.from_address}</span>}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">New Owner</span>
                          <strong className="text-emerald-300 block text-xs">{tInfo?.to_owner || 'New Owner'}</strong>
                          {tInfo?.to_address && <span className="text-[9px] font-mono text-slate-400 truncate block">{tInfo.to_address}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Transactions</span>
                    <span className="font-mono font-bold text-sm text-blue-400 mt-0.5 block">
                      {selectedBlock.transactionsCount} txs
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Gas Used</span>
                    <span className="font-mono font-bold text-sm text-slate-200 mt-0.5 block">
                      {selectedBlock.gasUsed}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Timestamp</span>
                    <span className="font-medium text-xs text-slate-200 mt-0.5 block">
                      {formatDate(selectedBlock.timestamp)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Gas Limit</span>
                    <span className="font-mono text-xs text-slate-300 mt-0.5 block">
                      {selectedBlock.gasLimit || 'N/A'}
                    </span>
                  </div>
                </div>

                {selectedBlock.miner && (
                  <div className="pt-1">
                    <span className="text-[10px] text-slate-400 block mb-1">Mined By</span>
                    <span className="font-mono text-[11px] text-slate-300 break-all block">
                      {selectedBlock.miner}
                    </span>
                  </div>
                )}

                {user?.role === 'ADMIN' && blockDetailView === 'advanced' && (
                  <div className="mt-4 pt-3 border-t border-slate-800 bg-slate-950/80 p-3.5 rounded-lg space-y-2.5 font-mono text-[11px]">
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold font-sans text-xs mb-2">
                      <ShieldCheck className="h-4 w-4" />
                      Merkle-Patricia State Roots
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Transactions Root:</span>
                      <span className="text-slate-200 break-all select-all">{selectedBlock.transactionsRoot || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">State Root:</span>
                      <span className="text-slate-200 break-all select-all">{selectedBlock.stateRoot || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Receipts Root:</span>
                      <span className="text-slate-200 break-all select-all">{selectedBlock.receiptsRoot || 'N/A'}</span>
                    </div>
                    {selectedBlock.baseFeePerGas && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">Base Fee Per Gas:</span>
                        <span className="text-slate-200">{selectedBlock.baseFeePerGas}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedBlock.transactions && selectedBlock.transactions.length > 0 && (
                  <div className="pt-3 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-2 font-semibold">
                      Included Transactions ({selectedBlock.transactions.length}):
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[11px]">
                      {selectedBlock.transactions.map((txh, i) => (
                        <div
                          key={i}
                          className="p-2 rounded bg-slate-950 border border-slate-800 text-blue-400 hover:text-blue-300 break-all flex items-center justify-between"
                        >
                          <span className="truncate max-w-[340px]">{txh}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSidePanelOpen(false)}>
                Close Panel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Full Block Details (Basic View vs. Advanced View) */}
      {selectedBlock && !sidePanelOpen && (
        <Modal
          isOpen={Boolean(selectedBlock)}
          onClose={() => {
            setSelectedBlock(null)
            setBlockDetailView('basic')
          }}
          title={`Block Details #${selectedBlock.blockNumber}`}
          description={
            user?.role === 'ADMIN'
              ? 'EVM Consensus Block with cryptographic state roots and gas telemetry.'
              : 'EVM Consensus Block verified on PropChain ledger.'
          }
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* View selector for ADMIN */}
            {user?.role === 'ADMIN' && (
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setBlockDetailView('basic')}
                  className={`px-3 py-1 rounded-md font-medium text-xs transition-colors ${
                    blockDetailView === 'basic'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Basic View
                </button>
                <button
                  onClick={() => setBlockDetailView('advanced')}
                  className={`px-3 py-1 rounded-md font-medium text-xs transition-colors flex items-center gap-1 ${
                    blockDetailView === 'advanced'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  Advanced Technical View (Admin)
                </button>
              </div>
            )}

            {/* Basic Information (Visible to Seller, Buyer, Verifier, Legal Authority & Admin) */}
            <div className="space-y-2.5 font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Block Number:</span>
                <span className="font-bold text-slate-900 text-sm">#{selectedBlock.blockNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Block Type:</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getBlockTypeBadgeClass(
                    selectedBlock.blockType
                  )}`}
                >
                  {selectedBlock.blockType || 'Consensus Block'}
                </span>
              </div>
              <div className="space-y-1 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans block">Block Hash:</span>
                <span className="text-slate-800 break-all font-semibold select-all text-[11px]">{selectedBlock.hash}</span>
              </div>
              <div className="space-y-1 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans block">Previous Block Hash (Parent):</span>
                <span className="text-slate-600 break-all select-all text-[11px]">{selectedBlock.parentHash}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Transaction Count:</span>
                <span className="font-bold text-blue-700">{selectedBlock.transactionsCount} txs included</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Timestamp:</span>
                <span className="text-slate-800 font-sans">{formatDate(selectedBlock.timestamp)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Gas Used:</span>
                <span className="text-slate-800">{selectedBlock.gasUsed}</span>
              </div>
            </div>

            {/* Advanced Technical View (Strictly for ADMIN) */}
            {user?.role === 'ADMIN' && blockDetailView === 'advanced' && (
              <div className="mt-4 pt-3 border-t border-blue-100 bg-slate-50 p-3.5 rounded-lg space-y-2.5 font-mono text-xs">
                <div className="flex items-center gap-1.5 text-blue-700 font-bold font-sans text-xs mb-2">
                  <Cpu className="h-4 w-4" />
                  <span>Ethereum EVM Technical State Roots & Gas Telemetry</span>
                </div>
                <div className="space-y-1 py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans block">Transactions Root (transactionsRoot):</span>
                  <span className="text-slate-900 break-all select-all text-[11px] font-medium">
                    {selectedBlock.transactionsRoot || 'N/A'}
                  </span>
                </div>
                <div className="space-y-1 py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans block">State Root (stateRoot):</span>
                  <span className="text-slate-900 break-all select-all text-[11px] font-medium">
                    {selectedBlock.stateRoot || 'N/A'}
                  </span>
                </div>
                <div className="space-y-1 py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans block">Receipts Root (receiptsRoot):</span>
                  <span className="text-slate-900 break-all select-all text-[11px] font-medium">
                    {selectedBlock.receiptsRoot || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans">Gas Limit:</span>
                  <span className="text-slate-800 font-semibold">{selectedBlock.gasLimit || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans">Base Fee Per Gas:</span>
                  <span className="text-slate-800">{selectedBlock.baseFeePerGas || 'N/A'}</span>
                </div>
                <div className="space-y-1 py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans block">Miner / Block Producer:</span>
                  <span className="text-slate-800 break-all select-all text-[11px]">{selectedBlock.miner || 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Included Transactions List */}
            {selectedBlock.transactions && selectedBlock.transactions.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-600 font-sans block mb-1 font-semibold">
                  Included Transactions ({selectedBlock.transactions.length}):
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto font-mono">
                  {selectedBlock.transactions.map((txh, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        const found = transactions.find((t) => t.hash.toLowerCase() === txh.toLowerCase())
                        if (found) {
                          setSelectedTx(found)
                        }
                      }}
                      className="text-[11px] text-blue-600 hover:underline select-all cursor-pointer truncate"
                      title="Click to inspect this transaction"
                    >
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
              <span className="text-slate-500 font-sans">Confirmation Status:</span>
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
              <span className="text-slate-500 font-sans">From Address:</span>
              <span className="text-slate-800 break-all">{getAddressLabel(selectedTx.from)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">To Address:</span>
              <span className="text-slate-800 break-all">{getAddressLabel(selectedTx.to)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Transaction Type / Event:</span>
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
                <span className="text-slate-500 font-sans block">Verified Document Hash (SHA-256):</span>
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
