import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useUI } from '@/hooks/useUI'
import { LoadingState } from '@/components/common/LoadingState'
import { BuyerDashboard } from './BuyerDashboard'
import { SellerDashboard } from './SellerDashboard'
import { AgentDashboard } from './AgentDashboard'
import { LegalAuthorityDashboard } from './LegalAuthorityDashboard'
import { AdminDashboard } from './AdminDashboard'

export const DashboardPage: React.FC = () => {
  const { user, isLoading } = useAuth()
  const { notificationsCount } = useUI()
  const navigate = useNavigate()
  const [toastVisible, setToastVisible] = useState(false)
  const [toastCount, setToastCount] = useState(0)

  useEffect(() => {
    if (isLoading || !user) return
    const alreadyShown = sessionStorage.getItem(`notif_toast_shown_${user.id}`)
    if (!alreadyShown && notificationsCount > 0) {
      setToastCount(notificationsCount)
      const timer = setTimeout(() => {
        setToastVisible(true)
        sessionStorage.setItem(`notif_toast_shown_${user.id}`, 'true')
      }, 800)
      const autoHide = setTimeout(() => {
        setToastVisible(false)
      }, 7000)
      return () => {
        clearTimeout(timer)
        clearTimeout(autoHide)
      }
    }
  }, [isLoading, user, notificationsCount])

  if (isLoading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <LoadingState message="Loading role-based workspace and cryptographic credentials..." />
      </div>
    )
  }

  const renderDashboard = () => {
    switch (user?.role) {
      case 'BUYER':
        return <BuyerDashboard />
      case 'PROPERTY_OWNER':
        return <SellerDashboard />
      case 'REGISTRAR':
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

  return (
    <div className="relative">
      {renderDashboard()}

      {/* On-Login Toast Notification */}
      {toastVisible && toastCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-blue-200 bg-white p-3.5 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Bell className="h-4 w-4" />
          </div>
          <div
            onClick={() => {
              setToastVisible(false)
              navigate('/notifications')
            }}
            className="cursor-pointer"
          >
            <p className="text-xs font-semibold text-slate-900">
              You have {toastCount} new notification{toastCount > 1 ? 's' : ''}
            </p>
            <p className="text-[11px] text-blue-600 hover:underline">Click to view notifications</p>
          </div>
          <button
            onClick={() => setToastVisible(false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors ml-1 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
