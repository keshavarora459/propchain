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
  FileCheck2,
  Activity,
  Flame,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { truncateHash, formatDate } from '@/lib/utils'
import { ethers } from 'ethers'
import {
  CONTRACT_ADDRESSES,
  PROPERTY_REGISTRY_ABI,
  OWNERSHIP_REGISTRY_ABI,
  TRANSACTION_MANAGER_ABI,
} from '@/contracts/contractConfig'
import { blockchainService } from '@/services/blockchainService'
import type { BlockchainStats } from '@/types/blockchain'

export interface RealBlock {
  blockNumber: number
  hash: string
  parentHash: string
  timestamp: string
  transactionsCount: number
  gasUsed: string
  miner?: string
}

export interface RealTx {
  hash: string
  blockNumber: number
  from: string
  to: string
  event: string
  propertyId?: string
  documentHash?: string
  value?: string
  gasUsed: string
  status: 'Confirmed' | 'Reverted'
  timestamp: string
  details?: string
}

const RPC_URL = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'

// Interfaces for decoding contract logs and calldata
const propertyRegistryInterface = new ethers.Interface(PROPERTY_REGISTRY_ABI)
const ownershipRegistryInterface = new ethers.Interface(OWNERSHIP_REGISTRY_ABI)
const transactionManagerInterface = new ethers.Interface(TRANSACTION_MANAGER_ABI)

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
  const deployerAddr = (import.meta.env.VITE_BLOCKCHAIN_DEPLOYER_ADDRESS || '').toLowerCase()
  if (deployerAddr && addr === deployerAddr) {
    return 'Hardhat Deployer / Admin'
  }
  return truncateHash(address, 6, 4)
}

