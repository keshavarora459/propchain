import React, { useState, useEffect, useCallback } from 'react'
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
  if (addr === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266') {
    return 'Hardhat Deployer / Admin'
  }
  return truncateHash(address, 6, 4)
}

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
    status: 'Connecting...',
    rpcUrl: RPC_URL,
  })

  const loadBlockchainData = useCallback(async () => {
    setIsLoading(true)
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

      // Fetch the last up to 25 blocks (from latest down to 0)
      const startBlock = currentBlockNum
      const endBlock = Math.max(0, currentBlockNum - 24)

      for (let i = startBlock; i >= endBlock; i--) {
        try {
          const block = await provider.getBlock(i, true)
          if (block) {
            const blockDate = new Date(Number(block.timestamp) * 1000).toISOString()

            fetchedBlocks.push({
              blockNumber: block.number,
              hash: block.hash || `0x${i}`,
              parentHash: block.parentHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
              timestamp: blockDate,
              transactionsCount: block.transactions.length,
              gasUsed: `${Number(block.gasUsed).toLocaleString()} gas`,
              miner: block.miner,
            })

            // Extract and decode real transactions from block
            for (const tx of block.prefetchedTransactions) {
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
                    // 1. Decode calldata if available
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
                    }

                    // 2. Decode receipt logs
                    for (const log of receipt.logs) {
                      try {
                        const parsedProp = propertyRegistryInterface.parseLog(log)
                        if (parsedProp) {
                          if (parsedProp.name === 'PropertyRegistered') {
                            eventName = 'Property Registered'
                            if (!propertyId && typeof parsedProp.args.propertyId === 'string') {
                              propertyId = parsedProp.args.propertyId
                            }
                            if (!documentHash && parsedProp.args.documentHash) {
                              documentHash = parsedProp.args.documentHash
                            }
                            if (propertyId) details = `Property ${propertyId} anchored on-chain`
                            break
                          } else if (parsedProp.name === 'PropertyDocumentUpdated') {
                            eventName = 'Document Updated'
                            break
                          }
                        }
                      } catch {}

                      try {
                        const parsedOwn = ownershipRegistryInterface.parseLog(log)
                        if (parsedOwn) {
                          if (parsedOwn.name === 'InitialOwnershipRecorded') {
                            eventName = 'Genesis Ownership Recorded'
                            if (!propertyId && typeof parsedOwn.args.propertyId === 'string') {
                              propertyId = parsedOwn.args.propertyId
                            }
                            break
                          } else if (parsedOwn.name === 'OwnershipTransferred') {
                            eventName = 'Ownership Transferred'
                            if (!propertyId && typeof parsedOwn.args.propertyId === 'string') {
                              propertyId = parsedOwn.args.propertyId
                            }
                            break
                          }
                        }
                      } catch {}

                      try {
                        const parsedTx = transactionManagerInterface.parseLog(log)
                        if (parsedTx) {
                          if (parsedTx.name === 'TransactionCompleted') {
                            eventName = 'Conveyance Completed'
                            propertyId = parsedTx.args.propertyId
                            details = `Escrow ${parsedTx.args.transactionId} settled`
                            break
                          }
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
      setNetworkInfo((prev) => ({
        ...prev,
        status: 'Offline / Standby',
      }))
      setBlocks([])
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBlockchainData()
  }, [loadBlockchainData])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawQuery = searchQuery.trim()
    if (!rawQuery) {
      setSearchResult(null)
      return
    }

    setIsSearching(true)
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL)

      // 1. Check if number (block height)
      if (/^\d+$/.test(rawQuery)) {
        const blockNum = parseInt(rawQuery, 10)
        const block = await provider.getBlock(blockNum, true)
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

      // 2. Check if 64-char or 66-char Hex (documentHash, txHash, or blockHash)
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

              setSearchResult({
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
                  gasUsed: receipt ? `${Number(receipt.gasUsed).toLocaleString()} gas` : '211,555 gas',
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
          (t) => t.documentHash && t.documentHash.toLowerCase() === normalizedHex.toLowerCase()
        )
        if (localDocTx) {
          setSearchResult({ type: 'transaction', data: localDocTx })
          return
        }

        // 2c. Check if it is a Transaction Hash
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

            setSearchResult({
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
        } catch {}
      }

      // 3. Check if Ethereum Address (Wallet or Contract)
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
          } else if (lower === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266') {
            label = 'Hardhat Genesis Deployer / Platform Authority'
          }

          const matchingTxs = transactions.filter(
            (t) => t.from.toLowerCase() === lower || t.to.toLowerCase() === lower
          )

          setSearchResult({
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
          return
        } catch {}
      }

      // 4. Check for Property ID match (PROP-...)
      const propTx = transactions.find(
        (t) => t.propertyId && t.propertyId.toLowerCase() === rawQuery.toLowerCase()
      )
      if (propTx) {
        setSearchResult({ type: 'transaction', data: propTx })
        return
      }

      // 5. Fallback check in locally loaded items
      const localTx = transactions.find((t) => t.hash.toLowerCase() === rawQuery.toLowerCase())
      if (localTx) {
        setSearchResult({ type: 'transaction', data: localTx })
        return
      }

      const localBlock = blocks.find(
        (b) => String(b.blockNumber) === rawQuery || b.hash.toLowerCase() === rawQuery.toLowerCase()
      )
      if (localBlock) {
        setSearchResult({ type: 'block', data: localBlock })
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
            <p className="font-semibold text-amber-100">Blockchain Node Unreachable ({RPC_URL})</p>
            <p className="text-amber-300/80">
              Ensure your Hardhat local node is running (<code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono">npx hardhat node</code> in <code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono">blockchain/</code>). Then click <strong>Refresh Ledger</strong>.
            </p>
          </div>
        </div>
      )}

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
                <div className="flex justify-between py-1 border-b border-blue-100">
                  <span className="text-slate-500">Tx Hash:</span>
                  <span className="font-bold text-slate-900 break-all">{searchResult.data.hash}</span>
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
                  No matching block, transaction, address, or document hash found for "{searchResult.query}".
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
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="font-medium text-slate-600">No on-chain transactions yet</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Transactions will appear here when contracts are deployed, properties are registered, or deeds are transferred.
                </p>
              </div>
            ) : (
              transactions.map((tx) => (
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
                    <span className="font-mono font-semibold text-slate-900">
                      {truncateHash(tx.hash, 8, 6)}
                    </span>
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
