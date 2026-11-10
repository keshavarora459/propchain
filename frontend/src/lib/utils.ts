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
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0
  const hasCents = safe !== 0 && !Number.isInteger(safe) && Math.abs(safe) < 10000
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(safe)
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
    case 'REGISTRAR':
    case 'VERIFIER':
      return 'Registrar'
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
  const isVerifier = normalizedRole === 'REGISTRAR' || normalizedRole === 'VERIFIER'

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
    rawStatus === 'WAITING FOR REGISTRAR' ||
    rawStatus === 'WAITING_FOR_REGISTRAR' ||
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

export interface PropertyTokenomics {
  isTokenized: boolean
  tokenSymbol: string
  totalTokens: number
  tokenPrice: number
  minTokensPerBuyer: number
  projectedApy: number | null
  tokensSold: number
  tokensPending: number
  availableTokens: number
  cleanDescription: string
}

export function stripPropertySaleTags(description?: string | null): string {
  if (!description) return ''
  return description
    .replace(
      /^\[TOKENIZED SALE\][^|]*(?:\|\s*(?:Symbol|Total\s+Supply|Token\s+Price|Min(?:imum)?\s+Purchase|Projected\s+APY):[^|]*)*\|\s*/i,
      ''
    )
    .replace(/^\[TOKENIZED SALE\]\s*/i, '')
    .replace(/^\[ENTIRE PROPERTY SALE\]\s*/i, '')
    .trim()
}

export function getPropertyTokenomics(property?: any): PropertyTokenomics {
  const desc = String(property?.description || '')
  const cat = String(property?.property_category || '').toUpperCase().trim()
  const isTokenized = Boolean(
    property?.is_tokenized === true ||
    cat === 'TOKENIZED' ||
    /\[TOKENIZED/i.test(desc)
  )

  const valuation = Number(property?.valuation || 0) || 0

  if (!isTokenized) {
    return {
      isTokenized: false,
      tokenSymbol: '',
      totalTokens: 0,
      tokenPrice: valuation,
      minTokensPerBuyer: 1,
      projectedApy: null,
      tokensSold: 0,
      tokensPending: 0,
      availableTokens: 0,
      cleanDescription: stripPropertySaleTags(desc),
    }
  }

  const symM = desc.match(/Symbol:\s*([A-Za-z0-9_-]+)/i)
  const supM = desc.match(/Total\s+Supply:\s*([\d,]+)/i)
  const prcM = desc.match(/Token\s+Price:\s*\$?([\d,]+(?:\.\d+)?)/i)
  const minM = desc.match(/Min(?:imum)?\s+Purchase:\s*([\d,]+)/i)
  const apyM = desc.match(/Projected\s+APY:\s*([\d.]+)%?/i)

  const parsedSupply = Number(
    property?.total_tokens ?? (supM ? Number(supM[1].replace(/,/g, '')) : 1000)
  )
  const totalTokens = parsedSupply > 0 ? Math.floor(parsedSupply) : 1000

  const parsedPrice = Number(
    property?.token_price ??
    (prcM
      ? Number(prcM[1].replace(/,/g, ''))
      : (valuation > 0 ? Math.round((valuation / totalTokens) * 100) / 100 : 100))
  )
  const tokenPrice = parsedPrice > 0 ? parsedPrice : 100

  const parsedMin = Number(
    property?.min_tokens_per_buyer ?? (minM ? Number(minM[1].replace(/,/g, '')) : 1)
  )
  const minTokensPerBuyer = Math.min(Math.max(1, Number.isFinite(parsedMin) ? Math.floor(parsedMin) : 1), totalTokens)

  const tokensSold = Math.max(0, Number(property?.tokens_sold ?? 0) || 0)
  const tokensPending = Math.max(0, Number(property?.tokens_pending ?? 0) || 0)
  const availableTokens =
    property?.available_tokens !== undefined && property?.available_tokens !== null
      ? Math.max(0, Number(property.available_tokens))
      : Math.max(0, totalTokens - tokensSold)

  const projectedApy =
    property?.projected_apy !== undefined && property?.projected_apy !== null
      ? Number(property.projected_apy)
      : (apyM ? Number(apyM[1]) : null)

  return {
    isTokenized: true,
    tokenSymbol: String(property?.token_symbol || (symM ? symM[1] : 'PROP-TKN')).toUpperCase(),
    totalTokens,
    tokenPrice,
    minTokensPerBuyer,
    projectedApy: projectedApy !== null && Number.isFinite(projectedApy) ? projectedApy : null,
    tokensSold,
    tokensPending,
    availableTokens,
    cleanDescription: stripPropertySaleTags(desc),
  }
}

export function formatOfferAllocation(tx?: any): {
  isFractional: boolean
  badgeLabel: string
  detailLabel: string
} {
  const mode = String(tx?.purchase_mode || tx?.purchaseMode || '').toUpperCase().trim()
  const rawType = String(tx?.transaction_type || tx?.type || '').toUpperCase().trim()
  const qty = Number(tx?.token_quantity ?? tx?.tokenQuantity ?? 0)
  const pctRaw = Number(tx?.ownership_percentage ?? tx?.ownershipPercentage ?? 100)
  const pct = Number.isFinite(pctRaw) ? pctRaw : 100
  const sym = String(tx?.token_symbol || tx?.tokenSymbol || 'Tokens')
  const isFractional = mode === 'TOKEN_PURCHASE' || rawType === 'TOKEN_PURCHASE'

  if (isFractional && qty > 0) {
    const pctText = pct < 0.01 ? pct.toFixed(4) : pct.toFixed(2)
    return {
      isFractional: true,
      badgeLabel: `${qty.toLocaleString()} ${sym} (${pctText}%)`,
      detailLabel: `Fractional Tokens: ${qty.toLocaleString()} ${sym} (${pctText}% Ownership Stake)`,
    }
  }

  return {
    isFractional: false,
    badgeLabel: 'Entire Property (100%)',
    detailLabel: 'Entire Property Buyout (100% Ownership Title)',
  }
}
