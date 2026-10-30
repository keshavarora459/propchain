import React from 'react'
import { StatusBadge } from './StatusBadge'
import type { RiskLevel } from '@/types/fraud'

export interface RiskIndicatorProps {
  score: number // 0-100
  level: RiskLevel
  showBar?: boolean
}

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({ score, level, showBar = true }) => {
  const getBarColor = (s: number) => {
    if (s < 30) return 'bg-emerald-500'
    if (s < 70) return 'bg-amber-500'
    return 'bg-rose-500'
  }

  return (
    <div className="flex items-center gap-2.5">
      <StatusBadge status={level} />
      {showBar && (
        <div className="flex items-center gap-1.5 min-w-[100px]">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${getBarColor(score)}`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-700 w-7 text-right">{score}</span>
        </div>
      )}
    </div>
  )
}

