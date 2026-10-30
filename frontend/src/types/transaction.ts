export type TransactionStatus = 'Pending' | 'In Escrow' | 'Completed' | 'Disputed' | 'Cancelled'
export type TransactionType = 'Sale' | 'Transfer' | 'Mortgage Lien' | 'Title Deed Release'

export interface Transaction {
  id: string
  transactionId: string // e.g. "TXN-9021"
  propertyId: string
  propertyTitle: string
  buyerName: string
  buyerWallet: string
  sellerName: string
  sellerWallet: string
  amount: number
  currency: 'USD' | 'ETH' | 'USDC'
  status: TransactionStatus
  type: TransactionType
  escrowStatus: 'Awaiting Deposit' | 'Funded' | 'Released' | 'Refunded'
  initiatedAt: string
  completedAt?: string
  blockchainTxHash?: string
  blockNumber?: number
}

