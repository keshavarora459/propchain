import React from 'react'
import { Check, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { getTransactionLifecycleProgress, type LifecycleStepState } from '@/lib/utils'
import { HashDisplay } from '@/components/common/HashDisplay'

export interface TransactionLifecycleTimelineProps {
  status?: string | null
  blockchainError?: string | null
  blockchainBlockNumber?: number | null
  blockchainTxHash?: string | null
  className?: string
  compact?: boolean
}

export const TransactionLifecycleTimeline: React.FC<TransactionLifecycleTimelineProps> = ({
  status,
  blockchainError,
  blockchainBlockNumber,
  blockchainTxHash,
  className = '',
  compact = false,
}) => {
  const { currentStepLabel, isCompleted, isCancelledOrRejected, steps } =
    getTransactionLifecycleProgress(status, blockchainError)

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Lifecycle Progress:</span>
          <span
            className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : isCancelledOrRejected
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : blockchainError
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}
          >
            {isCompleted
              ? 'Conveyance Completed ✓'
              : isCancelledOrRejected
              ? 'Proposal Inactive'
              : `Active Step: ${currentStepLabel}`}
          </span>
        </div>

        {/* Blockchain Record Badge if present */}
        {(blockchainBlockNumber || blockchainTxHash) && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Block #{blockchainBlockNumber ?? 'N/A'}</span>
            {blockchainTxHash && (
              <span className="inline-block ml-1">
                <HashDisplay
                  value={blockchainTxHash}
                  explorerLink
                  className="bg-transparent border-0 px-0 py-0 text-emerald-800 text-[11px]"
                />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {steps.map((step: LifecycleStepState) => {
          let containerClass = 'bg-slate-50 border-slate-200 text-slate-400'
          let iconBg = 'bg-slate-200 text-slate-500'
          let badgeText = 'Upcoming'

          if (step.state === 'completed') {
            containerClass = 'bg-emerald-50/60 border-emerald-300 text-emerald-900 shadow-xs'
            iconBg = 'bg-emerald-600 text-white'
            badgeText = 'Done'
          } else if (step.state === 'current') {
            containerClass = 'bg-blue-50 border-blue-400 text-blue-950 ring-1 ring-blue-300 shadow-xs'
            iconBg = 'bg-blue-600 text-white animate-pulse'
            badgeText = 'In Progress'
          } else if (step.state === 'error') {
            containerClass = 'bg-rose-50 border-rose-300 text-rose-950 shadow-xs'
            iconBg = 'bg-rose-600 text-white'
            badgeText = 'Failed'
          }

          return (
            <div
              key={step.number}
              className={`rounded-lg border p-2.5 flex flex-col justify-between transition-all ${containerClass}`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${iconBg}`}>
                  {step.state === 'completed' ? (
                    <Check className="h-3 w-3 stroke-[3]" />
                  ) : step.state === 'error' ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    step.number
                  )}
                </div>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider opacity-75">
                  {badgeText}
                </span>
              </div>

              <div>
                <p className="text-[11px] font-bold leading-tight">{step.label}</p>
                {!compact && (
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-snug">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Error banner if conveyance halted on blockchain */}
      {blockchainError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-rose-800">Blockchain Transfer Error:</p>
            <p className="font-mono text-[11px] text-rose-700 break-all">{blockchainError}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionLifecycleTimeline

