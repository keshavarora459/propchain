import apiClient from '@/lib/axios'
import type { Property, PropertyFilter, PropertyListResponse } from '@/types/property'

export function normalizeProperty(p: any): Property {
  const propertyId = p.propertyId || p.property_number || p.id || 'PROP-00000'
  const city = p.city || 'San Jose'
  const state = p.state || 'California'
  const address = p.address || p.street_address || `${city}, ${state}`
  const currentOwner = p.currentOwner || p.owner_name || 'Registered Owner'
  const ownerAddress = p.ownerAddress || p.owner_email || 'Verified Owner'
  
  const rawStatus = (p.verification_status || p.verificationStatus || 'Pending').toString()
  const verificationStatus =
    rawStatus.toUpperCase() === 'VERIFIED'
      ? 'Verified'
      : rawStatus.toUpperCase() === 'REJECTED'
      ? 'Rejected'
      : rawStatus.toUpperCase() === 'REQUIRES_CORRECTION'
      ? 'Flagged'
      : 'Pending'

  const registeredAt = p.registeredAt || p.created_at || new Date().toISOString()
  const area = typeof p.area === 'number' ? p.area : Number(p.land_area) || 1200
  const areaUnit = p.areaUnit || (p.area_unit === 'ACRE' ? 'acres' : (p.area_unit === 'SQ_M' ? 'sq m' : 'sq ft'))
  const valuation = typeof p.valuation === 'number' ? p.valuation : Number(p.valuation) || 0
  const registrationReference = p.registrationReference || p.registration_number || p.ulpin || p.survey_number || 'REG-PENDING'
  
  const rawType = (p.propertyType || p.property_type || 'Residential').toString()
  const propertyType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()

  return {
    ...p,
    id: p.id,
    title: p.title || 'Real Estate Parcel',
    propertyId,
    propertyType,
    address,
    city,
    state,
    postalCode: p.postalCode || p.postal_code || '95110',
    area,
    areaUnit,
    valuation,
    currentOwner,
    ownerAddress,
    registrationReference,
    verificationStatus,
    registeredAt,
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
}

export default propertyService
