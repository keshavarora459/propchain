export type PropertyType = 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural' | 'Land' | string

export type VerificationStatus = 'Verified' | 'Pending' | 'In Review' | 'Flagged' | 'Rejected' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_CORRECTION' | string

export interface Property {
  id: string
  propertyId: string // e.g. "PROP-88214"
  property_number?: string
  title: string
  propertyType: PropertyType
  property_type?: PropertyType
  property_category?: string
  address: string
  street_address?: string
  city: string
  state: string
  district?: string
  locality?: string
  postalCode: string
  postal_code?: string
  country?: string
  area: number
  land_area?: number | string
  built_up_area?: number | string
  areaUnit: 'sq ft' | 'acres' | 'sq m' | string
  area_unit?: string
  bedrooms?: number
  bathrooms?: number
  floors?: number
  construction_year?: number
  valuation: number
  currentOwner: string
  owner_name?: string
  ownerAddress: string
  owner_email?: string
  registrationReference: string
  survey_number?: string
  ulpin?: string
  registration_number?: string
  registry_jurisdiction?: string
  registration_date?: string
  status?: string
  verificationStatus: VerificationStatus
  verification_status?: VerificationStatus
  blockchain_property_id?: string
  blockchainTokenId?: string
  blockchain_tx_hash?: string
  blockchain_block_number?: number
  blockchain_contract_address?: string
  blockchain_registration_timestamp?: string
  blockchain_error?: string
  anchor_tx_hash?: string
  verified_at?: string
  verified_by_id?: string
  verified_by_name?: string
  registeredAt: string
  created_at?: string
  imageUrl?: string
  description?: string
  creator_user_id?: string
  current_owner_id?: string
  submitted_at?: string
  seller_name?: string
  approved_documents_count?: number
  required_documents_count?: number
  allow_duplicate_override?: boolean
  allowDuplicateOverride?: boolean
  is_tokenized?: boolean
  token_symbol?: string | null
  total_tokens?: number | null
  token_price?: number | null
  min_tokens_per_buyer?: number | null
  projected_apy?: number | null
  tokens_sold?: number
  tokens_pending?: number
  available_tokens?: number | null
}

export interface PropertyFilter {
  page?: number
  page_size?: number
  search?: string
  property_type?: string
  propertyType?: string
  status?: string
  verification_status?: string
  verificationStatus?: string
  state?: string
  city?: string
  mine?: boolean
  verified_by_me?: boolean
}

export interface PropertyListResponse {
  items: Property[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
