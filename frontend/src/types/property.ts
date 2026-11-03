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
  registeredAt: string
  created_at?: string
  imageUrl?: string
  description?: string
  creator_user_id?: string
  current_owner_id?: string
  submitted_at?: string
  seller_name?: string
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
}

export interface PropertyListResponse {
  items: Property[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