export const BlockchainExplorerPage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<any | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userRecords, setUserRecords] = useState<{
    property_ids: string[]
    document_hashes: string[]
    tx_hashes: string[]
    wallet_addresses: string[]
  } | null>(null)

  useEffect(() => {
    if (user?.role === 'PROPERTY_OWNER' || user?.role === 'BUYER') {
      apiClient.get('/blockchain/my-records')
        .then((res) => {
          if (res.data) setUserRecords(res.data)
        })
        .catch((err) => console.warn('Could not fetch user blockchain records:', err))
    }
  }, [user?.role])

  const [blocks, setBlocks] = useState<RealBlock[]>([])
  const [transactions, setTransactions] = useState<RealTx[]>([])
  const [stats, setStats] = useState<BlockchainStats | null>(null)
  const [networkInfo, setNetworkInfo] = useState({
    name: 'Hardhat EVM Localhost',
    chainId: 31337,
    latestBlock: 0,
    status: 'Connecting...',
    rpcUrl: RPC_URL,
  })

  const loadBlockchainData = useCallback(async () => {
    setIsLoading(true)
    let connected = false

    // 1. Primary: Load via authenticated backend API (bypasses browser CORS & PNA restrictions)
    try {
      const [statusRes, blocksRes, txsRes, statsRes] = await Promise.allSettled([
        blockchainService.getNetworkStatus(),
        blockchainService.getLatestBlocks(25),
        blockchainService.getRecentTransactions(25),
        blockchainService.getStats(),
      ])

      if (statusRes.status === 'fulfilled' && statusRes.value) {
        const s = statusRes.value
        if (s.syncStatus !== 'Offline') {
          connected = true
          setNetworkInfo({
            name: s.networkName || 'Hardhat EVM Localhost',
            chainId: s.chainId || 31337,
            latestBlock: s.latestBlock || 0,
            status: 'Connected',
            rpcUrl: s.rpcUrl || RPC_URL,
          })
        }
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value)
      }

      const fetchedBlocks: RealBlock[] = []
      const fetchedTxs: RealTx[] = []

      if (blocksRes.status === 'fulfilled' && Array.isArray(blocksRes.value)) {
        for (const b of blocksRes.value) {
          fetchedBlocks.push({
            blockNumber: b.blockNumber,
            hash: b.hash,
            parentHash: b.parentHash,
            timestamp: b.timestamp,
            transactionsCount: b.transactionsCount,
            gasUsed: b.gasUsed,
            miner: b.miner,
          })
        }
      }

      if (txsRes.status === 'fulfilled' && Array.isArray(txsRes.value)) {
        for (const t of txsRes.value) {
          fetchedTxs.push({
            hash: t.hash,
            blockNumber: t.blockNumber,
            from: t.from,
            to: t.to,
            event: t.event,
            propertyId: t.propertyId,
            documentHash: t.documentHash,
            value: t.value || '0.0 ETH',
            gasUsed: t.gasUsed || '21,000 gas',
            status: (t.status === 'Reverted' ? 'Reverted' : 'Confirmed') as 'Confirmed' | 'Reverted',
            timestamp: t.timestamp,
            details: t.details,
          })
        }
      }

      if (connected) {
        setBlocks(fetchedBlocks)
        setTransactions(fetchedTxs)
        setIsLoading(false)
        return
      }
    } catch (apiErr) {
      console.warn('Backend blockchain API retrieval notice:', apiErr)
    }

    // 2. Direct RPC Fallback (used when direct client connection is available)
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL)
      const currentBlockNum = await provider.getBlockNumber()
      const network = await provider.getNetwork()

      setNetworkInfo({
        name: network.name === 'unknown' ? 'Hardhat EVM Localhost' : network.name,
        chainId: Number(network.chainId),
        latestBlock: currentBlockNum,
        status: 'Connected',
        rpcUrl: RPC_URL,
      })

      const fetchedBlocks: RealBlock[] = []
      const fetchedTxs: RealTx[] = []

      const startBlock = currentBlockNum
      const endBlock = Math.max(0, currentBlockNum - 24)

      for (let i = startBlock; i >= endBlock; i--) {
        try {
          const block = await provider.getBlock(i, true)
          if (block) {
            const blockDate = new Date(Number(block.timestamp) * 1000).toISOString()

            fetchedBlocks.push({
              blockNumber: block.number,
              hash: block.hash || '',
              parentHash: block.parentHash || '',
              timestamp: blockDate,
              transactionsCount: block.transactions.length,
              gasUsed: `${Number(block.gasUsed).toLocaleString()} gas`,
              miner: block.miner,
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
                  } catch (txErr) {
                    console.warn(`Could not fetch tx ${t}:`, txErr)
                  }
                } else if (t && typeof t === 'object') {
                  rawTxs.push(t)
                }
              }
            }

            for (const tx of rawTxs) {
              let eventName = tx.to ? 'Smart Contract Call' : 'Contract Deployed'
              let propertyId: string | undefined = undefined
              let documentHash: string | undefined = undefined
              let details: string | undefined = undefined
              let txStatus: 'Confirmed' | 'Reverted' = 'Confirmed'
              let gasUsedStr = '0 gas'

              try {
                const receipt = await provider.getTransactionReceipt(tx.hash)
                if (receipt) {
                  txStatus = receipt.status === 1 ? 'Confirmed' : 'Reverted'
                  gasUsedStr = `${Number(receipt.gasUsed).toLocaleString()} gas`

                  if (!tx.to) {
                    eventName = 'Contract Deployed'
                    if (receipt.contractAddress) {
                      const ca = receipt.contractAddress.toLowerCase()
                      if (ca === CONTRACT_ADDRESSES.PROPERTY_REGISTRY.toLowerCase()) {
                        details = 'PropertyRegistry Deployed'
                      } else if (ca === CONTRACT_ADDRESSES.OWNERSHIP_REGISTRY.toLowerCase()) {
                        details = 'OwnershipRegistry Deployed'
                      } else if (ca === CONTRACT_ADDRESSES.TRANSACTION_MANAGER.toLowerCase()) {
                        details = 'TransactionManager Deployed'
                      }
                    }
                  } else {
                    if (tx.data && tx.data !== '0x') {
                      try {
                        const propTx = propertyRegistryInterface.parseTransaction({ data: tx.data, value: tx.value })
                        if (propTx) {
                          if (propTx.name === 'registerProperty') {
                            eventName = 'Property Registered'
                            propertyId = propTx.args.propertyId
                            documentHash = propTx.args.documentHash
                            details = `Property ${propertyId} anchored on-chain`
                          } else if (propTx.name === 'updateDocumentHash') {
                            eventName = 'Document Updated'
                            propertyId = propTx.args.propertyId
                            documentHash = propTx.args.newDocumentHash
                          }
                        }
                      } catch {}

                      try {
                        const ownTx = ownershipRegistryInterface.parseTransaction({ data: tx.data, value: tx.value })
                        if (ownTx) {
                          if (ownTx.name === 'recordInitialOwnership') {
                            eventName = 'Genesis Ownership Recorded'
                            propertyId = ownTx.args.propertyId
                            details = `Genesis title deed for ${propertyId}`
                          } else if (ownTx.name === 'recordOwnershipTransfer') {
                            eventName = 'Ownership Transferred'
                            propertyId = ownTx.args.propertyId
                            details = `Conveyance: ${truncateHash(ownTx.args.previousOwner, 6, 4)} → ${truncateHash(ownTx.args.newOwner, 6, 4)}`
                          }
                        }
                      } catch {}

                      try {
                        const tmTx = transactionManagerInterface.parseTransaction({ data: tx.data, value: tx.value })
                        if (tmTx) {
                          eventName = 'Conveyance Escrow Execution'
                          details = `Transaction ${tmTx.args?.transactionId ?? ''} settled on-chain`
                        }
                      } catch {}
                    }
                  }
                }
              } catch (receiptErr) {
                console.warn(`Could not fetch receipt for tx ${tx.hash}:`, receiptErr)
              }

              fetchedTxs.push({
                hash: tx.hash,
                blockNumber: block.number,
                from: tx.from,
                to: tx.to || 'Contract Deployment',
                event: eventName,
                propertyId,
                documentHash,
                details,
                gasUsed: gasUsedStr,
                status: txStatus,
                value: ethers.formatEther(tx.value || 0) + ' ETH',
                timestamp: blockDate,
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
      if (!connected) {
        setNetworkInfo((prev) => ({
          ...prev,
          status: 'Offline / Standby',
        }))
        setBlocks([])
        setTransactions([])
      }
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

    const applyScopingAndSetResult = (res: any) => {
      if ((user?.role === 'PROPERTY_OWNER' || user?.role === 'BUYER') && userRecords) {
        if (res.type === 'transaction') {
          const t = res.data
          const isAllowed = (t.propertyId && userRecords.property_ids.some((p: string) => p.toLowerCase() === t.propertyId.toLowerCase())) ||
            (t.documentHash && userRecords.document_hashes.some((d: string) => d.toLowerCase() === t.documentHash.toLowerCase())) ||
            userRecords.tx_hashes.some((h: string) => h.toLowerCase() === t.hash.toLowerCase()) ||
            userRecords.wallet_addresses.some((w: string) => (t.from && w.toLowerCase() === t.from.toLowerCase()) || (t.to && w.toLowerCase() === t.to.toLowerCase()))
          if (!isAllowed) {
            setSearchResult({ type: 'not_found', query: rawQuery, customMessage: 'No matching record found among your properties.' })
            return
          }
        } else if (res.type === 'address') {
          const addr = res.data.address.toLowerCase()
          if (!userRecords.wallet_addresses.includes(addr)) {
            setSearchResult({ type: 'not_found', query: rawQuery, customMessage: 'No matching record found among your properties.' })
            return
          }
        } else if (res.type === 'block') {
          const hasOwnTx = displayedTransactions.some((t) => t.blockNumber === res.data.blockNumber)
          if (!hasOwnTx) {
            setSearchResult({ type: 'not_found', query: rawQuery, customMessage: 'No matching record found among your properties.' })
            return
          }
        }
      }
      setSearchResult(res)
    }

    setIsSearching(true)

    // 1. Backend Search Lookup
    try {
      const backendRes = await blockchainService.search(rawQuery)
      if (backendRes && backendRes.type && backendRes.type !== 'not_found') {
        setSearchResult(backendRes)
        setIsSearching(false)
        return
      }
    } catch (bErr) {
      console.warn('Backend search check notice:', bErr)
    }

    // 2. Direct RPC Search Lookup
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL)

      // 2a. Block height
      if (/^\d+$/.test(rawQuery)) {
        const blockNum = parseInt(rawQuery, 10)
        const block = await provider.getBlock(blockNum, true)
        if (block) {
          applyScopingAndSetResult({
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
          setIsSearching(false)
          return
        }
      }

      // 2b. Hex Query (64 or 66 chars)
      const is64Hex = /^[0-9a-fA-F]{64}$/.test(rawQuery)
      const is66Hex = /^0x[0-9a-fA-F]{64}$/.test(rawQuery)

      if (is64Hex || is66Hex) {
        const normalizedHex = is64Hex ? `0x${rawQuery}` : rawQuery


        // 2a. Check if it matches a documentHash in on-chain PropertyRegistered events
        try {
          const propContract = new ethers.Contract(
            CONTRACT_ADDRESSES.PROPERTY_REGISTRY,
            PROPERTY_REGISTRY_ABI,
            provider
          )
          const filter = propContract.filters.PropertyRegistered()
          const events = await propContract.queryFilter(filter, 0, 'latest')

          for (const ev of events) {
            const evArgs = (ev as any).args
            if (
              evArgs &&
              evArgs.documentHash &&
              evArgs.documentHash.toLowerCase() === normalizedHex.toLowerCase()
            ) {
              const receipt = await provider.getTransactionReceipt(ev.transactionHash)
              let propertyId = evArgs.propertyId

              try {
                const tx = await provider.getTransaction(ev.transactionHash)
                if (tx) {
                  const parsed = propertyRegistryInterface.parseTransaction({ data: tx.data })
                  if (parsed?.args?.propertyId) propertyId = parsed.args.propertyId
                }
              } catch {}

              applyScopingAndSetResult({
                type: 'transaction',
                data: {
                  hash: ev.transactionHash,
                  blockNumber: ev.blockNumber,
                  from: evArgs.ownerWallet,
                  to: CONTRACT_ADDRESSES.PROPERTY_REGISTRY,
                  value: '0.0 ETH',
                  event: 'Property Registered (Title Deed Anchored)',
                  propertyId: typeof propertyId === 'string' ? propertyId : 'PROP-ON-CHAIN',
                  documentHash: evArgs.documentHash,
                  details: `Cryptographic SHA-256 Title Deed anchored in Block #${ev.blockNumber}`,
                  gasUsed: receipt ? `${Number(receipt.gasUsed).toLocaleString()} gas` : '0 gas',
                  status: 'Confirmed',
                },
              })
              return
            }
          }
        } catch (filterErr) {
          console.warn('Document hash filter lookup notice:', filterErr)
        }

        // 2b. Check if it matches a transaction in loaded ledger



        const localDocTx = transactions.find(
          (t) =>
            t.hash.toLowerCase() === normalizedHex.toLowerCase() ||
            (t.documentHash && t.documentHash.toLowerCase() === normalizedHex.toLowerCase())
        )
        if (localDocTx) {

          applyScopingAndSetResult({ type: 'transaction', data: localDocTx })


          setIsSearching(false)

          return
        }

        try {
          const tx = await provider.getTransaction(normalizedHex)
          if (tx) {
            const receipt = await provider.getTransactionReceipt(normalizedHex)

            let eventName = tx.to ? 'Smart Contract Call' : 'Contract Deployment'
            let propertyId: string | undefined = undefined
            let documentHash: string | undefined = undefined
            let details: string | undefined = undefined

            if (tx.data && tx.data !== '0x') {
              try {
                const propTx = propertyRegistryInterface.parseTransaction({ data: tx.data, value: tx.value })
                if (propTx?.name === 'registerProperty') {
                  eventName = 'Property Registered'
                  propertyId = propTx.args.propertyId
                  documentHash = propTx.args.documentHash
                  details = `Property ${propertyId} anchored on-chain`
                }
              } catch {}

              try {
                const ownTx = ownershipRegistryInterface.parseTransaction({ data: tx.data, value: tx.value })
                if (ownTx?.name === 'recordOwnershipTransfer') {
                  eventName = 'Ownership Transferred'
                  propertyId = ownTx.args.propertyId
                  details = `Conveyance: ${truncateHash(ownTx.args.previousOwner, 6, 4)} → ${truncateHash(ownTx.args.newOwner, 6, 4)}`
                } else if (ownTx?.name === 'recordInitialOwnership') {
                  eventName = 'Genesis Ownership Recorded'
                  propertyId = ownTx.args.propertyId
                }
              } catch {}
            }

            applyScopingAndSetResult({



              type: 'transaction',
              data: {
                hash: tx.hash,
                blockNumber: tx.blockNumber,
                from: tx.from,
                to: tx.to || 'Contract Deployment',
                value: ethers.formatEther(tx.value || 0) + ' ETH',
                event: eventName,
                propertyId,
                documentHash,
                details,
                gasUsed: receipt ? `${Number(receipt.gasUsed).toLocaleString()} gas` : '0 gas',
                status: receipt ? (receipt.status === 1 ? 'Confirmed' : 'Reverted') : 'Confirmed',
              },
            })

            return
          }
        } catch {}

        // 2d. Check if it is a Block Hash
        try {
          const block = await provider.getBlock(normalizedHex, true)
          if (block) {
            applyScopingAndSetResult({
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

            setIsSearching(false)

            return
          }
        } catch {}
      }

      // 2c. Address query
      if (ethers.isAddress(rawQuery)) {
        try {
          const code = await provider.getCode(rawQuery)
          const isContract = code !== '0x'
          const balance = await provider.getBalance(rawQuery)
          const txCount = await provider.getTransactionCount(rawQuery)

          let label = isContract ? 'Smart Contract' : 'User Wallet (EOA)'
          const lower = rawQuery.toLowerCase()
          if (lower === CONTRACT_ADDRESSES.PROPERTY_REGISTRY.toLowerCase()) {
            label = 'PropertyRegistry (PropChain Smart Contract)'
          } else if (lower === CONTRACT_ADDRESSES.OWNERSHIP_REGISTRY.toLowerCase()) {
            label = 'OwnershipRegistry (PropChain Smart Contract)'
          } else if (lower === CONTRACT_ADDRESSES.TRANSACTION_MANAGER.toLowerCase()) {
            label = 'TransactionManager (PropChain Smart Contract)'
          } else if (lower === (import.meta.env.VITE_BLOCKCHAIN_DEPLOYER_ADDRESS || '').toLowerCase()) {
            label = 'Hardhat Genesis Deployer / Platform Authority'
          }

          const matchingTxs = transactions.filter(
            (t) => t.from.toLowerCase() === lower || t.to.toLowerCase() === lower
          )

          applyScopingAndSetResult({
            type: 'address',
            data: {
              address: rawQuery,
              label,
              isContract,
              balance: ethers.formatEther(balance) + ' ETH',
              txCount,
              matchingTxsCount: matchingTxs.length,
            },
          })
          setIsSearching(false)
          return
        } catch {}
      }

      // 2d. Property ID or hash in local lists
      const propTx = transactions.find(
        (t) =>
          (t.propertyId && t.propertyId.toLowerCase() === rawQuery.toLowerCase()) ||
          t.hash.toLowerCase() === rawQuery.toLowerCase()
      )
      if (propTx) {

        applyScopingAndSetResult({ type: 'transaction', data: propTx })
        return
      }

      // 5. Fallback check in locally loaded items
      const localTx = transactions.find((t) => t.hash.toLowerCase() === rawQuery.toLowerCase())
      if (localTx) {
        applyScopingAndSetResult({ type: 'transaction', data: localTx })


        setIsSearching(false)

        return
      }

      const localBlock = blocks.find(
        (b) => String(b.blockNumber) === rawQuery || b.hash.toLowerCase() === rawQuery.toLowerCase()
      )
      if (localBlock) {

        applyScopingAndSetResult({ type: 'block', data: localBlock })


        setIsSearching(false)

        return
      }

      setSearchResult({
        type: 'not_found',
        query: rawQuery,
      })
    } catch (err) {
      console.error('Search error:', err)
      setSearchResult({
        type: 'not_found',
        query: rawQuery,
      })
    } finally {
      setIsSearching(false)
    }
  }

  const isConnected = networkInfo.status === 'Connected'

  const displayedTransactions = ((user?.role === 'PROPERTY_OWNER' || user?.role === 'BUYER') && userRecords)
    ? transactions.filter((t) => {
        const matchProp = t.propertyId && userRecords.property_ids.some(pid => pid.toLowerCase() === t.propertyId!.toLowerCase())
        const matchDoc = t.documentHash && userRecords.document_hashes.some(dh => dh.toLowerCase() === t.documentHash!.toLowerCase())
        const matchHash = userRecords.tx_hashes.some(th => th.toLowerCase() === t.hash.toLowerCase())
        const matchAddr = userRecords.wallet_addresses.some(wa => wa.toLowerCase() === t.from.toLowerCase() || wa.toLowerCase() === t.to.toLowerCase())
        return matchProp || matchDoc || matchHash || matchAddr
      })
    : transactions

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

      {/* Connection Warning Banner if Offline */}
      {!isConnected && !isLoading && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-100">Blockchain Node Unreachable ({networkInfo.rpcUrl})</p>
            <p className="text-amber-300/80">
              Ensure your Hardhat local node is running (<code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono">npx hardhat node</code> in <code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono">blockchain/</code>). Then click <strong>Refresh Ledger</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Blockchain Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Network Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-base font-bold text-slate-900">{isConnected ? 'Online & Synced' : 'Offline'}</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{networkInfo.name} (Chain #{networkInfo.chainId})</p>
            </div>
            <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Latest Block Height</p>
              <p className="text-xl font-bold font-mono text-blue-600 mt-1">#{networkInfo.latestBlock}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{blocks.length} Verified blocks indexed</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Blocks className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Consensus Transactions</p>
              <p className="text-xl font-bold font-mono text-indigo-600 mt-1">
                {stats?.totalTransactions ?? transactions.length}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">On-chain state transitions</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Cpu className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Gas Price / Fee</p>
              <p className="text-xl font-bold font-mono text-amber-600 mt-1">
                {stats?.gasPriceGwei ?? 0.5} <span className="text-xs font-normal text-slate-500">Gwei</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Automated gas estimation</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Flame className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hero Search Bar */}
      <Card className="bg-slate-950 text-white border-slate-800">
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
              <span>Chain: {networkInfo.name}</span>
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

      {/* Query Search Result (if searched) */}
      {searchResult && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm">Ledger Query Result</CardTitle>
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
                  <span className="text-slate-500">Sender (From):</span>
                  <span className="text-slate-800 break-all">{searchResult.data.from}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Receiver (To):</span>
                  <span className="text-slate-800 break-all">{searchResult.data.to}</span>
                </div>
                {searchResult.data.gasUsed && (
                  <div className="flex justify-between py-1 border-b border-blue-100">
                    <span className="text-slate-500">Gas Used:</span>
                    <span className="text-slate-800">{searchResult.data.gasUsed}</span>
                  </div>
                )}
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
                    <span className="text-slate-500">Document SHA-256 Digest:</span>
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
                  <span className="text-slate-500">Previous Block Hash (Parent):</span>
                  <span className="text-slate-600 break-all">{searchResult.data.parentHash}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Transactions Count:</span>
                  <span className="font-bold text-blue-800">{searchResult.data.transactionsCount} txs included</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Gas Consumed:</span>
                  <span className="text-slate-800">{searchResult.data.gasUsed}</span>
                </div>
                {searchResult.data.timestamp && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Mined Timestamp:</span>
                    <span className="text-slate-800">{formatDate(searchResult.data.timestamp)}</span>
                  </div>
                )}
              </div>
            ) : searchResult.type === 'address' ? (
              <div className="space-y-2 font-mono">
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">EVM Address:</span>
                  <span className="font-bold text-slate-900 break-all">{searchResult.data.address}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Entity Type:</span>
                  <span className="font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-[11px]">
                    {searchResult.data.label}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Native Balance:</span>
                  <span className="text-slate-900 font-bold">{searchResult.data.balance}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Transaction Count (Nonce):</span>
                  <span className="text-slate-800">{searchResult.data.txCount} transactions</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Recent Transactions on Ledger:</span>
                  <span className="text-emerald-700 font-semibold">{searchResult.data.matchingTxsCount} found</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">
                  {searchResult.customMessage || `No matching block, transaction, address, or document hash found for "${searchResult.query}".`}
                </p>
                <p className="text-[11px] text-slate-500">
                  Please verify the query format: Block number (e.g. <code>1</code>), Transaction hash (<code>0x...</code>), Document hash (64 hex characters), Address (<code>0x...</code>), or Property ID (<code>PROP-...</code>).
                </p>
              </div>
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
                <p className="font-medium">No blocks mined yet on the local ledger.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  When contracts are deployed or transactions are mined, blocks will appear here.
                </p>
              </div>
            ) : (
              blocks.map((blk) => (
                <div
                  key={blk.hash}
                  onClick={() =>
        
                    setSearchResult({
                      type: 'block',
                      data: blk,
                    })
                  }
                  className="p-4 flex items-center justify-between hover:bg-blue-50/50 cursor-pointer transition-colors"
                  title="Click to inspect block"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600">#{blk.blockNumber}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">{formatDate(blk.timestamp)}</span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500 mt-1">
                      Hash: <span className="font-semibold">{truncateHash(blk.hash, 8, 6)}</span>
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      Parent: {truncateHash(blk.parentHash, 6, 4)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 font-medium">
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
            ) : displayedTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="font-medium text-slate-600">
                  {(user?.role === 'PROPERTY_OWNER' || user?.role === 'BUYER') ? 'No on-chain transactions found for your account' : 'No on-chain transactions yet'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {(user?.role === 'PROPERTY_OWNER' || user?.role === 'BUYER')
                    ? 'Transactions will appear here once your registered properties or escrow transfers are anchored on-chain.'
                    : 'Transactions will appear here when contracts are deployed, properties are registered, or deeds are transferred.'}
                </p>
              </div>
            ) : (
              displayedTransactions.map((tx) => (
                <div
                  key={tx.hash}
                  onClick={() =>
        
                    setSearchResult({
                      type: 'transaction',
                      data: tx,
                    })
                  }
                  className="p-4 space-y-1.5 hover:bg-blue-50/50 cursor-pointer transition-colors"
                  title="Click to inspect transaction"
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
                      {tx.documentHash && (
                        <span
                          className="font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded text-[9px] flex items-center gap-0.5"
                          title={`Document Hash: ${tx.documentHash}`}
                        >
                          <FileCheck2 className="h-2.5 w-2.5 text-emerald-600" />
                          Deed SHA-256
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
  )
}

export default BlockchainExplorerPage
