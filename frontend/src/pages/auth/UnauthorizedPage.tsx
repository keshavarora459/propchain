import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { getRoleLabel } from '@/lib/utils'

export const UnauthorizedPage: React.FC = () => {
  const { user } = useAuth()

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-xl shadow-amber-500/5">
          <ShieldAlert className="h-10 w-10" />
        </div>
      </div>

      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 mb-3">
        HTTP 403 · Access Restricted
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">
        Insufficient Network Permissions
      </h1>

      <p className="max-w-md text-sm text-slate-500 mb-6">
        Your current role (
        <span className="font-sans font-semibold text-slate-800">{getRoleLabel(user?.role) || 'Guest'}</span>
        ) is not authorized to access this specific ledger operation or governance module.
      </p>

      <div className="flex items-center gap-3">
        <Link to="/dashboard">
          <Button className="bg-slate-900 hover:bg-slate-800 text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default UnauthorizedPage
