import React, { useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState('property_registrations')
  const [dateRange, setDateRange] = useState('q3_2024')
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const handleExport = (format: 'CSV' | 'PDF' | 'JSON') => {
    setExportNotice(`Export job initiated: Generated PropChain_${reportType}_${dateRange}.${format.toLowerCase()}`)
    setTimeout(() => setExportNotice(null), 4000)
  }

  const reportsSummary = [
    {
      title: 'Parcel Title Tokenization Report',
      count: '1,248 Records',
      description: 'Historical breakdown of registered and verified ERC-721 real estate deeds.',
      lastGenerated: 'Oct 28, 2024',
    },
    {
      title: 'Escrow & Transfer Settlement Log',
      count: '834 Transactions',
      description: 'Audit report of atomic deed handovers, payment releases, and participant wallets.',
      lastGenerated: 'Oct 29, 2024',
    },
    {
      title: 'Forensic Fraud & Risk Audit',
      count: '24 Flagged Incidents',
      description: 'Compilation of OCR text anomalies, notary seal flags, and risk resolution statuses.',
      lastGenerated: 'Oct 30, 2024',
    },
    {
      title: 'Consensus Proof & Gas Utilization',
      count: '5.1M Block Height',
      description: 'Summary of Ethereum-compatible smart contract gas expenditures and transaction confirmation times.',
      lastGenerated: 'Oct 30, 2024',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance & Audit Reports"
        description="Generate certified registry extracts, historical conveyance reports, and risk telemetry."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('CSV')}
              leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('PDF')}
              leftIcon={<FileText className="h-3.5 w-3.5 text-rose-600" />}
            >
              Export PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport('JSON')}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              Raw JSON
            </Button>
          </div>
        }
      />

      {exportNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-semibold flex items-center justify-between">
          <span>{exportNotice}</span>
          <span className="font-mono text-[10px]">SHA-256 Validated</span>
        </div>
      )}

      {/* Filter Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Parameters & Date Filtering</CardTitle>
          <CardDescription>Configure telemetry scope for official compliance exports.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Report Category"
              options={[
                { value: 'property_registrations', label: 'Property Title Registrations' },
                { value: 'ownership_transfers', label: 'Ownership Conveyances & Escrows' },
                { value: 'document_verifications', label: 'Document & OCR Audit Log' },
                { value: 'fraud_alerts', label: 'AI Risk & Fraud Incident Log' },
              ]}
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            />
            <Select
              label="Reporting Horizon"
              options={[
                { value: 'q3_2024', label: 'Quarter 3 (Jul - Sep 2024)' },
                { value: 'q2_2024', label: 'Quarter 2 (Apr - Jun 2024)' },
                { value: 'ytd_2024', label: 'Year to Date (2024)' },
                { value: 'all_time', label: 'Full Historical Ledger' },
              ]}
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            />
            <div className="flex items-end">
              <Button className="w-full" leftIcon={<Filter className="h-4 w-4" />}>
                Apply Horizon Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Certified Extract Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reportsSummary.map((rep) => (
          <Card key={rep.title} className="hover:border-slate-300 transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{rep.title}</CardTitle>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {rep.count}
                </span>
              </div>
              <CardDescription>{rep.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex items-center justify-between text-xs">
              <span className="text-slate-400">Generated: {rep.lastGenerated}</span>
              <button
                onClick={() => handleExport('PDF')}
                className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Download Extract
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
