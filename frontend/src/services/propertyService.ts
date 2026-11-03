import apiClient from '@/lib/axios'
import type { Property, PropertyFilter, PropertyListResponse } from '@/types/property'

export function normalizeProperty(p: any): Property {
  const propertyId = p.propertyId || p.property_number || p.id || ''
  const city = p.city || ''
  const state = p.state || ''
  const address = p.address || p.street_address || (city && state ? `${city}, ${state}` : '')
  const currentOwner = p.currentOwner || p.owner_name || ''
  const ownerAddress = p.ownerAddress || p.owner_email || ''
  
  const rawStatus = (p.verification_status || p.verificationStatus || 'Pending').toString()
  const upperStatus = rawStatus.toUpperCase()
  const verificationStatus =
    upperStatus === 'VERIFIED'
      ? 'Verified'
      : upperStatus === 'SUBMITTED'
      ? 'Submitted'
      : upperStatus === 'REJECTED'
      ? 'Rejected'
      : upperStatus === 'REQUIRES_CORRECTION' || upperStatus === 'CORRECTION_REQUESTED'
      ? 'Needs correction'
      : 'Pending'

  const registeredAt = p.registeredAt || p.created_at || new Date().toISOString()
  const area = typeof p.area === 'number' ? p.area : Number(p.land_area) || 0
  const areaUnit = p.areaUnit || (p.area_unit === 'ACRE' ? 'acres' : (p.area_unit === 'SQ_M' ? 'sq m' : 'sq ft'))
  const valuation = typeof p.valuation === 'number' ? p.valuation : Number(p.valuation) || 0
  const registrationReference = p.registrationReference || p.registration_number || p.ulpin || p.survey_number || ''
  
  const rawType = (p.propertyType || p.property_type || 'Residential').toString()
  const propertyType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()

  return {
    ...p,
    id: p.id,



    title: p.title || '',

    propertyId,
    propertyType,
    address,
    city,
    state,
    postalCode: p.postalCode || p.postal_code || '',
    area,
    areaUnit,
    valuation,
    currentOwner,
    ownerAddress,
    registrationReference,
    verificationStatus,
    verification_status: upperStatus,
    submitted_at: p.submitted_at || p.created_at,
    seller_name: p.seller_name || p.owner_name || currentOwner,
    registeredAt,
    creator_user_id: p.creator_user_id ? String(p.creator_user_id) : undefined,
    current_owner_id: p.current_owner_id ? String(p.current_owner_id) : undefined,
    blockchain_tx_hash: p.blockchain_tx_hash,
    blockchain_block_number: p.blockchain_block_number,
    blockchain_contract_address: p.blockchain_contract_address,
    blockchain_registration_timestamp: p.blockchain_registration_timestamp,
    blockchain_error: p.blockchain_error,
  }
}

export const propertyService = {
  async getProperties(filter?: PropertyFilter): Promise<PropertyListResponse> {
    const params = {
      page: filter?.page || 1,
      page_size: filter?.page_size || 20,
      search: filter?.search,
      property_type: filter?.property_type || filter?.propertyType,
      status: filter?.status,
      verification_status: filter?.verification_status || filter?.verificationStatus,
      state: filter?.state,
      city: filter?.city,
      mine: filter?.mine,
    }
    const response = await apiClient.get<PropertyListResponse>('/properties', { params })
    return {
      ...response.data,
      items: response.data.items.map(normalizeProperty),
    }
  },

  async getMyProperties(page = 1, pageSize = 20): Promise<PropertyListResponse> {
    const response = await apiClient.get<PropertyListResponse>('/properties/my', {
      params: { page, page_size: pageSize },
    })
    return {
      ...response.data,
      items: response.data.items.map(normalizeProperty),
    }
  },

  async getPropertyById(id: string): Promise<Property> {
    const response = await apiClient.get<Property>(`/properties/${id}`)
    return normalizeProperty(response.data)
  },

  async registerProperty(data: unknown): Promise<Property> {
    const response = await apiClient.post<Property>('/properties', data)
    return normalizeProperty(response.data)
  },

  async updateProperty(id: string, data: unknown): Promise<Property> {
    const response = await apiClient.patch<Property>(`/properties/${id}`, data)
    return normalizeProperty(response.data)
  },

  async updatePropertyStatus(id: string, data: { status?: string; verification_status?: string }): Promise<Property> {
    const response = await apiClient.patch<Property>(`/properties/${id}/status`, data)
    return normalizeProperty(response.data)
  },

  async submitForVerification(propertyId: string): Promise<Property> {
    const response = await apiClient.post<Property>(`/properties/${propertyId}/submit-for-verification`)
    return normalizeProperty(response.data)
  },

  async verifyProperty(propertyId: string): Promise<Property> {
    const response = await apiClient.post<Property>(`/properties/${propertyId}/verify`)
    return normalizeProperty(response.data)
  },

  async rejectProperty(propertyId: string, reason?: string): Promise<Property> {
    const response = await apiClient.post<Property>(`/properties/${propertyId}/reject`, { reason })
    return normalizeProperty(response.data)
  },

  async retryBlockchain(propertyId: string): Promise<Property> {
    const response = await apiClient.post<Property>(`/properties/${propertyId}/retry-blockchain`)
    return normalizeProperty(response.data)
  },
}

export default propertyService
