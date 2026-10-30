import apiClient from '@/lib/axios'
import type { BlockchainNetworkStatus, BlockchainTx, BlockchainBlock } from '@/types/blockchain'

export const blockchainService = {
  async getNetworkStatus(): Promise<BlockchainNetworkStatus> {
    const response = await apiClient.get<BlockchainNetworkStatus>('/blockchain/status')
    return response.data
  },

  async getLatestBlocks(): Promise<BlockchainBlock[]> {
    const response = await apiClient.get<BlockchainBlock[]>('/blockchain/blocks')
    return response.data
  },

  async getTransactionByHash(hash: string): Promise<BlockchainTx> {
    const response = await apiClient.get<BlockchainTx>(`/blockchain/tx/${hash}`)
    return response.data
  },
}

