import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  UploadCloud,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  Loader2,
  Check,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Cpu,
  Layers,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { HashDisplay } from '@/components/common/HashDisplay'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { truncateHash, formatDate, getPropertyLabel } from '@/lib/utils'
import type { DocumentRecord, DocumentType } from '@/types/document'
import type { Property } from '@/types/property'
import { propertyService } from '@/services/propertyService'
import { documentService } from '@/services/documentService'
import { ownershipService } from '@/services/ownershipService'
import apiClient from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'

export const REQUIRED_DOCUMENT_TYPES = [
  { id: 'TITLE_DEED', label: 'Title Deed' },
  { id: 'CADASTRAL_SURVEY', label: 'Cadastral Survey' },
  { id: 'TAX_CLEARANCE', label: 'Tax Clearance' },
  { id: 'ENCUMBRANCE_CERTIFICATE', label: 'Encumbrance Certificate' },
] as const

export const DocumentVerificationPage: React.FC = () => {
  const { user } = useAuth()
  const isSeller = user?.role === 'PROPERTY_OWNER'
  const isVerifier = user?.role === 'VERIFIER'
  const isAdmin = user?.role === 'ADMIN'

  const [searchParams] = useSearchParams()
  const [isRetryingBlockchain, setIsRetryingBlockchain] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null)
  const [viewDoc, setViewDoc] = useState<DocumentRecord | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('Title Deed')
  const [dragActive, setDragActive] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [correctionDoc, setCorrectionDoc] = useState<DocumentRecord | null>(null)
  const [correctionNote, setCorrectionNote] = useState<string>('')
  const [isVerifyingProperty, setIsVerifyingProperty] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedProperty = properties.find(
    (p) => p.propertyId === selectedPropertyId || p.id === selectedPropertyId
  )

  const isPropertySubmitted =
    (selectedProperty?.verification_status || selectedProperty?.verificationStatus || '').toString().toUpperCase() === 'SUBMITTED'
  const isPropertyVerified =
    (selectedProperty?.verification_status || selectedProperty?.verificationStatus || '').toString().toUpperCase() === 'VERIFIED'
  const isPropertyNeedsCorrection =
    (selectedProperty?.verification_status || selectedProperty?.verificationStatus || '').toString().toUpperCase() === 'CORRECTION_REQUESTED' ||
    (selectedProperty?.verification_status || selectedProperty?.verificationStatus || '').toString().toUpperCase() === 'REQUIRES_CORRECTION'

  const propertyDocuments = documents.filter((d) => {
    if (!selectedPropertyId) return false
    return (
      d.propertyId === selectedPropertyId ||
      d.property_id === selectedPropertyId ||
      (selectedProperty && (d.propertyId === selectedProperty.id || d.property_id === selectedProperty.id))
    )
  })

  const isNeedsCorrection = (status?: string): boolean => {
    if (!status) return false
    const s = status.toUpperCase()
    return (
      s === 'NEEDS CORRECTION' ||
      s === 'CORRECTION_REQUESTED' ||
      s === 'REQUIRES_CORRECTION' ||
      s === 'REJECTED'
    )
  }

  const isActiveDoc = (d: DocumentRecord): boolean => {
    const s = (d.status || '').toUpperCase()
    return s !== 'REPLACED' && !isNeedsCorrection(d.status)
  }

  const getDocForType = (typeLabel: string): DocumentRecord | undefined => {
    const matching = propertyDocuments.filter((d) => {
      const docType = (d.documentType || d.document_type || '').toLowerCase()
      const target = typeLabel.toLowerCase()
      if (docType === target) return true
      if (target === 'title deed' && (docType.includes('title') || docType.includes('sale'))) return true
      if (target === 'cadastral survey' && (docType.includes('survey') || docType.includes('cadastral'))) return true
      if (target === 'tax clearance' && docType.includes('tax')) return true
      if (target === 'encumbrance certificate' && docType.includes('encumbrance')) return true
      return false
    })
    const active = matching.find(isActiveDoc)
    if (active) return active
    const nonReplaced = matching.find((d) => (d.status || '').toUpperCase() !== 'REPLACED')
    return nonReplaced || matching[0]
  }

  const activeUploadedCount = REQUIRED_DOCUMENT_TYPES.filter((req) => {
    const doc = getDocForType(req.label)
    return doc && isActiveDoc(doc)
  }).length

  const allRequiredUploaded = activeUploadedCount === REQUIRED_DOCUMENT_TYPES.length

  const docClassificationOptions = REQUIRED_DOCUMENT_TYPES.map((t) => {
    const existing = getDocForType(t.label)
    if (existing && isActiveDoc(existing)) {
      return {
        value: t.label,
        label: `${t.label} (uploaded)`,
        disabled: true,
      }
    }
    if (existing && isNeedsCorrection(existing.status)) {
      return {
        value: t.label,
        label: `${t.label} (needs correction - replace)`,
        disabled: false,
      }
    }
    return {
      value: t.label,
      label: t.label,
      disabled: false,
    }
  })

  // Ensure selected classification option is selectable if current becomes disabled
  useEffect(() => {
    const currentOpt = docClassificationOptions.find((o) => o.value === selectedDocType)
    if (currentOpt?.disabled) {
      const firstAvailable = docClassificationOptions.find((o) => !o.disabled)
      if (firstAvailable) {
        setSelectedDocType(firstAvailable.value as DocumentType)
      }
    }
  }, [selectedPropertyId, documents])

  const getPlainStatus = (
    status?: string
  ): 'Waiting for review' | 'Approved' | 'Needs correction' | 'Rejected' | 'Replaced' => {
    if (!status) return 'Waiting for review'
    const s = status.toUpperCase()
    if (s === 'VERIFIED' || s === 'APPROVED') return 'Approved'
    if (s === 'REJECTED') return 'Rejected'
    if (s === 'REQUIRES_CORRECTION' || s === 'CORRECTION_REQUESTED' || s === 'NEEDS CORRECTION') {
      return 'Needs correction'
    }
    if (s === 'REPLACED') return 'Replaced'
    return 'Waiting for review'
  }

  const getOnChainStatus = (doc: DocumentRecord): 'Recorded on blockchain' | 'Not yet recorded' => {
    const prop = properties.find(
      (p) => p.propertyId === doc.propertyId || p.id === doc.propertyId || p.id === doc.property_id
    )
    const isOnChain = !!(
      doc.ipfsCid ||
      (prop &&
        (prop.blockchain_property_id ||
          prop.blockchainTokenId ||
          (prop.verification_status || '').toUpperCase() === 'VERIFIED'))
    )
    return isOnChain ? 'Recorded on blockchain' : 'Not yet recorded'
  }

  const handleDownload = async (doc: DocumentRecord) => {
    if (!doc.id || doc.id.startsWith('doc-')) {
      alert('Document download is unavailable for locally staged file.')
      return
    }
    try {
      const blob = await documentService.downloadDocument(doc.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.documentName || `${doc.documentType || 'document'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Failed to download document: ${err.response?.data?.message || err.message}`)
    }
  }

  const handleSubmitForVerification = async () => {
    if (!selectedProperty?.id) return
    setIsSubmittingReview(true)
    setUploadError(null)
    try {
      await apiClient.post(`/properties/${selectedProperty.id}/submit-for-verification`)
      setUploadNotice(
        'Submitted for verification. A verifier will review your documents.'
      )
      setProperties((prev) =>
        prev.map((p) =>
          p.id === selectedProperty.id
            ? { ...p, verificationStatus: 'Submitted', verification_status: 'SUBMITTED', status: 'UNDER_REVIEW' }
            : p
        )
      )
      setDocuments((prev) =>
        prev.map((d) =>
          (d.propertyId === selectedProperty.propertyId || d.property_id === selectedProperty.id) &&
          (d.status || '').toUpperCase() !== 'REPLACED'
            ? { ...d, status: 'SUBMITTED_FOR_REVIEW' }
            : d
        )
      )
      setTimeout(() => setUploadNotice(null), 7000)
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to submit property for review'
      setUploadError(errMsg)
      setTimeout(() => setUploadError(null), 8000)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  useEffect(() => {
    propertyService
      .getProperties({ page_size: 100, mine: isSeller ? true : undefined })
      .then(async (res) => {
        if (res && res.items) {
          let sellerItems = res.items
          if (isSeller && user?.id) {
            const uid = String(user.id).toLowerCase()
            sellerItems = sellerItems.filter((p: any) => {
              const ownerId = p.current_owner_id ? String(p.current_owner_id).toLowerCase() : ''
              const creatorId = p.creator_user_id ? String(p.creator_user_id).toLowerCase() : ''
              return ownerId === uid || creatorId === uid
            })
          } else if (isVerifier) {
            // Item 7: Show only properties with status SUBMITTED, CORRECTION_REQUESTED, or recently verified
            sellerItems = sellerItems.filter((p: any) => {
              const s = (p.verification_status || p.verificationStatus || '').toString().toUpperCase()
              return s === 'SUBMITTED' || s === 'CORRECTION_REQUESTED' || s === 'REQUIRES_CORRECTION' || s === 'VERIFIED'
            })
          }
          setProperties(sellerItems)
          const queryPropId = searchParams.get('propertyId')
          const initialTarget = queryPropId
            ? sellerItems.find((p: any) => p.propertyId === queryPropId || p.id === queryPropId)
            : null
          if (initialTarget) {
            setSelectedPropertyId(initialTarget.propertyId)
          } else if (sellerItems.length > 0) {
            setSelectedPropertyId(sellerItems[0].propertyId)
          } else {
            setSelectedPropertyId('')
          }

          if (sellerItems.length === 0) {
            setDocuments([])
          } else {
            const propDocPromises = sellerItems.map((prop: any) =>
              apiClient
                .get<any[]>(`/properties/${prop.id}/documents`, { timeout: 8000 })
                .then((res) => ({ prop, data: Array.isArray(res.data) ? res.data : [] }))
                .catch((err) => {
                  console.warn(`Could not load docs for ${prop.id}:`, err)
                  return { prop, data: [] }
                })
            )

            const settled = await Promise.allSettled(propDocPromises)
            const allDocs: DocumentRecord[] = []
            for (const item of settled) {
              if (item.status === 'fulfilled') {
                const { prop, data } = item.value
                data.forEach((d: any) => {
                  allDocs.push({
                    id: String(d.id),
                    propertyId: prop.propertyId,
                    property_id: prop.id,
                    propertyTitle: prop.title,
                    documentName: d.title || d.original_filename || 'Property Deed',
                    documentType:
                      d.document_type === 'SALE_DEED' || d.document_type === 'TITLE_DEED'
                        ? 'Title Deed'
                        : d.document_type === 'SURVEY_PLAN' || d.document_type === 'CADASTRAL_SURVEY'
                        ? 'Cadastral Survey'
                        : d.document_type === 'TAX_CLEARANCE' || d.document_type === 'TAX_RECEIPT'
                        ? 'Tax Clearance'
                        : d.document_type === 'ENCUMBRANCE_CERTIFICATE'
                        ? 'Encumbrance Certificate'
                        : d.document_type || 'Title Deed',
                    fileSize: d.file_size ? `${Math.round(d.file_size / 1024)} KB` : '150 KB',
                    uploadedAt: d.created_at || new Date().toISOString(),
                    uploadedBy: isSeller ? (user?.full_name || 'Property Owner') : 'County Title Officer',
                    status: d.status || 'PENDING_REVIEW',
                    ocrConfidence: typeof (d.ocr_confidence ?? d.ocrConfidence) === 'number'
                      ? Number(d.ocr_confidence ?? d.ocrConfidence)
                      : null,
                    documentHash: d.document_hash || '',
                    reviewNotes: d.review_notes || undefined,
                    is_cross_property_duplicate: Boolean(d.is_cross_property_duplicate),
                    duplicate_property_name: d.duplicate_property_name || undefined,
                    duplicate_warning: d.duplicate_warning || undefined,
                  })
                })
              }
            }
            setDocuments(allDocs)
          }
        } else {
          setProperties([])
          setSelectedPropertyId('')
          setDocuments([])
        }
      })
      .catch(console.warn)
  }, [isSeller, user?.id, user?.full_name, searchParams])

  // Synchronize deep-linked propertyId from query params
  useEffect(() => {
    const qId = searchParams.get('propertyId')
    if (qId && properties.length > 0) {
      const match = properties.find((p) => p.propertyId === qId || p.id === qId)
      if (match && match.propertyId !== selectedPropertyId) {
        setSelectedPropertyId(match.propertyId)
      }
    }
  }, [searchParams, properties])

  // Process selected or dropped file
  const handleProcessFile = async (file: File) => {
    if (!file) return
    if (isSeller && properties.length === 0) {
      setUploadError('You have no properties yet. Register a property first.')
      return
    }
    if (isSeller && isPropertySubmitted && !isPropertyNeedsCorrection) {
      setUploadError('Uploading is locked while property is under verifier review. Await reviewer action.')
      return
    }
    if (!selectedPropertyId) {
      setUploadError('Please select a property first.')
      return
    }
    if (allRequiredUploaded) return

    setUploadError(null)
    setUploadNotice(null)

    const existingDoc = getDocForType(selectedDocType)
    if (existingDoc && isActiveDoc(existingDoc)) {
      setUploadError(`An active ${selectedDocType} is already uploaded for this property.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploading(true)
    const matchedProp = properties.find(
      (p) => p.propertyId === selectedPropertyId || p.id === selectedPropertyId
    )

    try {
      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(file.size / 1024))} KB`

      let backendDoc: any = null
      if (matchedProp && matchedProp.id) {
        const backendDocType =
          selectedDocType === 'Title Deed'
            ? 'TITLE_DEED'
            : selectedDocType === 'Cadastral Survey'
            ? 'CADASTRAL_SURVEY'
            : selectedDocType === 'Tax Clearance'
            ? 'TAX_CLEARANCE'
            : selectedDocType === 'Encumbrance Certificate'
            ? 'ENCUMBRANCE_CERTIFICATE'
            : 'TITLE_DEED'

        const formData = new FormData()
        formData.append('file', file)
        formData.append('document_type', backendDocType)
        formData.append('title', file.name)

        try {
          const res = await apiClient.post(
            `/properties/${matchedProp.id}/documents`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          )
          backendDoc = res.data
        } catch (backendErr: any) {
          const errMsg =
            backendErr.response?.data?.message ||
            backendErr.message ||
            'Failed to upload document.'
          setUploadError(errMsg)
          setIsUploading(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }
      }

      const newDoc: DocumentRecord = {
        id: backendDoc?.id ? String(backendDoc.id) : `doc-${Date.now()}`,
        propertyId: matchedProp ? matchedProp.propertyId : selectedPropertyId,
        property_id: matchedProp?.id,
        propertyTitle: matchedProp ? matchedProp.title : 'Selected Property',
        documentName: file.name,
        documentType: selectedDocType,
        fileSize: sizeStr,
        uploadedAt: backendDoc?.created_at || new Date().toISOString(),
        uploadedBy: isSeller ? (user?.full_name || 'Property Owner') : 'County Title Officer',
        status: isSeller ? 'Waiting for review' : 'OCR Processed',
        ocrConfidence: typeof (backendDoc?.ocr_confidence ?? backendDoc?.ocrConfidence) === 'number'
          ? Number(backendDoc?.ocr_confidence ?? backendDoc?.ocrConfidence)
          : null,
        documentHash: backendDoc?.document_hash || hashHex,
        reviewNotes: backendDoc?.review_notes || undefined,
        is_cross_property_duplicate: Boolean(backendDoc?.is_cross_property_duplicate),
        duplicate_property_name: backendDoc?.duplicate_property_name || undefined,
        duplicate_warning: backendDoc?.duplicate_warning || undefined,
      }

      setDocuments((prev) => {
        // Mark previous document of same type as Replaced
        const updated = prev.map((d) => {
          const isSameProp =
            d.propertyId === newDoc.propertyId ||
            (newDoc.property_id && d.property_id === newDoc.property_id)
          const isSameType =
            (d.documentType || '').toLowerCase() === (newDoc.documentType || '').toLowerCase()
          if (isSameProp && isSameType && d.id !== newDoc.id) {
            return { ...d, status: 'Replaced' }
          }
          return d
        })
        return [newDoc, ...updated]
      })

      setUploadNotice(
        `✓ File "${file.name}" uploaded successfully for ${matchedProp?.title || selectedPropertyId}!`
      )
      setTimeout(() => setUploadNotice(null), 6000)
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleApproveDocument = async (doc: DocumentRecord) => {
    setIsUpdating(true)
    try {
      await apiClient.post(`/documents/${doc.id}/verify`, {
        comments: 'Cryptographic deed verification audit complete and approved.',
      })
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, status: 'VERIFIED' } : d))
      )
      setUploadNotice(`✓ Document "${doc.documentName}" marked as Verified.`)
      setTimeout(() => setUploadNotice(null), 5000)
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to approve document')
      setTimeout(() => setUploadError(null), 6000)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRequestCorrection = async () => {
    if (!correctionDoc || !correctionNote.trim()) return
    setIsUpdating(true)
    try {
      await apiClient.post(`/documents/${correctionDoc.id}/request-correction`, {
        correction_notes: correctionNote.trim(),
      })
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === correctionDoc.id
            ? { ...d, status: 'CORRECTION_REQUESTED', reviewNotes: correctionNote.trim() }
            : d
        )
      )
      setProperties((prev) =>
        prev.map((p) =>
          p.propertyId === correctionDoc.propertyId || p.id === correctionDoc.property_id
            ? { ...p, verificationStatus: 'Correction Requested', verification_status: 'CORRECTION_REQUESTED' }
            : p
        )
      )
      setUploadNotice(`✓ Correction requested on ${correctionDoc.documentType}. Seller notified.`)
      setCorrectionDoc(null)
      setCorrectionNote('')
      setTimeout(() => setUploadNotice(null), 6000)
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to request correction')
      setTimeout(() => setUploadError(null), 6000)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleVerifyProperty = async (propertyId: string) => {
    setIsVerifyingProperty(propertyId)
    try {
      const res = await propertyService.verifyProperty(propertyId)
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId || p.propertyId === propertyId
            ? { ...p, ...res }
            : p
        )
      )
      const isBcRegistered = (res.status || '').toUpperCase() === 'BLOCKCHAIN_REGISTERED'
      setUploadNotice(
        isBcRegistered
          ? `✓ Property "${res.title}" has been verified and permanently anchored on blockchain! (Tx: ${truncateHash(res.blockchain_tx_hash || '', 8, 6)})`
          : `✓ Property "${res.title}" verified. Blockchain anchoring status: ${res.status || 'PENDING'}.`
      )
      setTimeout(() => setUploadNotice(null), 8000)
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to verify property')
      setTimeout(() => setUploadError(null), 6000)
    } finally {
      setIsVerifyingProperty(null)
    }
  }

  const handleRejectProperty = async (propertyId: string, reason?: string) => {
    setIsVerifyingProperty(propertyId)
    try {
      const res = await propertyService.rejectProperty(propertyId, reason)
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId || p.propertyId === propertyId
            ? { ...p, ...res, verificationStatus: 'Rejected', verification_status: 'REJECTED' }
            : p
        )
      )
      setUploadNotice(`✓ Property "${res.title}" has been rejected. It will not be anchored on-chain.`)
      setTimeout(() => setUploadNotice(null), 8000)
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to reject property')
      setTimeout(() => setUploadError(null), 6000)
    } finally {
      setIsVerifyingProperty(null)
    }
  }

  const handleRetryBlockchain = async (propId: string) => {
    setIsRetryingBlockchain(propId)
    setUploadError(null)
    try {
      const res = await propertyService.retryBlockchain(propId)
      setProperties((prev) =>
        prev.map((p) => (p.id === propId || p.propertyId === propId ? { ...p, ...res } : p))
      )
      setUploadNotice(
        `✓ Successfully anchored property "${res.title}" on blockchain! (Tx: ${truncateHash(res.blockchain_tx_hash || '', 8, 6)})`
      )
      setTimeout(() => setUploadNotice(null), 8000)
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to retry blockchain registration'
      setUploadError(errMsg)
      setTimeout(() => setUploadError(null), 8000)
    } finally {
      setIsRetryingBlockchain(null)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleProcessFile(file)
    }
  }

  const handleDecision = async (id: string, newStatus: 'Verified' | 'Rejected') => {
    setIsUpdating(true)
    const targetDoc = documents.find((d) => d.id === id)

    setDocuments(
      documents.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
    )
    if (selectedDoc?.id === id) {
      setSelectedDoc(null)
    }

    const targetPropId = targetDoc?.propertyId || selectedPropertyId
    const matchedProp = properties.find(
      (p) => p.propertyId === targetPropId || p.id === targetPropId
    )

    if (matchedProp && matchedProp.id) {
      try {
        const vStatus = newStatus === 'Verified' ? 'VERIFIED' : 'REJECTED'
        try {
          await propertyService.updatePropertyStatus(matchedProp.id, {
            verification_status: vStatus,
          })
        } catch (e) {
          console.warn('Property status update notice:', e)
        }

        setProperties((prev) =>
          prev.map((p) =>
            p.id === matchedProp.id || p.propertyId === matchedProp.propertyId
              ? { ...p, verificationStatus: newStatus }
              : p
          )
        )

        if (targetDoc?.id && !targetDoc.id.startsWith('doc-')) {
          try {
            if (newStatus === 'Verified') {
              await apiClient.post(`/documents/${targetDoc.id}/verify`, {
                comments: 'Cryptographic deed verification audit complete and anchored.',
              })
            } else {
              await apiClient.post(`/documents/${targetDoc.id}/reject`, {
                reason: 'Document rejected during audit.',
              })
            }
          } catch (e) {
            console.warn('Backend document verification endpoint notice:', e)
          }
        }

        let anchorTxNotice = ''
        if (newStatus === 'Verified') {
          try {
            const anchorRes = await ownershipService.anchorProperty(matchedProp.id)
            if (anchorRes?.tx_hash) {
              anchorTxNotice = ` • Anchored On-Chain (Tx: ${truncateHash(anchorRes.tx_hash, 8, 6)})`
            }
          } catch (anchorErr) {
            console.warn('Blockchain anchor call notice:', anchorErr)
          }
        }

        setUploadNotice(
          `✓ Property ${matchedProp.title} (${matchedProp.propertyId}) has been verified${anchorTxNotice}!`
        )
        setTimeout(() => setUploadNotice(null), 8000)
      } catch (err: any) {
        console.error('Failed to update property verification status:', err)
        setUploadNotice(
          `Document status updated: ${err.response?.data?.message || err.message}`
        )
        setTimeout(() => setUploadNotice(null), 6000)
      }
    } else {
      setUploadNotice(`Document marked as ${newStatus}.`)
      setTimeout(() => setUploadNotice(null), 5000)
    }
    setIsUpdating(false)
  }

  const displayedDocuments = documents.filter((doc) => {
    const s = (doc.status || '').toUpperCase()
    if (!showHistory && s === 'REPLACED') {
      return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Verification & Integrity"
        description="Ingestion, validation, and cryptographic hashing of property conveyance documents."
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Verifier Queue Overview Header */}
      {!isSeller && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Title Verifier Review Queue</p>
              <p className="text-slate-600 mt-0.5">
                Review submitted properties below. Each property requires 4 approved documents (Title Deed, Cadastral Survey, Tax Clearance, Encumbrance Certificate) before consensus verification.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 whitespace-nowrap">
            {properties.filter((p) => (p.verification_status || p.verificationStatus || '').toString().toUpperCase() !== 'PENDING').length} Properties in Queue
          </span>
        </div>
      )}

      {/* Upload Interface Section */}
      {isSeller && (
        <Card>
        <CardHeader>
          <CardTitle>Deed & Survey Ingestion Portal</CardTitle>
          <CardDescription>
            Supported formats: PDF, TIFF, PNG, JPG (Max 50MB). Upload mandatory title deeds and cadastral surveys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Select Property"
              options={
                properties.length > 0
                  ? properties.map((p) => ({ value: p.propertyId, label: getPropertyLabel(p) }))
                  : [
                      {
                        value: '',
                        label: isSeller
                          ? 'You have no properties yet. Register a property first.'
                          : 'No properties found',
                        disabled: true,
                      },
                    ]
              }
              value={selectedPropertyId}
              disabled={properties.length === 0}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value)
                setUploadError(null)
                setUploadNotice(null)
              }}
            />
            <Select
              label="Document Classification"
              options={docClassificationOptions}
              value={selectedDocType}
              disabled={properties.length === 0}
              onChange={(e) => {
                setSelectedDocType(e.target.value as DocumentType)
                setUploadError(null)
              }}
            />
          </div>

          {/* 4-Step Registration & Verification Progress Stepper */}
          {selectedProperty && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Property Onboarding & Verification Lifecycle
                </h4>
                <span className="text-xs font-mono font-medium text-slate-500">
                  Parcel ID: {selectedProperty.property_number || selectedProperty.propertyId}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Step 1: Property Registration */}
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">1. Registration</p>
                    <p className="text-[11px] text-emerald-700 truncate font-medium">Record Created</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{selectedProperty.property_number || selectedProperty.propertyId}</p>
                  </div>
                </div>

                {/* Step 2: Document Upload */}
                <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                  allRequiredUploaded
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-blue-200 bg-blue-50/50'
                }`}>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                    allRequiredUploaded
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {allRequiredUploaded ? '✓' : '2'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">2. Document Upload</p>
                    <p className={`text-[11px] font-medium truncate ${allRequiredUploaded ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {allRequiredUploaded ? '4 of 4 Uploaded' : `${activeUploadedCount} of 4 Uploaded`}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">Title, Survey, Tax, Encumbrance</p>
                  </div>
                </div>

                {/* Step 3: Verifier Review */}
                <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                  isPropertyVerified
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : isPropertyNeedsCorrection
                    ? 'border-amber-300 bg-amber-50/50'
                    : isPropertySubmitted
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                    isPropertyVerified
                      ? 'bg-emerald-100 text-emerald-700'
                      : isPropertyNeedsCorrection
                      ? 'bg-amber-100 text-amber-700'
                      : isPropertySubmitted
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isPropertyVerified ? '✓' : '3'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">3. Title Verification</p>
                    <p className={`text-[11px] font-medium truncate ${
                      isPropertyVerified
                        ? 'text-emerald-700'
                        : isPropertyNeedsCorrection
                        ? 'text-amber-700'
                        : isPropertySubmitted
                        ? 'text-blue-700'
                        : 'text-slate-500'
                    }`}>
                      {isPropertyVerified
                        ? 'Audited & Approved'
                        : isPropertyNeedsCorrection
                        ? 'Needs Correction'
                        : isPropertySubmitted
                        ? 'Under Review'
                        : 'Draft (Upload 4 docs)'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">County Title Officer</p>
                  </div>
                </div>

                {/* Step 4: Blockchain Registration */}
                <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                  (selectedProperty.status === 'BLOCKCHAIN_REGISTERED' || (isPropertyVerified && selectedProperty.blockchain_tx_hash))
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : selectedProperty.status === 'BLOCKCHAIN_FAILED'
                    ? 'border-rose-300 bg-rose-50/50'
                    : selectedProperty.status === 'BLOCKCHAIN_PENDING'
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                    (selectedProperty.status === 'BLOCKCHAIN_REGISTERED' || (isPropertyVerified && selectedProperty.blockchain_tx_hash))
                      ? 'bg-emerald-100 text-emerald-700'
                      : selectedProperty.status === 'BLOCKCHAIN_FAILED'
                      ? 'bg-rose-100 text-rose-700'
                      : selectedProperty.status === 'BLOCKCHAIN_PENDING'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {(selectedProperty.status === 'BLOCKCHAIN_REGISTERED' || (isPropertyVerified && selectedProperty.blockchain_tx_hash)) ? '✓' : '4'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">4. Blockchain Consensus</p>
                    <p className={`text-[11px] font-medium truncate ${
                      (selectedProperty.status === 'BLOCKCHAIN_REGISTERED' || (isPropertyVerified && selectedProperty.blockchain_tx_hash))
                        ? 'text-emerald-700'
                        : selectedProperty.status === 'BLOCKCHAIN_FAILED'
                        ? 'text-rose-700'
                        : selectedProperty.status === 'BLOCKCHAIN_PENDING'
                        ? 'text-blue-700'
                        : 'text-slate-500'
                    }`}>
                      {(selectedProperty.status === 'BLOCKCHAIN_REGISTERED' || (isPropertyVerified && selectedProperty.blockchain_tx_hash))
                        ? 'Anchored On-Chain'
                        : selectedProperty.status === 'BLOCKCHAIN_FAILED'
                        ? 'Anchoring Failed'
                        : selectedProperty.status === 'BLOCKCHAIN_PENDING'
                        ? 'Anchoring...'
                        : 'Awaiting Approval'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">Smart Contract Ledger</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Blockchain Registration Success Banner */}
          {selectedProperty && (selectedProperty.status === 'BLOCKCHAIN_REGISTERED' || (isPropertyVerified && selectedProperty.blockchain_tx_hash)) && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-sm">Blockchain Consensus Registration Confirmed</h4>
                    <p className="text-xs text-emerald-700">This property deed and cryptographic document hashes are permanently anchored on the Ethereum Virtual Machine (EVM).</p>
                  </div>
                </div>
                <StatusBadge status="BLOCKCHAIN_REGISTERED" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-emerald-200/60 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-900 block">Transaction Hash</span>
                  <div className="mt-1">
                    <HashDisplay value={selectedProperty.blockchain_tx_hash || ''} explorerLink />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-emerald-900 block">Block Number</span>
                  <span className="font-mono font-bold text-slate-800 mt-1 block">
                    #{selectedProperty.blockchain_block_number || '1'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-emerald-900 block">Smart Contract Address</span>
                  <div className="mt-1">
                    <HashDisplay value={selectedProperty.blockchain_contract_address || '0x5FbDB2315678afecb367f032d93F642f64180aa3'} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-emerald-900 block">Anchored Timestamp</span>
                  <span className="text-slate-700 font-mono text-[11px] mt-1 block">
                    {formatDate(selectedProperty.blockchain_registration_timestamp || selectedProperty.registeredAt)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Blockchain Registration Pending/Failed Banner with Retry */}
          {selectedProperty && isPropertyVerified && selectedProperty.status !== 'BLOCKCHAIN_REGISTERED' && !selectedProperty.blockchain_tx_hash && (
            <div className="rounded-xl border border-rose-300 bg-rose-50/80 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-rose-950 text-sm">Blockchain Registration Action Required</h4>
                      <StatusBadge status={selectedProperty.status || 'BLOCKCHAIN_FAILED'} />
                    </div>
                    <p className="text-xs text-rose-700 mt-0.5">
                      {selectedProperty.blockchain_error ||
                        'Property deed was verified, but smart contract registration encountered an EVM connection issue. Click Retry to complete on-chain registration.'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white border-rose-300 hover:bg-rose-100 text-rose-800 whitespace-nowrap shrink-0"
                  leftIcon={<RotateCw className={`h-3.5 w-3.5 ${isRetryingBlockchain === selectedProperty.id ? 'animate-spin' : ''}`} />}
                  isLoading={isRetryingBlockchain === selectedProperty.id}
                  onClick={() => handleRetryBlockchain(selectedProperty.id)}
                >
                  Retry Blockchain Registration
                </Button>
              </div>
            </div>
          )}

          {/* Required Documents Checklist Card */}
          {selectedProperty && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Required Documents Checklist
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {user?.role === 'VERIFIER' || user?.role === 'ADMIN'
                      ? 'Inspection Checklist: All 4 mandatory documents must be verified before on-chain conveyance.'
                      : 'Upload all 4 mandatory document types to submit your property for verifier review.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {activeUploadedCount} of 4 required
                  </span>
                  {allRequiredUploaded ? (
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      All Uploaded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      {4 - activeUploadedCount} Missing
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    allRequiredUploaded ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${(activeUploadedCount / 4) * 100}%` }}
                />
              </div>

              {/* 4 Checklist Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                {REQUIRED_DOCUMENT_TYPES.map((req) => {
                  const doc = getDocForType(req.label)
                  const isUploaded = !!doc && isActiveDoc(doc)
                  const needsFix = !!doc && isNeedsCorrection(doc.status)
                  return (
                    <div
                      key={req.id}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        isUploaded
                          ? 'border-emerald-200 bg-white shadow-2xs'
                          : needsFix
                          ? 'border-amber-300 bg-amber-50/50'
                          : 'border-slate-200 bg-white/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {isUploaded ? (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          </div>
                        ) : needsFix ? (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                            <XCircle className="h-3.5 w-3.5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div className="h-4 w-4 shrink-0 rounded border border-slate-300 bg-slate-200" />
                        )}
                        <span className="font-semibold text-slate-800 text-xs">
                          {req.label}
                        </span>
                      </div>

                      <div className="pl-7 space-y-1">
                        {doc ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 font-medium">Status:</span>
                              <StatusBadge status={isSeller ? getPlainStatus(doc.status) : doc.status} />
                            </div>
                            <p className="text-[11px] text-slate-600 truncate font-mono" title={doc.documentName}>
                              {doc.documentName}
                            </p>
                          </>
                        ) : (
                          <div className="text-[11px] text-slate-400">
                            Missing
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Action row for Property Owner */}
              {isSeller && (
                <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-slate-200">
                  <p className="text-[11px] text-slate-500">
                    {isPropertyVerified
                      ? 'This property has been officially verified by a title verifier and anchored on the blockchain.'
                      : isPropertySubmitted && !isPropertyNeedsCorrection
                      ? 'Submitted for verification. A verifier will review your documents.'
                      : isPropertyNeedsCorrection
                      ? allRequiredUploaded
                        ? 'Corrected document uploaded. Click below to re-submit for verifier review.'
                        : 'Correction requested by reviewer. Please re-upload the corrected document above.'
                      : allRequiredUploaded
                      ? 'Ready: Click below to submit this property for title verifier inspection.'
                      : 'Upload the missing document types above to enable verifier review submission.'}
                  </p>
                  <Button
                    size="sm"
                    disabled={
                      !allRequiredUploaded ||
                      isSubmittingReview ||
                      isPropertyVerified ||
                      (isPropertySubmitted && !isPropertyNeedsCorrection)
                    }
                    onClick={handleSubmitForVerification}
                    isLoading={isSubmittingReview}
                  >
                    {isPropertyVerified
                      ? 'Property Verified'
                      : isPropertySubmitted && !isPropertyNeedsCorrection
                      ? 'Waiting for verifier'
                      : isPropertyNeedsCorrection
                      ? 'Re-submit for Verification'
                      : allRequiredUploaded
                      ? 'Submit for Verification'
                      : `${4 - activeUploadedCount} Missing`}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Upload Drop Zone / Disabled Box */}
          {isSeller && properties.length === 0 ? (
            <div className="border-2 border-slate-200 bg-slate-50 rounded-xl p-8 text-center cursor-not-allowed">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                You have no properties yet. Register a property first.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Uploads will become available once you register your first property.
              </p>
              <div className="mt-4">
                <Button size="sm" disabled>
                  Upload Disabled
                </Button>
              </div>
            </div>
          ) : isSeller && isPropertySubmitted && !isPropertyNeedsCorrection ? (
            <div className="border-2 border-slate-200 bg-slate-50 rounded-xl p-8 text-center cursor-not-allowed">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Waiting for verifier
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Submitted for verification. A verifier will review your documents. Uploading is locked until review is complete or a correction is requested.
              </p>
              <div className="mt-4">
                <Button size="sm" disabled>
                  Uploads Locked (In Review)
                </Button>
              </div>
            </div>
          ) : allRequiredUploaded && !isPropertyNeedsCorrection ? (
            <div className="border-2 border-slate-200 bg-slate-50 rounded-xl p-8 text-center cursor-not-allowed">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                All documents uploaded
              </p>
              <p className="text-xs text-slate-500 mt-1">
                All 4 required documents have been uploaded for this property. If a reviewer requests corrections, you can re-upload that document type.
              </p>
              <div className="mt-4">
                <Button size="sm" disabled>
                  All documents uploaded
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                const file = e.dataTransfer.files?.[0]
                if (file) handleProcessFile(file)
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-300 bg-white hover:bg-slate-50 hover:border-blue-400'
              }`}
            >
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {isUploading
                  ? 'Uploading & Hashing Document...'
                  : 'Click here or drag and drop document to browse files'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Upload your {selectedDocType} for this property. Cryptographic SHA-256 verification hash is generated.
              </p>
              <div className="mt-4">
                <Button
                  size="sm"
                  isLoading={isUploading}
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  Select & Ingest Document
                </Button>
              </div>
            </div>
          )}

          {/* Duplicate Error Message under upload box */}
          {uploadError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadNotice && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
              {uploadNotice}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Document Listing & Verification State */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {isSeller ? 'My Property Documents' : 'Ingested Deeds & Verification Queue'}
            </h3>
            <p className="text-xs text-slate-500">
              {isSeller
                ? 'Your uploaded documents, review statuses, and cryptographic blockchain proof.'
                : 'Verifier review queue with optical text parsing and on-chain verification.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showHistory}
                onChange={(e) => setShowHistory(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span>Show history</span>
            </label>
            <span className="text-xs text-slate-500 font-mono">{displayedDocuments.length} Records</span>
          </div>
        </div>

        {displayedDocuments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <p className="font-medium text-slate-600">No documents found</p>
            <p className="mt-1">
              {isSeller && properties.length === 0
                ? 'You have no properties yet. Register a property first.'
                : 'Select a property above and click "Select & Ingest Document" to stage documents.'}
            </p>
          </div>
        ) : isSeller ? (
          /* Seller View Table (Requirement 5) */
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[170px] max-w-[220px]">Document Name</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="min-w-[150px] max-w-[200px]">Property</TableHead>
                  <TableHead className="whitespace-nowrap">Uploaded At</TableHead>
                  <TableHead className="whitespace-nowrap">File Size</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="min-w-[160px] max-w-[220px]">Verifier Message</TableHead>
                  <TableHead className="min-w-[180px] whitespace-nowrap">Hash Proof</TableHead>
                  <TableHead className="whitespace-nowrap">On-Chain Status</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedDocuments.map((doc) => {
                  const plainStatus = getPlainStatus(doc.status)
                  const onChainStatus = getOnChainStatus(doc)
                  const showMessage = (plainStatus === 'Needs correction' || plainStatus === 'Rejected')
                  const verifierMsg = doc.reviewNotes || (plainStatus === 'Needs correction' ? 'Correction requested by reviewer' : plainStatus === 'Rejected' ? 'Document rejected by reviewer' : null)
                  const matchedProp = properties.find(
                    (p) => p.propertyId === doc.propertyId || p.id === doc.propertyId || p.id === doc.property_id
                  )
                  const simplePropName = matchedProp ? getPropertyLabel(matchedProp) : (doc.propertyTitle || 'Property')

                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="min-w-[170px] max-w-[220px]">
                        <div className="flex items-center gap-2 min-w-0" title={doc.documentName}>
                          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-900 truncate">{doc.documentName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 font-medium whitespace-nowrap">{doc.documentType}</TableCell>
                      <TableCell className="min-w-[150px] max-w-[200px]">
                        <p className="font-semibold text-slate-800 truncate" title={simplePropName}>
                          {simplePropName}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(doc.uploadedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 font-mono whitespace-nowrap">{doc.fileSize}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge status={plainStatus} />
                      </TableCell>
                      <TableCell className="min-w-[160px] max-w-[220px]">
                        {showMessage && verifierMsg ? (
                          <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1 border border-amber-200/60 truncate" title={verifierMsg}>
                            {verifierMsg}
                          </p>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[180px] whitespace-nowrap">
                        <HashDisplay value={doc.documentHash} explorerLink />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge status={onChainStatus} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewDoc(doc)}
                            leftIcon={<Eye className="h-3 w-3" />}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(doc)}
                            leftIcon={<Download className="h-3 w-3" />}
                          >
                            Download
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* Verifier Grouped Queue View (Part 2) */
          <div className="p-4 space-y-6">
            {properties.filter((p) => {
              const s = (p.verification_status || p.verificationStatus || '').toString().toUpperCase()
              return s !== 'PENDING'
            }).length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <CheckCircle className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <p className="font-semibold text-slate-700 text-sm">No properties in verification queue</p>
                <p className="mt-1">Properties submitted by sellers will appear here for title review.</p>
              </div>
            ) : (
              properties
                .filter((p) => {
                  const s = (p.verification_status || p.verificationStatus || '').toString().toUpperCase()
                  return s === 'SUBMITTED' || s === 'CORRECTION_REQUESTED' || s === 'REQUIRES_CORRECTION' || s === 'VERIFIED'
                })
                .map((prop) => {
                  const propDocs = documents.filter(
                    (d) =>
                      (d.propertyId === prop.propertyId || d.property_id === prop.id) &&
                      (d.status || '').toUpperCase() !== 'REPLACED'
                  )

                  // Item 6: Count distinct active required document types uploaded
                  const reqLabels = ['Title Deed', 'Cadastral Survey', 'Tax Clearance', 'Encumbrance Certificate']
                  const uploadedTypes = new Set(
                    propDocs.map((d) => {
                      const t = (d.documentType || '').toLowerCase()
                      if (t.includes('title') || t.includes('sale')) return 'Title Deed'
                      if (t.includes('survey') || t.includes('cadastral')) return 'Cadastral Survey'
                      if (t.includes('tax')) return 'Tax Clearance'
                      if (t.includes('encumbrance')) return 'Encumbrance Certificate'
                      return d.documentType
                    })
                  )
                  const uploadedCount = reqLabels.filter((lbl) => uploadedTypes.has(lbl)).length
                  const approvedCount = propDocs.filter(
                    (d) => (d.status || '').toUpperCase() === 'VERIFIED'
                  ).length

                  // Item 3: Check if any active doc has an unresolved cross-property duplicate
                  const hasUnresolvedDuplicate = propDocs.some((d) => d.is_cross_property_duplicate)

                  // Item 5: Read same field everywhere
                  const propStatus = (prop.verification_status || prop.verificationStatus || 'SUBMITTED').toString()
                  const isPropVerified = propStatus.toUpperCase() === 'VERIFIED'
                  const isPropRejected = propStatus.toUpperCase() === 'REJECTED'
                  const canVerify = uploadedCount === 4 && approvedCount === 4 && !isPropVerified && !isPropRejected && !hasUnresolvedDuplicate

                  return (
                    <Card key={prop.id} className="overflow-hidden border border-slate-200">
                      <CardHeader className="bg-slate-50/70 pb-3 border-b border-slate-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-base">
                                {getPropertyLabel(prop)}
                              </h3>
                              <StatusBadge status={propStatus} />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                              <span className="font-mono">Parcel ID: {prop.property_number || prop.propertyId}</span>
                              <span>•</span>
                              <span>Location: {prop.city}, {prop.state}</span>
                              <span>•</span>
                              <span>Seller: {prop.seller_name || prop.owner_name || prop.currentOwner || 'Property Owner'}</span>
                              <span>•</span>
                              <span>Submitted: {formatDate(prop.submitted_at || prop.created_at || '')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {uploadedCount < 4 ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                  {uploadedCount} of 4 uploaded
                                </span>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  Missing documents
                                </span>
                              </div>
                            ) : (
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  approvedCount === 4
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {approvedCount} of 4 Approved
                              </span>
                            )}

                            {isPropVerified ? (
                              prop.status === 'BLOCKCHAIN_FAILED' || (prop.status === 'BLOCKCHAIN_PENDING' && !prop.blockchain_tx_hash) ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Blockchain Failed
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                                    leftIcon={<RotateCw className={`h-3 w-3 ${isRetryingBlockchain === prop.id ? 'animate-spin' : ''}`} />}
                                    isLoading={isRetryingBlockchain === prop.id}
                                    onClick={() => handleRetryBlockchain(prop.id)}
                                  >
                                    Retry Anchor
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                    <ShieldCheck className="h-4 w-4" /> Registered On-Chain {prop.blockchain_block_number ? `(Block #${prop.blockchain_block_number})` : ''}
                                  </span>
                                </div>
                              )
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  disabled={!canVerify || isVerifyingProperty === prop.id}
                                  isLoading={isVerifyingProperty === prop.id}
                                  onClick={() => handleVerifyProperty(prop.id)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                                  title={
                                    isPropVerified
                                      ? 'Property is already verified'
                                      : isPropRejected
                                      ? 'Property has been rejected'
                                      : uploadedCount < 4
                                      ? `Cannot verify: ${4 - uploadedCount} required document(s) missing`
                                      : hasUnresolvedDuplicate
                                      ? 'Cannot verify: Unresolved cross-property duplicate document detected'
                                      : approvedCount < 4
                                      ? `Cannot verify: Only ${approvedCount} of 4 documents approved`
                                      : 'All 4 documents approved: Click to verify property and anchor on blockchain'
                                  }
                                >
                                  Verify Property
                                </Button>
                                {!isPropVerified && !isPropRejected && (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    disabled={isVerifyingProperty === prop.id}
                                    onClick={() => handleRejectProperty(prop.id, 'Statutory verification audit rejected.')}
                                    className="text-xs h-8"
                                    title="Reject property verification (will not anchor on blockchain)"
                                  >
                                    Reject Property
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-0">
                        {/* Item 8: Table layout fits card with fallback horizontal scroll */}
                        <div className="w-full overflow-x-auto">
                          <Table className="w-full border-0">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="max-w-[170px]">Document Name</TableHead>
                                <TableHead className="whitespace-nowrap">Type</TableHead>
                                <TableHead className="whitespace-nowrap">Hash Proof</TableHead>
                                <TableHead className="whitespace-nowrap">OCR Match</TableHead>
                                <TableHead className="whitespace-nowrap">Status</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {propDocs.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-400">
                                    No documents uploaded for this property yet.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                propDocs.map((doc) => {
                                  const isDocVerified = (doc.status || '').toUpperCase() === 'VERIFIED'
                                  // Item 4: Disable Approve and Request Correction on Needs correction or Replaced
                                  const isDocActionDisabled =
                                    ['CORRECTION_REQUESTED', 'REQUIRES_CORRECTION', 'NEEDS CORRECTION'].includes((doc.status || '').toUpperCase()) ||
                                    (doc.status || '').toUpperCase() === 'REPLACED'

                                  return (
                                    <TableRow key={doc.id}>
                                      <TableCell className="max-w-[170px]">
                                        <div className="flex items-center gap-1.5 min-w-0" title={doc.documentName}>
                                          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                          <span className="font-medium text-slate-900 truncate">
                                            {doc.documentName}
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-slate-400 ml-5 block font-mono">
                                          {doc.fileSize}
                                        </span>
                                        {/* Item 3: Red warning for cross-property duplicate */}
                                        {doc.is_cross_property_duplicate && (
                                          <div
                                            className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1 truncate"
                                            title={`Duplicate of ${doc.duplicate_property_name || 'another property'}`}
                                          >
                                            <AlertTriangle className="h-3 w-3 shrink-0 text-rose-600" />
                                            <span className="truncate">
                                              Duplicate of {doc.duplicate_property_name || 'another property'}
                                            </span>
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs text-slate-700 font-medium whitespace-nowrap">
                                        {doc.documentType}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap">
                                        <HashDisplay value={doc.documentHash} explorerLink />
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap">
                                        {/* Item 2: Real OCR or Not scanned */}
                                        {typeof doc.ocrConfidence === 'number' && doc.ocrConfidence > 0 ? (
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full ${
                                                  doc.ocrConfidence > 90
                                                    ? 'bg-emerald-500'
                                                    : doc.ocrConfidence > 75
                                                    ? 'bg-amber-500'
                                                    : 'bg-rose-500'
                                                }`}
                                                style={{ width: `${doc.ocrConfidence}%` }}
                                              />
                                            </div>
                                            <span className="text-xs font-mono font-semibold text-slate-700">
                                              {doc.ocrConfidence}%
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-400 italic">Not scanned</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap">
                                        <StatusBadge status={doc.status} />
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {/* Item 8: Compact action buttons that wrap into two rows cleanly */}
                                        <div className="flex flex-wrap items-center justify-end gap-1 max-w-[240px] ml-auto">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => setSelectedDoc(doc)}
                                            leftIcon={<Eye className="h-3 w-3" />}
                                            title="View Document Details & OCR"
                                          >
                                            View
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => handleDownload(doc)}
                                            leftIcon={<Download className="h-3 w-3" />}
                                            title="Download Decrypted File"
                                          >
                                            Download
                                          </Button>
                                          {isDocVerified ? (
                                            <span className="text-xs text-emerald-600 font-semibold px-2 py-0.5 flex items-center gap-1">
                                              <Check className="h-3.5 w-3.5" /> Approved
                                            </span>
                                          ) : (
                                            <>
                                              <Button
                                                size="sm"
                                                disabled={isDocActionDisabled || doc.is_cross_property_duplicate}
                                                onClick={() => handleApproveDocument(doc)}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 px-2"
                                                leftIcon={<Check className="h-3 w-3" />}
                                                title={
                                                  doc.is_cross_property_duplicate
                                                    ? 'Cannot approve: Unresolved duplicate of another property. Request correction or reject.'
                                                    : isDocActionDisabled
                                                    ? 'Awaiting seller to upload replacement document'
                                                    : 'Approve Document'
                                                }
                                              >
                                                Approve
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="secondary"
                                                disabled={isDocActionDisabled}
                                                onClick={() => {
                                                  setCorrectionDoc(doc)
                                                  setCorrectionNote('')
                                                }}
                                                className="text-xs h-7 px-2 text-amber-700 hover:bg-amber-50 border-amber-200"
                                                title={
                                                  isDocActionDisabled
                                                    ? 'Awaiting seller to upload replacement document'
                                                    : 'Request Correction'
                                                }
                                              >
                                                Correct
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
            )}
          </div>
        )}
      </div>

      {/* Seller View Document Modal */}
      {viewDoc && (
        <Modal
          isOpen={!!viewDoc}
          onClose={() => setViewDoc(null)}
          title={`Document Details: ${viewDoc.documentName}`}
          description={`Uploaded on ${formatDate(viewDoc.uploadedAt)}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Property</span>
                <span className="font-semibold text-slate-900 text-right">
                  {getPropertyLabel(viewDoc)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Classification</span>
                <span className="font-medium text-slate-800">{viewDoc.documentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">File Size</span>
                <span className="font-mono text-slate-800">{viewDoc.fileSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Document Status</span>
                <StatusBadge status={getPlainStatus(viewDoc.status)} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Blockchain Ledger</span>
                <StatusBadge status={getOnChainStatus(viewDoc)} />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 text-white font-mono text-[11px] space-y-1.5">
              <p className="text-slate-400">Cryptographic Digest (SHA-256):</p>
              <HashDisplay
                value={viewDoc.documentHash}
                truncate={false}
                explorerLink
                className="bg-slate-800 text-blue-300 border-slate-700"
              />
              {viewDoc.ipfsCid && (
                <p className="text-slate-400 pt-1">IPFS CID: {viewDoc.ipfsCid}</p>
              )}
            </div>

            {viewDoc.reviewNotes && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                <span className="text-amber-800 font-bold uppercase tracking-wider text-[10px] block">
                  Reviewer Notes & Instructions
                </span>
                <p className="text-amber-900 mt-1">{viewDoc.reviewNotes}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleDownload(viewDoc)}
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                Download Document
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewDoc(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Verifier / Admin Document Audit Detail Modal */}
      {selectedDoc && (
        <Modal
          isOpen={!!selectedDoc}
          onClose={() => setSelectedDoc(null)}
          title={`Document Verification Audit: ${selectedDoc.documentName}`}
          description={`Uploaded on ${formatDate(selectedDoc.uploadedAt)} by ${selectedDoc.uploadedBy}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Property</span>
                <div className="text-right">
                  <span className="font-semibold text-slate-900 block">
                    {getPropertyLabel(selectedDoc)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Parcel ID: {selectedDoc.propertyId}
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Classification</span>
                <span className="font-medium text-slate-800">{selectedDoc.documentType}</span>
              </div>
              {(isVerifier || isAdmin) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">OCR Confidence Score</span>
                  {typeof selectedDoc.ocrConfidence === 'number' && selectedDoc.ocrConfidence > 0 ? (
                    <span className="font-mono font-bold text-slate-900">{selectedDoc.ocrConfidence}%</span>
                  ) : (
                    <span className="text-slate-400 italic">Not scanned</span>
                  )}
                </div>
              )}
              {selectedDoc.is_cross_property_duplicate && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span><strong>Warning:</strong> Duplicate of {selectedDoc.duplicate_property_name || 'another property'}. Request correction or reject before verification.</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Audit Status</span>
                <StatusBadge status={selectedDoc.status} />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 text-white font-mono text-[11px] space-y-1.5">
              <p className="text-slate-400">Cryptographic Digest (SHA-256):</p>
              <HashDisplay
                value={selectedDoc.documentHash}
                truncate={false}
                explorerLink
                className="bg-slate-800 text-blue-300 border-slate-700"
              />
              {selectedDoc.ipfsCid && (
                <p className="text-slate-400 pt-1">IPFS CID: {selectedDoc.ipfsCid}</p>
              )}
            </div>

            {selectedDoc.reviewNotes && (
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                  Auditor Notes & Findings
                </span>
                <p className="text-slate-700 mt-1">{selectedDoc.reviewNotes}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isUpdating}
                  onClick={() => handleDecision(selectedDoc.id, 'Verified')}
                  leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                >
                  Confirm & Anchor
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDecision(selectedDoc.id, 'Rejected')}
                  leftIcon={<XCircle className="h-3.5 w-3.5" />}
                >
                  Reject Deed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(selectedDoc)}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                >
                  Download
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedDoc(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Verifier Request Correction Modal */}
      {correctionDoc && (
        <Modal
          isOpen={!!correctionDoc}
          onClose={() => setCorrectionDoc(null)}
          title={`Request Correction: ${correctionDoc.documentType}`}
          description="Explain why this document needs correction so the property owner can upload a replacement."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <p>
                <span className="text-slate-500">File:</span>{' '}
                <strong className="text-slate-800">{correctionDoc.documentName}</strong>
              </p>
              <p>
                <span className="text-slate-500">Hash:</span>{' '}
                <span className="font-mono text-blue-600">
                  {truncateHash(correctionDoc.documentHash, 8, 6)}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Correction Instructions for Seller *
              </label>
              <textarea
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                placeholder="e.g. Blurry cadastral scan, survey boundary markers unreadable. Please upload a clear 300dpi scan."
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[90px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setCorrectionDoc(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!correctionNote.trim()}
                isLoading={isUpdating}
                onClick={handleRequestCorrection}
              >
                Send Correction Request
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default DocumentVerificationPage
