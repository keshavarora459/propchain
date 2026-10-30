import apiClient from '@/lib/axios'
import type { DocumentRecord } from '@/types/document'

export function normalizeDocument(doc: any): DocumentRecord {
  return {
    ...doc,
    propertyId: doc.propertyId || doc.property_id || '',
    propertyTitle: doc.propertyTitle || doc.title || 'Associated Property',
    documentName: doc.documentName || doc.original_filename || doc.title || 'Document',
    documentType: doc.documentType || doc.document_type || 'Sale Agreement',
    fileSize: typeof doc.file_size === 'number'
      ? `${(doc.file_size / (1024 * 1024)).toFixed(2)} MB`
      : (doc.fileSize || '1.2 MB'),
    uploadedAt: doc.uploadedAt || doc.created_at || new Date().toISOString(),
    uploadedBy: doc.uploadedBy || 'Property Owner',
    status: doc.status || 'Pending Review',
    documentHash: doc.documentHash || doc.document_hash || 'SHA256-PENDING',
    ocrConfidence: doc.ocrConfidence || 95,
  }
}

export const documentService = {
  async getDocuments(propertyId?: string): Promise<DocumentRecord[]> {
    if (propertyId) {
      const response = await apiClient.get<any[]>(`/properties/${propertyId}/documents`)
      return response.data.map(normalizeDocument)
    }
    // Return empty array or property docs
    return []
  },

  async getDocumentById(documentId: string): Promise<any> {
    const response = await apiClient.get(`/documents/${documentId}`)
    return response.data
  },

  async uploadDocument(propertyId: string, formData: FormData): Promise<DocumentRecord> {
    const response = await apiClient.post(`/properties/${propertyId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return normalizeDocument(response.data)
  },

  async verifyDocument(documentId: string, comments?: string): Promise<DocumentRecord> {
    const response = await apiClient.post(`/documents/${documentId}/verify`, { comments })
    return normalizeDocument(response.data)
  },

  async rejectDocument(documentId: string, reason: string): Promise<DocumentRecord> {
    const response = await apiClient.post(`/documents/${documentId}/reject`, { reason })
    return normalizeDocument(response.data)
  },

  async requestCorrection(documentId: string, correctionNotes: string): Promise<DocumentRecord> {
    const response = await apiClient.post(`/documents/${documentId}/request-correction`, {
      correction_notes: correctionNotes,
    })
    return normalizeDocument(response.data)
  },

  async downloadDocument(documentId: string): Promise<Blob> {
    const response = await apiClient.get(`/documents/${documentId}/download`, {
      responseType: 'blob',
    })
    return response.data
  },
}

export default documentService
