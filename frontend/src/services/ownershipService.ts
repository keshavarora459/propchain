import apiClient from '@/lib/axios'
import type { OwnershipRecord } from '@/types/ownership'

export const ownershipService = {
  async getOwnershipRegistry(): Promise<OwnershipRecord[]> {
    try {
      const response = await apiClient.get<any>('/ownership/history')
      const items = response.data.items || []
      return items.map((e: any) => ({
        id: e.id,
        propertyId: e.property_number || e.property_id,
        propertyTitle: e.property_title || '',
        currentOwnerName: e.new_owner_name || '',
        currentOwnerWallet: e.new_owner_address,
        previousOwnersCount: e.previous_owner_name ? 1 : 0,
        acquisitionDate: e.confirmed_at || e.created_at,
        acquisitionType: e.event_type === 'INITIAL_REGISTRATION' ? 'Initial Mint' : 'Transfer',
        purchasePrice: Number(e.purchase_price || e.price || 0),
        blockchainBlockNumber: e.block_number || 0,
        transactionHash: e.blockchain_tx_hash || '',
        hasEncumbrances: false,
        history: [],
      }))
    } catch {
      return []
    }
  },

  async getOwnershipByPropertyId(propertyId: string): Promise<any[]> {
    try {
      const response = await apiClient.get(`/properties/${propertyId}/ownership-history`)
      return response.data
    } catch {
      return []
    }
  },

  async anchorProperty(propertyId: string): Promise<any> {
    const response = await apiClient.post(`/properties/${propertyId}/anchor-blockchain`)
    return response.data
  },
}

export default ownershipService
