export type TransactionStatus =
  | 'Pending'
  | 'In Escrow'
  | 'Completed'
  | 'Disputed'
  | 'Cancelled'
  | 'DRAFT'
  | 'INITIATED'
  | 'PENDING_SELLER_ACCEPTANCE'
  | 'PENDING_DOCUMENT_VERIFICATION'
  | 'PENDING_APPROVALS'
  | 'READY_FOR_LEGAL_CONFIRMATION'
  | 'LEGALLY_REGISTERED'
  | 'READY_FOR_BLOCKCHAIN_EXECUTION'
  | 'BLOCKCHAIN_PENDING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED'
  | string

export type TransactionType = 'Sale' | 'Transfer' | 'Mortgage Lien' | 'Title Deed Release' | 'SALE' | 'LEASE' | string

export interface Transaction {
  id: string
  transactionId: string // e.g. "TXN-9021"
  transaction_number?: string
  propertyId: string
  property_id?: string
  propertyTitle: string
  property_title?: string
  buyerName: string
  buyer_name?: string
  buyerWallet: string
  sellerName: string
  seller_name?: string
  sellerWallet: string
  amount: number
  proposed_amount?: number | string
  currency: 'USD' | 'ETH' | 'USDC' | 'INR' | string
  status: TransactionStatus
  type: TransactionType
  transaction_type?: string
  escrowStatus: 'Awaiting Deposit' | 'Funded' | 'Released' | 'Refunded' | string
  initiatedAt: string
  created_at?: string
  completedAt?: string
  blockchainTxHash?: string
  blockchain_tx_hash?: string
  blockNumber?: number
  blockchain_block_number?: number
  blockchain_error?: string
  property_number?: string
  propertyNumber?: string
  purchase_mode?: 'TOKEN_PURCHASE' | 'ENTIRE_PROPERTY' | string
  purchaseMode?: 'TOKEN_PURCHASE' | 'ENTIRE_PROPERTY' | string
  token_quantity?: number | null
  tokenQuantity?: number | null
  token_symbol?: string | null
  tokenSymbol?: string | null
  ownership_percentage?: number | null
  ownershipPercentage?: number | null
  property_is_tokenized?: boolean
}
