import type { FraudAlert } from '@/types/fraud'

export const MOCK_FRAUD_ALERTS: FraudAlert[] = [
  {
    id: 'alt-1',
    alertId: 'ALT-882',
    propertyId: 'PROP-10045',
    propertyTitle: 'Oakridge Master-Planned Development Site',
    riskScore: 89,
    riskLevel: 'Critical',
    category: 'Document Forgery Suspect',
    detectedAt: '2024-10-04T12:05:00Z',
    status: 'Under Investigation',
    summary: 'Watermark analysis indicates altered notary registration date and invalid commission hash.',
    indicators: [
      'Document timestamp predates electronic county seal issuance',
      'Notary commission ID mismatch in official Secretary of State registry',
      'Sudden ownership conveyance attempt immediately following inactive deed status',
    ],
    recommendedAction: 'Freeze on-chain title registry lock and request authenticated physical deed deposition.',
  },
  {
    id: 'alt-2',
    alertId: 'ALT-883',
    propertyId: 'PROP-10043',
    propertyTitle: 'Metro Logistics Hub - Facility 4',
    riskScore: 48,
    riskLevel: 'Medium',
    category: 'Metadata Inconsistency',
    detectedAt: '2024-08-01T10:20:00Z',
    status: 'Open',
    summary: 'Tax clearance assessment value deviates by 28% from municipal tax assessor valuation record.',
    indicators: [
      'Valuation mismatch between applicant affidavit ($8.2M) and property tax assessment ($10.5M)',
      'Subdivision parcel number suffix formatting anomaly',
    ],
    recommendedAction: 'Issue automated inquiry notice to county assessor API for reconciled valuation.',
  },
  {
    id: 'alt-3',
    alertId: 'ALT-880',
    propertyId: 'PROP-10041',
    propertyTitle: 'Skyline Commercial Center - Tower A',
    riskScore: 12,
    riskLevel: 'Low',
    category: 'Anomalous Ownership Velocity',
    detectedAt: '2024-03-14T08:15:00Z',
    status: 'Resolved',
    summary: 'Routine ownership change after 5-year holding period. No adverse flags identified.',
    indicators: [
      'Clean historical title trace across 3 previous conveyances',
      'All biometric and cryptographic signatures confirmed',
    ],
    recommendedAction: 'Marked as false positive / normal commercial closing.',
  },
]

