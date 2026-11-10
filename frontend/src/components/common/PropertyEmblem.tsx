import React from 'react'
import { cn } from '@/lib/utils'

export interface PropertyEmblemProps {
  propertyType?: string | null
  isTokenized?: boolean
  size?: number
  className?: string
}

/**
 * Architectural crest rendered for individual property cards & asset detail banners.
 * Distinguishes Commercial, Residential, Industrial, and Land parcels with an optional
 * orbital fractional-token halo for tokenized properties.
 */
export const PropertyEmblem: React.FC<PropertyEmblemProps> = ({
  propertyType,
  isTokenized = false,
  size = 56,
  className,
}) => {
  const kind = (propertyType || '').toUpperCase().trim()
  const isCommercial = kind.includes('COMM') || kind.includes('OFFICE') || kind.includes('RETAIL')
  const isIndustrial = kind.includes('INDUS') || kind.includes('WAREHOUSE')
  const isLand = kind.includes('LAND') || kind.includes('AGRI') || kind.includes('PLOT')

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      {/* Subtle outer fractional ring if tokenized; clean architectural frame otherwise */}
      {isTokenized ? (
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="#C084FC"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
      ) : (
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="#94A3B8"
          strokeOpacity="0.28"
          strokeWidth="1.25"
        />
      )}

      {/* Inner badge disc */}
      <circle cx="32" cy="32" r="23" fill="#0F172A" fillOpacity="0.65" stroke="#B49A70" strokeOpacity="0.45" strokeWidth="1.2" />

      {isCommercial ? (
        /* High-rise commercial towers silhouette */
        <g stroke="#FAF8F3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 44 V23 L29 19 V44" fill="#FAF8F3" fillOpacity="0.12" />
          <path d="M29 44 V16 L39 20 V44" fill="#B49A70" fillOpacity="0.2" />
          <path d="M39 44 V27 L45 29 V44" />
          <line x1="17" y1="44" x2="47" y2="44" stroke="#B49A70" strokeWidth="1.8" />
          <line x1="24" y1="26" x2="24" y2="39" strokeOpacity="0.7" />
          <line x1="34" y1="22" x2="34" y2="39" stroke="#B49A70" />
        </g>
      ) : isIndustrial ? (
        /* Sawtooth industrial logistics vault silhouette */
        <g stroke="#FAF8F3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M18 44 V29 L27 24 V29 L36 24 V29 L46 24 V44 Z"
            fill="#FAF8F3"
            fillOpacity="0.12"
          />
          <rect x="27" y="34" width="10" height="10" stroke="#B49A70" />
          <line x1="16" y1="44" x2="48" y2="44" stroke="#B49A70" strokeWidth="1.8" />
        </g>
      ) : isLand ? (
        /* Surveyed cadastral parcel corners + terrain contour */
        <g stroke="#FAF8F3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <polygon
            points="21,23 41,20 45,40 19,43"
            fill="#FAF8F3"
            fillOpacity="0.1"
          />
          <path d="M21 34 Q29 29 35 33 T43 31" stroke="#B49A70" />
          <circle cx="21" cy="23" r="1.8" fill="#B49A70" stroke="none" />
          <circle cx="41" cy="20" r="1.8" fill="#B49A70" stroke="none" />
          <circle cx="45" cy="40" r="1.8" fill="#B49A70" stroke="none" />
          <circle cx="19" cy="43" r="1.8" fill="#B49A70" stroke="none" />
        </g>
      ) : (
        /* Luxury residential pitched manor crest */
        <g stroke="#FAF8F3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 32 L32 20 L46 32" strokeWidth="2" />
          <path d="M22 29 V43 H42 V29" fill="#FAF8F3" fillOpacity="0.12" />
          <path d="M29 43 V35 H35 V43" stroke="#B49A70" />
          <polygon points="32,24.8 34,26.8 32,28.8 30,26.8" fill="#B49A70" stroke="none" />
          <line x1="17" y1="43" x2="47" y2="43" stroke="#B49A70" strokeWidth="1.8" />
        </g>
      )}
    </svg>
  )
}

export default PropertyEmblem

