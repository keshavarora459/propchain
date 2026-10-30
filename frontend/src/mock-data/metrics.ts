export interface DashboardMetrics {
  totalProperties: number
  verifiedProperties: number
  pendingVerification: number
  activeTransactions: number
  completedTransfers: number
  fraudAlerts: number
  totalValuationUSD: number
}

export const MOCK_DASHBOARD_METRICS: DashboardMetrics = {
  totalProperties: 1248,
  verifiedProperties: 1184,
  pendingVerification: 42,
  activeTransactions: 19,
  completedTransfers: 834,
  fraudAlerts: 3,
  totalValuationUSD: 482500000,
}

export const MOCK_REGISTRATION_TRENDS = [
  { month: 'May', registered: 45, verified: 42 },
  { month: 'Jun', registered: 58, verified: 55 },
  { month: 'Jul', registered: 72, verified: 68 },
  { month: 'Aug', registered: 84, verified: 79 },
  { month: 'Sep', registered: 95, verified: 90 },
  { month: 'Oct', registered: 110, verified: 104 },
]

export const MOCK_TRANSACTION_ACTIVITY = [
  { month: 'May', volumeUSD: 24.5, count: 18 },
  { month: 'Jun', volumeUSD: 31.2, count: 24 },
  { month: 'Jul', volumeUSD: 42.8, count: 31 },
  { month: 'Aug', volumeUSD: 38.6, count: 28 },
  { month: 'Sep', volumeUSD: 54.1, count: 39 },
  { month: 'Oct', volumeUSD: 68.4, count: 47 },
]

