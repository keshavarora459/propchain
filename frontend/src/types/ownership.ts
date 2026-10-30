export interface OwnershipRecord {
  id: string
  propertyId: string
  propertyTitle: string
  currentOwnerName: string
  currentOwnerWallet: string
  previousOwnersCount: number
  acquisitionDate: string
  acquisitionType: 'Purchase' | 'Inheritance' | 'Transfer' | 'Initial Mint'
  purchasePrice: number
  blockchainBlockNumber: number
  transactionHash: string
  hasEncumbrances: boolean
  history: OwnershipHistoryEntry[]
}

export interface OwnershipHistoryEntry {
  id: string
  ownerName: string
  ownerWallet: string
  fromDate: string
  toDate: string | null
  transferType: 'Purchase' | 'Inheritance' | 'Transfer' | 'Initial Mint'
  transferAmount: number
  transactionHash: string
  blockNumber: number
  verifiedBy: string
}

