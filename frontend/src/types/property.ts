export type PropertyType = 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural' | 'Land'

export type VerificationStatus = 'Verified' | 'Pending' | 'In Review' | 'Flagged' | 'Rejected'

export interface Property {
  id: string
  propertyId: string // e.g. "PROP-88214"
  title: string
  propertyType: PropertyType
  address: string
  city: string
  state: string
  postalCode: string
  area: number
  areaUnit: 'sq ft' | 'acres' | 'sq m'
  valuation: number
  currentOwner: string
  ownerAddress: string
  registrationReference: string
  verificationStatus: VerificationStatus
  blockchainTokenId?: string
  registeredAt: string
  imageUrl?: string
  description?: string
}

export interface PropertyFilter {
  search?: string
  propertyType?: string
  verificationStatus?: string
  city?: string
}

