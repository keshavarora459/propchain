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

/**
 * Return a user-friendly label for roles.
 * PROPERTY_OWNER -> "Seller", BUYER -> "Buyer", VERIFIER -> "Verifier",
 * LEGAL_AUTHORITY -> "Legal Authority", ADMIN -> "Admin".
 */
export function getRoleLabel(role?: string | null): string {
  if (!role) return ''
  const normalized = role.toUpperCase().trim()
  switch (normalized) {
    case 'PROPERTY_OWNER':
    case 'SELLER':
      return 'Seller'
    case 'BUYER':
      return 'Buyer'
    case 'VERIFIER':
      return 'Verifier'
    case 'LEGAL_AUTHORITY':
      return 'Legal Authority'
    case 'ADMIN':
      return 'Admin'
    default:
      return role
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
  }
}

/**
 * Return role-based verification status labels for properties.
 *
 * - SUBMITTED with < 4 approved:
 *     seller sees "Under review (x of 4 approved)"
 *     verifier sees "In review (x of 4 approved)"
 * - SUBMITTED with 4 of 4 approved:
 *     seller sees "Documents approved, final check pending"
 *     verifier sees "Ready to verify"
 * - VERIFIED: "Verified"
 * - CORRECTION_REQUESTED / REQUIRES_CORRECTION: "Needs correction"
 * - REJECTED: "Rejected"
 * - PENDING / DRAFT: "Draft"
 * - Never show "Waiting for verifier" to a verifier.
 */
export function getVerificationLabel(
  property?: any,
  viewerRole?: string | null,
  approvedDocsCount?: number,
  requiredCount: number = 4
): string {
  if (!property && approvedDocsCount === undefined) return ''

  const rawStatus = (
    typeof property === 'string'
      ? property
      : property?.verification_status ||
        property?.verificationStatus ||
        property?.status ||
        ''
  )
    .toString()
    .toUpperCase()
    .trim()

  const normalizedRole = (viewerRole || '').toUpperCase().trim()
  const isVerifier = normalizedRole === 'VERIFIER'

  const approved =
    approvedDocsCount !== undefined
      ? approvedDocsCount
      : Number(property?.approved_documents_count ?? property?.approvedDocsCount ?? 0)

  const required =
    property?.required_documents_count ?? property?.requiredCount ?? requiredCount ?? 4

  // Verified / On-chain
  if (
    rawStatus === 'VERIFIED' ||
    rawStatus === 'BLOCKCHAIN_REGISTERED' ||
    rawStatus === 'REGISTERED ON-CHAIN'
  ) {
    return 'Verified'
  }

  // Needs correction
  if (
    rawStatus === 'CORRECTION_REQUESTED' ||
    rawStatus === 'REQUIRES_CORRECTION' ||
    rawStatus === 'NEEDS CORRECTION' ||
    rawStatus === 'NEEDS_CORRECTION'
  ) {
    return 'Needs correction'
  }

  // Rejected
  if (rawStatus === 'REJECTED') {
    return 'Rejected'
  }

  // Pending / Draft
  if (
    rawStatus === 'PENDING' ||
    rawStatus === 'DRAFT' ||
    rawStatus === 'PENDING_DOCUMENTS'
  ) {
    return 'Draft'
  }

  // Submitted / In review states (handles SUBMITTED, WAITING FOR VERIFIER, UNDER_REVIEW, etc.)
  if (
    rawStatus === 'SUBMITTED' ||
    rawStatus === 'SUBMITTED_FOR_REVIEW' ||
    rawStatus === 'WAITING FOR VERIFIER' ||
    rawStatus === 'WAITING_FOR_VERIFIER' ||
    rawStatus === 'UNDER_REVIEW' ||
    rawStatus === 'UNDER REVIEW' ||
    rawStatus === 'IN_REVIEW' ||
    rawStatus === 'IN REVIEW'
  ) {
    if (approved >= required) {
      return isVerifier ? 'Ready to verify' : 'Documents approved, final check pending'
    } else {
      return isVerifier
        ? `In review (${approved} of ${required} approved)`
        : `Under review (${approved} of ${required} approved)`
    }
  }

  // If status string already starts with Under review or In review:
  if (rawStatus.startsWith('UNDER REVIEW')) {
    return isVerifier ? rawStatus.replace('UNDER REVIEW', 'In review') : rawStatus
  }
  if (rawStatus.startsWith('IN REVIEW')) {
    return isVerifier ? rawStatus : rawStatus.replace('IN REVIEW', 'Under review')
  }

  return rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase() : 'Draft'
}

/**
 * Detects if a document's filename or title contradicts its classified document type.
 * e.g., A file named "Tax Clearance" classified as "Encumbrance Certificate".
 */
