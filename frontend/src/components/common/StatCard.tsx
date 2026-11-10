import React from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: string
    isPositive: boolean
  }
  icon?: React.ReactNode
  iconBg?: string
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  iconBg = 'bg-[#FAF8F3] text-[#657565]',
  className,
}) => {
  return (
    <Card className={cn('h-full overflow-hidden border border-[#E8E2D5] bg-white group hover:border-[#B49A70]/70 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(37,43,40,0.06)] transition-all duration-200 cursor-default flex flex-col justify-between', className)}>
      <CardContent className="p-4 sm:p-4.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wider text-[#6B726B] uppercase truncate">{title}</p>
            {icon && (
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105', iconBg)}>
                {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: cn('h-4 w-4', (icon.props as any)?.className) }) : icon}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#252B28] font-sans truncate">{value}</p>
            {trend && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                  trend.isPositive ? 'bg-[#657565]/15 text-[#3F4B3F]' : 'bg-rose-50 text-rose-700'
                )}
              >
                {trend.isPositive ? '↑' : '↓'} {trend.value}
              </span>
            )}
          </div>
        </div>
        {subtitle && <p className="mt-1.5 text-[11px] text-[#6B726B] font-normal leading-normal line-clamp-1 truncate">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
