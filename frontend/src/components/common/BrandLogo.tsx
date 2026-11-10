import React, { useId } from 'react'
import { cn } from '@/lib/utils'

export interface PropChainMarkProps {
  className?: string
  variant?: 'sage' | 'dark'
  size?: number
}

/**
 * Bespoke architectural crest + blockchain hexagon mark for PropChain.
 */
export const PropChainMark: React.FC<PropChainMarkProps> = ({
  className,
  variant = 'sage',
  size = 40,
}) => {
  const uid = useId().replace(/:/g, '')
  const bgId = `pc-bg-${uid}`
  const goldId = `pc-gold-${uid}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={cn('shrink-0 drop-shadow-xs', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={variant === 'sage' ? '#6D7E6D' : '#2C332F'} />
          <stop offset="100%" stopColor={variant === 'sage' ? '#414D41' : '#191D1B'} />
        </linearGradient>
        <linearGradient id={goldId} x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DEC89E" />
          <stop offset="100%" stopColor="#B49A70" />
        </linearGradient>
      </defs>

      {/* Outer rounded architectural seal */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        fill={`url(#${bgId})`}
        stroke={`url(#${goldId})`}
        strokeWidth="1.75"
      />

      {/* Blockchain hexagon perimeter */}
      <polygon
        points="32,10 50.5,20.8 50.5,43.2 32,54 13.5,43.2 13.5,20.8"
        stroke={`url(#${goldId})`}
        strokeWidth="2.1"
        strokeLinejoin="round"
        fill="#1B201E"
        fillOpacity="0.28"
      />

      {/* Translucent architectural body fill */}
      <path d="M21 31 L32 20 L43 31 V43 H21 V31 Z" fill="#FAF8F3" fillOpacity="0.16" />

      {/* Crisp gable roofline */}
      <path
        d="M19 31.5 L32 19 L45 31.5"
        stroke="#FAF8F3"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Estate pillars & vaulted entrance portal */}
      <path
        d="M23.5 29.5 V43 M40.5 29.5 V43 M29.5 43 V34.5 H34.5 V43"
        stroke="#FAF8F3"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Champagne gold keystone diamond */}
      <polygon points="32,24.4 34.8,27.2 32,30 29.2,27.2" fill={`url(#${goldId})`} />

      {/* Ledger foundation line + anchored hex nodes */}
      <line x1="18" y1="43" x2="46" y2="43" stroke="#FAF8F3" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="17.5" cy="43" r="2.2" fill={`url(#${goldId})`} />
      <circle cx="46.5" cy="43" r="2.2" fill={`url(#${goldId})`} />
    </svg>
  )
}

export interface BrandLogoProps {
  className?: string
  markClassName?: string
  theme?: 'dark' | 'light'
  markVariant?: 'sage' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  tagline?: string
}

const SIZE_MAP = {
  sm: { icon: 34, title: 'text-sm tracking-wider', sub: 'text-[9px] tracking-[0.18em]' },
  md: { icon: 40, title: 'text-sm tracking-[0.16em]', sub: 'text-[9px] tracking-[0.2em]' },
  lg: { icon: 44, title: 'text-base tracking-[0.2em]', sub: 'text-[10px] tracking-[0.24em]' },
} as const

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className,
  markClassName,
  theme = 'dark',
  markVariant = 'sage',
  size = 'md',
  showTagline = true,
  tagline = 'LUXURY REAL ESTATE',
}) => {
  const cfg = SIZE_MAP[size]

  return (
    <div className={cn('inline-flex items-center gap-3 select-none', className)}>
      <PropChainMark variant={markVariant} size={cfg.icon} className={markClassName} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-bold uppercase font-sans leading-tight truncate',
              cfg.title,
              theme === 'dark' ? 'text-white' : 'text-[#252B28]'
            )}
          >
            PROPCHAIN
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#B49A70] shrink-0" />
        </div>
        {showTagline && (
          <span
            className={cn(
              'block uppercase font-semibold leading-tight mt-0.5 truncate',
              cfg.sub,
              theme === 'dark' ? 'text-[#B49A70]' : 'text-[#6B726B]'
            )}
          >
            {tagline}
          </span>
        )}
      </div>
    </div>
  )
}

export default BrandLogo

