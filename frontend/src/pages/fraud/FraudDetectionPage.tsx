import React, { useState } from 'react'
import { ShieldAlert, AlertTriangle, Eye, ShieldCheck, Info } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { RiskIndicator } from '@/components/common/RiskIndicator'
import { StatusBadge } from '@/components/common/StatusBadge'
import { StatCard } from '@/components/common/StatCard'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { MOCK_FRAUD_ALERTS } from '@/mock-data/fraudAlerts'
import { formatDate } from '@/lib/utils'
import type { FraudAlert } from '@/types/fraud'

export const FraudDetectionPage: React.FC = () => {
  const [alerts, setAlerts] = useState<FraudAlert[]>(MOCK_FRAUD_ALERTS)
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null)

  const criticalCount = alerts.filter((a) => a.riskLevel === 'Critical').length
  const mediumCount = alerts.filter((a) => a.riskLevel === 'Medium').length
  const resolvedCount = alerts.filter((a) => a.status === 'Resolved' || a.status === 'False Positive').length

  const handleResolveAlert = (id: string, status: 'Resolved' | 'False Positive') => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, status } : a)))
    if (selectedAlert?.id === id) {
      setSelectedAlert(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Anomaly & Fraud Risk Radar"
        description="Machine learning powered document tampering analysis, signature cross-verification, and anomalous ownership velocity."
      />

      {/* Illustrative AI Disclaimer Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">Illustrative UI Presentation</p>
          <p className="mt-0.5 text-amber-800">
            The risk scores, anomaly metrics, and heuristic alerts displayed below are illustrative mock data demonstrating the Phase 2 frontend design. Production anomaly inference models (Scikit-learn) and OCR parsing (PyMuPDF / Tesseract) will connect during Phase 12.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Critical Risk Alerts"
          value={criticalCount}
          subtitle="Immediate registry lock recommended"
          icon={<AlertTriangle className="h-5 w-5" />}
          iconBg="bg-rose-50 text-rose-700"
        />
        <StatCard
          title="Medium Inconsistencies"
          value={mediumCount}
          subtitle="Metadata discrepancy under review"
          icon={<ShieldAlert className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Resolved Anomalies"
          value={resolvedCount}
          subtitle="Audited and cleared for settlement"
          icon={<ShieldCheck className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-700"
        />
      </div>

      {/* Suspicious Activity Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Flagged Transaction & Deed Anomalies</h3>
          <span className="text-xs text-slate-500 font-mono">{alerts.length} Incidents</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alert ID</TableHead>
              <TableHead>Target Parcel</TableHead>
              <TableHead>Anomaly Category</TableHead>
              <TableHead>Risk Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead className="text-right">Audit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alt) => (
              <TableRow key={alt.id}>
                <TableCell className="font-mono text-xs font-semibold text-slate-900">
                  {alt.alertId}
                </TableCell>
                <TableCell>
                  <p className="font-semibold text-slate-900 truncate max-w-[200px]">
                    {alt.propertyTitle}
                  </p>
                  <span className="text-[11px] font-mono text-slate-400">{alt.propertyId}</span>
                </TableCell>
                <TableCell className="text-xs font-medium text-slate-800">{alt.category}</TableCell>
                <TableCell>
                  <RiskIndicator score={alt.riskScore} level={alt.riskLevel} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={alt.status} />
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {formatDate(alt.detectedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedAlert(alt)}
                    leftIcon={<Eye className="h-3 w-3" />}
                  >
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Alert Investigation Modal */}
      {selectedAlert && (
        <Modal
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          title={`Forensic Risk Audit: ${selectedAlert.alertId}`}
          description={`Category: ${selectedAlert.category}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Heuristic Risk Score</span>
                <RiskIndicator score={selectedAlert.riskScore} level={selectedAlert.riskLevel} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Parcel</span>
                <span className="font-semibold text-slate-900">
                  {selectedAlert.propertyId} — {selectedAlert.propertyTitle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Investigation Status</span>
                <StatusBadge status={selectedAlert.status} />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                Anomaly Synthesis
              </span>
              <p className="text-slate-800 mt-1 font-medium leading-relaxed">
                {selectedAlert.summary}
              </p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                Detected Forensic Indicators
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                {selectedAlert.indicators.map((ind, i) => (
                  <li key={i}>{ind}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
              <span className="font-bold uppercase tracking-wider text-[10px] block text-blue-700">
                Automated Remediation Protocol
              </span>
              <p className="mt-1 font-medium">{selectedAlert.recommendedAction}</p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleResolveAlert(selectedAlert.id, 'Resolved')}
                >
                  Mark Resolved
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResolveAlert(selectedAlert.id, 'False Positive')}
                >
                  Dismiss (False Positive)
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
