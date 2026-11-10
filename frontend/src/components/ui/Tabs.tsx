import React from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: string
  count?: number
}

export interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div className={cn('border-b border-[#E8E2D5]', className)}>
      <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'whitespace-nowrap border-b-2 py-3 px-1 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-2',
                isActive
                  ? 'border-[#657565] text-[#252B28] font-semibold'
                  : 'border-transparent text-[#6B726B] hover:border-[#D4CBBC] hover:text-[#252B28]'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                    isActive ? 'bg-[#657565] text-white' : 'bg-[#EAE4D9] text-[#252B28]'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
