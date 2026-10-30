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
  fee: string
  status: 'Confirmed' | 'Pending' | 'Failed'
  event: string
  timestamp: string
}

export interface BlockchainNetworkStatus {
  chainId: number
  networkName: string
  latestBlock: number
  gasPriceGwei: number
  syncStatus: 'Synced' | 'Syncing' | 'Offline'
  nodeVersion: string
}

