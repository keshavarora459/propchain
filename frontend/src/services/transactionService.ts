import apiClient from '@/lib/axios'
import type { Transaction } from '@/types/transaction'

export const transactionService = {
  async getTransactions(): Promise<Transaction[]> {
    const response = await apiClient.get<Transaction[]>('/transactions')
    return response.data
  },

  async getTransactionById(id: string): Promise<Transaction> {
    const response = await apiClient.get<Transaction>(`/transactions/${id}`)
    return response.data
  },

  async initiateTransaction(payload: unknown): Promise<Transaction> {
    const response = await apiClient.post<Transaction>('/transactions', payload)
    return response.data
  },
}

