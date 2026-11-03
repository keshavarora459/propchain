export interface SellerProperty {
  id: string
  property_number: string
  title: string
  city: string
  state: string
  property_type: string
  valuation: number
  status: string
  verification_status: string
  blockchain_property_id?: string | null
}

export interface SellerOffer {
  id: string
  transaction_number: string
  property_id: string
  property_title: string
  buyer_name: string
  purchase_price: number
  amount: number
  status: string
  blockchain_tx_hash?: string | null
  created_at: string | null
}

export interface SellerDocument {
  id: string
  property_id: string
  title: string
  file_name: string
  original_filename?: string
  document_type: string
  status: string
  document_hash: string
  created_at: string | null
  review_notes?: string | null
}

export interface SellerMetrics {
  listed_properties_count: number
  verified_properties_count: number
  portfolio_valuation: number
  portfolio_valuation_usd: number
  received_offers_count: number
  active_sales_count: number
  completed_sales_count: number
  pending_purchase_requests?: any[]
  my_properties: SellerProperty[]
  received_offers: SellerOffer[]
  my_documents: SellerDocument[]
}

export interface SellerDashboardData {
  user_role: string
  seller_metrics?: SellerMetrics
  recent_transactions?: any[]
  total_properties?: number
  verified_properties?: number
  pending_verifications?: number
  total_valuation?: number
  active_transactions?: number
  pending_approvals_count?: number
  pending_purchase_requests?: any[]
  total_transaction_volume?: number
}

