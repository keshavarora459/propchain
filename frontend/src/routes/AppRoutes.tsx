import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingState } from '@/components/common/LoadingState'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Public Auth Pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const UnauthorizedPage = lazy(() => import('@/pages/auth/UnauthorizedPage'))

// Administrative Governance Pages
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'))

// Core Application Pages
const DashboardPage = lazy(() =>
  import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
const PropertiesPage = lazy(() =>
  import('@/pages/properties/PropertiesPage').then((m) => ({ default: m.PropertiesPage }))
)
const PropertyDetailPage = lazy(() =>
  import('@/pages/properties/PropertyDetailPage').then((m) => ({ default: m.PropertyDetailPage }))
)
const OwnershipRegistryPage = lazy(() =>
  import('@/pages/ownership/OwnershipRegistryPage').then((m) => ({
    default: m.OwnershipRegistryPage,
  }))
)
const TransactionsPage = lazy(() =>
  import('@/pages/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))
)
const DocumentVerificationPage = lazy(() =>
  import('@/pages/documents/DocumentVerificationPage').then((m) => ({
    default: m.DocumentVerificationPage,
  }))
)
const ApprovalsPage = lazy(() =>
  import('@/pages/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage }))
)
const FraudDetectionPage = lazy(() =>
  import('@/pages/fraud/FraudDetectionPage').then((m) => ({ default: m.FraudDetectionPage }))
)
const BlockchainExplorerPage = lazy(() =>
  import('@/pages/blockchain/BlockchainExplorerPage').then((m) => ({
    default: m.BlockchainExplorerPage,
  }))
)
const ReportsPage = lazy(() =>
  import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage }))
)
const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const NotFoundPage = lazy(() =>
  import('@/pages/not-found/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
)

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingState message="Loading PropChain workspace..." />}>
      <Routes>
        {/* Public Authentication Endpoints */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected Authenticated Monorepo Application Shell */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
          <Route path="/ownership" element={<OwnershipRegistryPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/blockchain-explorer" element={<BlockchainExplorerPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Role-Protected Routes */}
          <Route
            path="/documents"
            element={
              <ProtectedRoute requiredRole={['ADMIN', 'PROPERTY_OWNER', 'REGISTRAR', 'VERIFIER', 'LEGAL_AUTHORITY']}>
                <DocumentVerificationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/approvals"
            element={
              <ProtectedRoute requiredRole={['ADMIN', 'REGISTRAR', 'VERIFIER', 'LEGAL_AUTHORITY']}>
                <ApprovalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fraud-detection"
            element={
              <ProtectedRoute requiredRole={['ADMIN', 'REGISTRAR', 'VERIFIER']}>
                <FraudDetectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <UserManagementPage />
              </ProtectedRoute>
            }
          />

          {/* 404 Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
export default AppRoutes