export function checkDocumentTypeMismatch(
  fileName?: string | null,
  documentType?: string | null
): boolean {
  if (!fileName || !documentType) return false

  const name = fileName.toLowerCase().replace(/[^a-z0-9]/g, ' ')
  const type = documentType.toLowerCase().replace(/[^a-z0-9]/g, ' ')

  // Check if filename indicates a specific document category
  const isNameTax = /\btax\b|\breceipt\b|\bclearance\b/.test(name)
  const isNameEncumbrance = /\bencumbrance\b|\bec\b|\blien\b/.test(name)
  const isNameSurvey = /\bsurvey\b|\bcadastral\b|\bplan\b|\bplat\b/.test(name)
  const isNameDeed = /\bdeed\b|\btitle\b|\bsale\b|\bconveyance\b/.test(name)

  // Check classified document type
  const isTypeTax = /\btax\b/.test(type)
  const isTypeEncumbrance = /\bencumbrance\b|\bec\b/.test(type)
  const isTypeSurvey = /\bsurvey\b|\bcadastral\b/.test(type)
  const isTypeDeed = /\btitle\b|\bdeed\b|\bsale\b/.test(type)

  // Flag mismatch if filename strongly indicates one type but classified as another
  if (isNameTax && !isTypeTax && (isTypeEncumbrance || isTypeSurvey || isTypeDeed)) return true
  if (isNameEncumbrance && !isTypeEncumbrance && (isTypeTax || isTypeSurvey || isTypeDeed)) return true
  if (isNameSurvey && !isTypeSurvey && (isTypeTax || isTypeEncumbrance || isTypeDeed)) return true
  if (isNameDeed && !isTypeDeed && (isTypeTax || isTypeEncumbrance || isTypeSurvey)) return true

  return false
}


/**
 * Canonical 6-stage lifecycle for real estate conveyance deals:
 * Offer made -> Seller accepted -> Verifier approved deal documents -> Legal registration approved -> Ownership transferred on blockchain -> Completed
 */
export const TRANSACTION_LIFECYCLE_STEPS = [
  { step: 1, label: 'Offer made', description: 'Buyer submitted purchase proposal' },
  { step: 2, label: 'Seller accepted', description: 'Seller accepted terms of conveyance' },
  { step: 3, label: 'Verifier approved deal documents', description: 'Certified verifier reviewed deal documents' },
  { step: 4, label: 'Legal registration approved', description: 'Statutory land registry deed entered' },
  { step: 5, label: 'Ownership transferred on blockchain', description: 'Smart contract recorded on EVM ledger' },
  { step: 6, label: 'Completed', description: 'Conveyance settled and title re-assigned' },
] as const

export interface LifecycleStepState {
  number: number
  label: string
  description: string
  state: 'completed' | 'current' | 'upcoming' | 'error'
}

export function getTransactionLifecycleProgress(
  rawStatus?: string | null,
  blockchainError?: string | null
): {
  currentStepIndex: number
  currentStepLabel: string
  isCompleted: boolean
  isCancelledOrRejected: boolean
  hasBlockchainError: boolean
  steps: LifecycleStepState[]
} {
  const status = (rawStatus || '').toUpperCase().trim()
  const isCancelledOrRejected = status === 'CANCELLED' || status === 'REJECTED'
  const isCompleted = status === 'COMPLETED'
  const hasBlockchainError = Boolean(blockchainError && blockchainError.trim().length > 0)

  // 0-indexed:
  // 0 = Offer made (PENDING_SELLER_ACCEPTANCE / INITIATED)
  // 1 = Seller accepted (PENDING_DOCUMENT_VERIFICATION / SELLER_ACCEPTED)
  // 2 = Verifier approved deal documents (READY_FOR_LEGAL_CONFIRMATION / DOCUMENTS_VERIFIED / PENDING_LEGAL_CONFIRMATION)
  // 3 = Legal registration approved (LEGALLY_REGISTERED)
  // 4 = Ownership transferred on blockchain (recorded on EVM)
  // 5 = Completed
  let activeIndex = 0

  if (isCompleted) {
    activeIndex = 5
  } else if (status === 'LEGALLY_REGISTERED') {
    // Legal registration approved; if blockchain error occurred or awaiting retry, step 5 is active/errored
    activeIndex = 4
  } else if (
    status === 'READY_FOR_LEGAL_CONFIRMATION' ||
    status === 'DOCUMENTS_VERIFIED' ||
    status === 'PENDING_LEGAL_CONFIRMATION'
  ) {
    activeIndex = 3 // Awaiting Legal registration
  } else if (
    status === 'PENDING_DOCUMENT_VERIFICATION' ||
    status === 'SELLER_ACCEPTED' ||
    status === 'DOCUMENT_VERIFICATION'
  ) {
    activeIndex = 2 // Awaiting Verifier approval
  } else if (
    status === 'PENDING_SELLER_ACCEPTANCE' ||
    status === 'INITIATED' ||
    status === 'OFFER_MADE'
  ) {
    activeIndex = 1 // Awaiting Seller acceptance
  }

  const steps: LifecycleStepState[] = TRANSACTION_LIFECYCLE_STEPS.map((s, idx) => {
    let state: 'completed' | 'current' | 'upcoming' | 'error' = 'upcoming'

    if (isCompleted) {
      state = 'completed'
    } else if (isCancelledOrRejected) {
      state = idx <= activeIndex ? 'error' : 'upcoming'
    } else if (idx < activeIndex) {
      state = 'completed'
    } else if (idx === activeIndex) {
      if (status === 'LEGALLY_REGISTERED' && hasBlockchainError) {
        state = 'error'
      } else {
        state = 'current'
      }
    } else {
      state = 'upcoming'
    }

    return {
      number: s.step,
      label: s.label,
      description: s.description,
      state,
    }
  })

  const currentStepLabel = TRANSACTION_LIFECYCLE_STEPS[activeIndex]?.label || 'In Progress'

  return {
    currentStepIndex: activeIndex,
    currentStepLabel,
    isCompleted,
    isCancelledOrRejected,
    hasBlockchainError,
    steps,
  }
}
