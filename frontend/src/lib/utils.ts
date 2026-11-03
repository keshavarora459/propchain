import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines conditional classes and cleanly merges Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Format currency in USD.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Truncate long Ethereum or cryptographic hash strings.
 */
export function truncateHash(hash: string, startLength = 6, endLength = 4): string {
  if (!hash || hash.length <= startLength + endLength) return hash
  return `${hash.slice(0, startLength)}...${hash.slice(-endLength)}`
}

/**
 * Format standard ISO dates.
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/**
 * Return a simple, human-readable label for a property: "<Title> – <City>"
 * If there is no city, returns only the title.
 */
export function getPropertyLabel(property?: {
  title?: string | null
  property_title?: string | null
  propertyTitle?: string | null
  name?: string | null
  city?: string | null
  property_number?: string | null
  propertyNumber?: string | null
  propertyId?: string | null
  id?: string | null
} | string | null): string {
  if (!property) return ''
  if (typeof property === 'string') {
    const cleaned = property.replace(/^PROP-[\w-]+(?:\s*[-–:]\s*|\s+)/i, '').trim()
    return cleaned || property
  }
  const rawTitle = property.title || property.property_title || property.propertyTitle || property.name
  let cleanTitle = rawTitle ? rawTitle.replace(/^PROP-[\w-]+(?:\s*[-–:]\s*|\s+)/i, '').trim() : ''
  if (!cleanTitle) {
    cleanTitle = rawTitle || property.property_number || property.propertyNumber || property.propertyId || 'Property'
  }
  const city = property.city?.trim()
  if (city) {
    return `${cleanTitle} – ${city}`
  }
  return cleanTitle
}


