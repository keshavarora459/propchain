import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingState } from '@/components/common/LoadingState'
import { BuyerDashboard } from './BuyerDashboard'
import { SellerDashboard } from './SellerDashboard'
import { AgentDashboard } from './AgentDashboard'
import { LegalAuthorityDashboard } from './LegalAuthorityDashboard'
import { AdminDashboard } from './AdminDashboard'

export const DashboardPage: React.FC = () => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <LoadingState message="Loading role-based workspace and cryptographic credentials..." />
      </div>
    )
  }

  const role = user?.role

  switch (role) {
    case 'BUYER':
      return <BuyerDashboard />
    case 'PROPERTY_OWNER':
      return <SellerDashboard />
    case 'VERIFIER':
      return <AgentDashboard />
    case 'LEGAL_AUTHORITY':
      return <LegalAuthorityDashboard />
    case 'ADMIN':
      return <AdminDashboard />
    default:
      return <BuyerDashboard />
  }
}

export default DashboardPage
