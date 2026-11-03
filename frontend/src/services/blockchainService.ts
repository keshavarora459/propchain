import apiClient from '@/lib/axios'
import type { BlockchainNetworkStatus, BlockchainTx, BlockchainBlock, BlockchainStats } from '@/types/blockchain'

export const blockchainService = {
  async getNetworkStatus(): Promise<BlockchainNetworkStatus> {
    const response = await apiClient.get<BlockchainNetworkStatus>('/blockchain/status')
    return response.data
  },

  async getLatestBlocks(limit: number = 25): Promise<BlockchainBlock[]> {
    const response = await apiClient.get<BlockchainBlock[]>(`/blockchain/blocks?limit=${limit}`)
    return response.data
  },

  async getRecentTransactions(limit: number = 25): Promise<BlockchainTx[]> {
    const response = await apiClient.get<BlockchainTx[]>(`/blockchain/transactions?limit=${limit}`)
    return response.data
  },

  async getStats(): Promise<BlockchainStats> {
    const response = await apiClient.get<BlockchainStats>('/blockchain/stats')
    return response.data
  },

  async getTransactionByHash(hash: string): Promise<BlockchainTx> {
    const response = await apiClient.get<BlockchainTx>(`/blockchain/tx/${hash}`)
    return response.data
  },

  async search(query: string): Promise<any> {
    const response = await apiClient.get<any>(`/blockchain/search?q=${encodeURIComponent(query)}`)
    return response.data
  },
}

export default blockchainService
