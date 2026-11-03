export interface BlockchainBlock {
  blockNumber: number
  hash: string
  parentHash: string
  timestamp: string
  transactionsCount: number
  miner: string
  gasUsed: string
}

export interface BlockchainTx {
  hash: string
  blockNumber: number
  from: string
  to: string
  contractAddress?: string
  value: string
  fee?: string
  gasUsed?: string
  status: 'Confirmed' | 'Pending' | 'Failed' | 'Reverted'
  event: string
  propertyId?: string
  documentHash?: string
  details?: string
  timestamp: string
}

export interface BlockchainNetworkStatus {
  chainId: number
  networkName: string
  latestBlock: number
  gasPriceGwei: number
  syncStatus: 'Synced' | 'Syncing' | 'Offline'
  nodeVersion: string
  rpcUrl?: string
}

export interface BlockchainStats {
  latestBlock: number
  totalBlocks: number
  totalTransactions: number
  totalPropertiesAnchored: number
  networkStatus: string
  chainId: number
  gasPriceGwei: number
  networkName: string
  contracts: Record<string, string>
}
