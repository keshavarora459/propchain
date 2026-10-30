import apiClient from '@/lib/axios'
import type { DocumentRecord } from '@/types/document'

export const documentService = {
  async getDocuments(propertyId?: string): Promise<DocumentRecord[]> {
    const response = await apiClient.get<DocumentRecord[]>('/documents', {
      params: propertyId ? { propertyId } : undefined,
    })
    return response.data
  },

  async uploadDocument(formData: FormData): Promise<DocumentRecord> {
    const response = await apiClient.post<DocumentRecord>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}

