import apiClient from '@/lib/axios'
import type { Transaction } from '@/types/transaction'

export function normalizeTransaction(t: any): Transaction {
  const transactionId = t.transactionId || t.transaction_number || t.id || 'TXN-0000'
  const propertyTitle = t.propertyTitle || t.property_title || 'Real Estate Property'
  const buyerName = t.buyerName || t.buyer_name || 'Buyer'
  const sellerName = t.sellerName || t.seller_name || 'Seller'
  const amount = typeof t.amount === 'number' ? t.amount : Number(t.proposed_amount) || 0
  const initiatedAt = t.initiatedAt || t.created_at || new Date().toISOString()
  const status = t.status || 'Pending'

  return {
    ...t,
    id: t.id,
    transactionId,
    propertyId: t.propertyId || t.property_id || '',
    propertyTitle,
    buyerName,
    buyerWallet: t.buyerWallet || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    sellerName,
    sellerWallet: t.sellerWallet || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    amount,
    currency: t.currency || 'INR',
    status,
    type: t.type || t.transaction_type || 'Sale',
    escrowStatus: status === 'COMPLETED' ? 'Released' : 'Funded',
    initiatedAt,
    blockchainTxHash: t.blockchainTxHash || t.blockchain_tx_hash,
  }
}

export const transactionService = {
  async getTransactions(status?: string): Promise<Transaction[]> {
    const response = await apiClient.get<any[]>('/transactions', {
      params: status ? { status } : undefined,
    })
    return response.data.map(normalizeTransaction)
  },

  async getTransactionById(id: string): Promise<any> {
    const response = await apiClient.get(`/transactions/${id}`)
    return {
      ...response.data,
      ...normalizeTransaction(response.data),
    }
  },

  async initiateTransaction(payload: unknown): Promise<Transaction> {
    const response = await apiClient.post<any>('/transactions', payload)
    return normalizeTransaction(response.data)
  },

  async acceptTransaction(id: string): Promise<Transaction> {
    const response = await apiClient.post<any>(`/transactions/${id}/accept`)
    return normalizeTransaction(response.data)
  },

  async rejectTransaction(id: string, reason: string): Promise<Transaction> {
    const response = await apiClient.post<any>(`/transactions/${id}/reject`, { reason })
    return normalizeTransaction(response.data)
  },

  async verifyDocuments(id: string, comments?: string): Promise<Transaction> {
    const response = await apiClient.post<any>(`/transactions/${id}/verify-documents`, null, {
      params: comments ? { comments } : undefined,
    })
    return normalizeTransaction(response.data)
  },

  async legalConfirm(id: string, payload: {
    registration_reference: string
    registry_jurisdiction: string
    registration_date: string
    comments?: string
  }): Promise<Transaction> {
    const response = await apiClient.post<any>(`/transactions/${id}/legal-confirm`, payload)
    return normalizeTransaction(response.data)
  },
}

export default transactionService
