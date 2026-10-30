export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'
export type FraudCategory =
  | 'Metadata Inconsistency'
  | 'Duplicate Parcel ID'
  | 'Document Forgery Suspect'
  | 'Anomalous Ownership Velocity'
  | 'Identity Mismatch'

export interface FraudAlert {
  id: string
  alertId: string // e.g. "ALT-882"
  propertyId: string
  propertyTitle: string
  riskScore: number // 0 - 100
  riskLevel: RiskLevel
  category: FraudCategory
  detectedAt: string
  status: 'Open' | 'Under Investigation' | 'Resolved' | 'False Positive'
  summary: string
  indicators: string[]
  recommendedAction: string
}

