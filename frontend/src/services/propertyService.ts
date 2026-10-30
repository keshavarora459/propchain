import apiClient from '@/lib/axios'
import type { Property, PropertyFilter } from '@/types/property'

export const propertyService = {
  async getProperties(filter?: PropertyFilter): Promise<Property[]> {
    const response = await apiClient.get<Property[]>('/properties', { params: filter })
    return response.data
  },

  async getPropertyById(id: string): Promise<Property> {
    const response = await apiClient.get<Property>(`/properties/${id}`)
    return response.data
  },

  async registerProperty(data: unknown): Promise<Property> {
    const response = await apiClient.post<Property>('/properties', data)
    return response.data
  },
}

