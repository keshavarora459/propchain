import React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline' | 'champagne'
  size?: 'sm' | 'md'
  dot?: boolean
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full tracking-wide'

  const variantStyles = {
    success: 'bg-[#657565]/15 text-[#3F4B3F] border border-[#657565]/30',
    warning: 'bg-[#B49A70]/15 text-[#8F764F] border border-[#B49A70]/30',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200',
    info: 'bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]',
    champagne: 'bg-[#B49A70]/20 text-[#8F764F] border border-[#B49A70]/40',
    neutral: 'bg-[#F4F1EA] text-[#252B28] border border-[#EAE4D9]',
    outline: 'border border-[#D4CBBC] text-[#6B726B] bg-transparent',
  }

  const dotColors = {
    success: 'bg-[#657565]',
    warning: 'bg-[#B49A70]',
    danger: 'bg-rose-600',
    info: 'bg-[#252B28]',
    champagne: 'bg-[#B49A70]',
    neutral: 'bg-[#6B726B]',
    outline: 'bg-[#B49A70]',
  }

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-0.5 text-xs gap-1.5',
  }

  return (
    <span className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)} {...props}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  )
}
