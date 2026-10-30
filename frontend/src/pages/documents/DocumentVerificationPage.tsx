import React, { useState } from 'react'
import {
  UploadCloud,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { MOCK_DOCUMENTS } from '@/mock-data/documents'
import { MOCK_PROPERTIES } from '@/mock-data/properties'
import { DOCUMENT_TYPES } from '@/constants/options'
import { truncateHash, formatDate } from '@/lib/utils'
import type { DocumentRecord, DocumentType } from '@/types/document'

function createDocumentRecord(
  propertyId: string,
  docType: DocumentType,
  matchedProp: any
): DocumentRecord {
  const timestamp = Date.now()
  return {
    id: `doc-${timestamp}`,
    propertyId,
    propertyTitle: matchedProp ? matchedProp.title : 'Selected Property',
    documentName: `${docType.replace(/\s+/g, '_')}_Upload.pdf`,
    documentType: docType,
    fileSize: '3.4 MB',
    uploadedAt: new Date(timestamp).toISOString(),
    uploadedBy: 'County Title Officer',
    status: 'OCR Processed',
    ocrConfidence: 94.2,
    documentHash: 'c4ca4238a0b923820dcc509a6f75849b28a4a5f83896434458514138a0b92382',
    reviewNotes: 'OCR text extraction complete. Ready for cryptographic approval.',
  }
}

export const DocumentVerificationPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>(MOCK_DOCUMENTS)
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState(MOCK_PROPERTIES[0].propertyId)
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('Title Deed')
  const [dragActive, setDragActive] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)

  const handleSimulatedUpload = () => {
    const matchedProp = MOCK_PROPERTIES.find((p) => p.propertyId === selectedPropertyId)
    const newDoc = createDocumentRecord(selectedPropertyId, selectedDocType, matchedProp)
    setDocuments([newDoc, ...documents])
    setUploadNotice('Document successfully staged for OCR pipeline & consensus anchoring.')
    setTimeout(() => setUploadNotice(null), 5000)
  }

  const handleDecision = (id: string, newStatus: 'Verified' | 'Rejected') => {
    setDocuments(
      documents.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
    )
    if (selectedDoc?.id === id) {
      setSelectedDoc(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Verification & OCR Pipeline"
        description="Ingestion, optical text parsing, and cryptographic hashing of property conveyances and surveys."
      />

      {/* Upload Interface Section */}
      <Card>
        <CardHeader>
          <CardTitle>Deed & Survey Ingestion Portal</CardTitle>
          <CardDescription>
            Supported formats: PDF, TIFF, PNG (Max 50MB). Integrated with PyMuPDF & Tesseract OCR pipelines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Associated Real Estate Parcel"
              options={MOCK_PROPERTIES.map((p) => ({ value: p.propertyId, label: `${p.propertyId} - ${p.title}` }))}
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
            />
            <Select
              label="Document Classification"
              options={DOCUMENT_TYPES}
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
            />
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              handleSimulatedUpload()
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive ? 'border-slate-900 bg-slate-50' : 'border-slate-300 bg-white hover:bg-slate-50/50'
            }`}
          >
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Drag and drop title deed or cadastral survey here, or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Automated OCR parsing and Keccak-256 / SHA-256 hash generation is executed upon upload.
            </p>
            <div className="mt-4">
              <Button size="sm" onClick={handleSimulatedUpload}>
                Select & Ingest Document
              </Button>
            </div>
          </div>

          {uploadNotice && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
              {uploadNotice}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Listing & Verification State */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Ingested Deeds & Verification Queue</h3>
          <span className="text-xs text-slate-500 font-mono">{documents.length} Records</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Name</TableHead>
              <TableHead>Target Parcel</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>OCR Confidence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hash Proof</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-900">{doc.documentName}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 ml-6">{doc.fileSize}</span>
                </TableCell>
                <TableCell>
                  <p className="font-semibold text-slate-800 truncate max-w-[180px]">
                    {doc.propertyTitle}
                  </p>
                  <span className="text-[11px] font-mono text-slate-400">{doc.propertyId}</span>
                </TableCell>
                <TableCell className="text-xs text-slate-600">{doc.documentType}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
                </TableCell>
                <TableCell>
                  <StatusBadge status={doc.status} />
                </TableCell>
                <TableCell className="font-mono text-[11px] text-slate-500">
                  {truncateHash(doc.documentHash, 6, 4)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDoc(doc)}
                      leftIcon={<Eye className="h-3 w-3" />}
                    >
                      Audit
                    </Button>
                    <button
                      onClick={() => handleDecision(doc.id, 'Verified')}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Approve Document"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDecision(doc.id, 'Rejected')}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Reject Document"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Document Audit Detail Modal */}
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
              <div className="flex justify-between">
                <span className="text-slate-500">Parcel Target</span>
                <span className="font-semibold text-slate-900">
                  {selectedDoc.propertyId} — {selectedDoc.propertyTitle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Classification</span>
                <span className="font-medium text-slate-800">{selectedDoc.documentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">OCR Confidence Score</span>
                <span className="font-mono font-bold text-slate-900">{selectedDoc.ocrConfidence}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Audit Status</span>
                <StatusBadge status={selectedDoc.status} />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 text-white font-mono text-[11px] space-y-1">
              <p className="text-slate-400">Cryptographic Digest (SHA-256):</p>
              <p className="break-all">{selectedDoc.documentHash}</p>
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
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedDoc(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
