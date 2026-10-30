import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white mb-4 shadow-md">
        <ShieldAlert className="h-8 w-8 text-blue-400" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">404</h1>
      <h2 className="mt-2 text-lg font-semibold text-slate-800">Ledger Entry Not Found</h2>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        The requested parcel route, smart contract endpoint, or transaction record could not be located on this node.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link to="/dashboard">
          <Button leftIcon={<Home className="h-4 w-4" />}>Return to Overview</Button>
        </Link>
        <Button variant="outline" onClick={() => window.history.back()} leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Go Back
        </Button>
      </div>
    </div>
  )
}

