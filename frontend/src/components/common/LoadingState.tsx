import React from 'react'

export interface LoadingStateProps {
  message?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading PropChain records...' }) => {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center space-y-3 p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
      <p className="text-xs font-medium text-slate-500">{message}</p>
    </div>
  )
}

