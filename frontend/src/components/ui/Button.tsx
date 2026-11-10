import React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:translate-y-px hover:shadow-xs'

    const variantStyles = {
      primary: 'bg-[#657565] text-white hover:bg-[#526152] hover:shadow-[0_2px_8px_rgba(101,117,101,0.25)] focus:ring-[#657565]',
      secondary: 'bg-[#EAE4D9] text-[#252B28] hover:bg-[#dfd7c9] hover:border-[#D4CBBC] focus:ring-[#B49A70]',
      outline: 'border border-[#D4CBBC] text-[#252B28] bg-white/90 hover:bg-[#FAF8F3] hover:border-[#657565] hover:text-[#252B28] focus:ring-[#657565]',
      ghost: 'text-[#252B28] hover:bg-[#EAE4D9]/60 hover:text-[#252B28] focus:ring-[#657565]',
      danger: 'bg-rose-700 text-white hover:bg-rose-800 hover:shadow-[0_2px_8px_rgba(190,18,60,0.25)] focus:ring-rose-500',
    }

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 tracking-wide',
      md: 'px-4 py-2 text-sm gap-2 tracking-wide',
      lg: 'px-6 py-2.5 text-base gap-2.5 tracking-wide',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
