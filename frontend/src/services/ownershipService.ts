import apiClient from '@/lib/axios'
import type { OwnershipRecord } from '@/types/ownership'

export const ownershipService = {
  async getOwnershipRegistry(): Promise<OwnershipRecord[]> {
    const response = await apiClient.get<OwnershipRecord[]>('/ownership')
    return response.data
  },

  async getOwnershipByPropertyId(propertyId: string): Promise<OwnershipRecord> {
    const response = await apiClient.get<OwnershipRecord>(`/ownership/property/${propertyId}`)
    return response.data
  },
}

