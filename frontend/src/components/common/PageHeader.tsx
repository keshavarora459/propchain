import React from 'react'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'

export interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
}) => {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-[#E8E2D5]">
      <div>
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-[#252B28] leading-snug">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-[#6B726B] font-normal mt-1 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 mt-2 sm:mt-0 shrink-0">{actions}</div>}
    </div>
  )
}
