import apiClient from '@/lib/axios'
import type { FraudAlert } from '@/types/fraud'

export const fraudService = {
  async getFraudAlerts(): Promise<FraudAlert[]> {
    const response = await apiClient.get<FraudAlert[]>('/fraud/alerts')
    return response.data
  },

  async updateAlertStatus(id: string, status: string): Promise<FraudAlert> {
    const response = await apiClient.patch<FraudAlert>(`/fraud/alerts/${id}`, { status })
    return response.data
  },
}

