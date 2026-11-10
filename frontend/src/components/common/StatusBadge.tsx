import React from 'react'
import { Badge, type BadgeProps } from '@/components/ui/Badge'
import type { VerificationStatus } from '@/types/property'
import type { TransactionStatus } from '@/types/transaction'
import type { RiskLevel } from '@/types/fraud'
import type { ApprovalStatus } from '@/types/approval'

interface StatusBadgeProps {
  status: VerificationStatus | TransactionStatus | RiskLevel | ApprovalStatus | string
  label?: string
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label: customLabel, className }) => {
  let variant: BadgeProps['variant'] = 'neutral'
  let label = customLabel || status

  const effectiveText = (customLabel || status || '').toString().trim()
  const lowerText = effectiveText.toLowerCase()

  if (customLabel) {
    if (
      lowerText.includes('verified') ||
      lowerText.includes('ready to verify') ||
      lowerText.includes('registered on-chain') ||
      lowerText.includes('completed') ||
      lowerText.includes('approved')
    ) {
      variant = 'success'
    } else if (
      lowerText.includes('in review') ||
      lowerText.includes('under review') ||
      lowerText.includes('documents approved') ||
      lowerText.includes('submitted')
    ) {
      variant = 'warning'
    } else if (
      lowerText.includes('correction') ||
      lowerText.includes('needs correction')
    ) {
      variant = 'champagne'
    } else if (
      lowerText.includes('rejected') ||
      lowerText.includes('cancelled') ||
      lowerText.includes('failed')
    ) {
      variant = 'danger'
    } else if (lowerText.includes('draft') || lowerText.includes('pending')) {
      variant = 'neutral'
    }
  } else {
    switch (status) {
      // Transaction lifecycle
      case 'PENDING_SELLER_ACCEPTANCE':
        variant = 'warning'
        label = 'Pending Seller Acceptance'
        break
      case 'PENDING_DOCUMENT_VERIFICATION':
        variant = 'warning'
        label = 'Seller Accepted'
        break
      case 'DOCUMENTS_VERIFIED':
        variant = 'success'
        label = 'Documents Verified'
        break
      case 'ESCROW_FUNDED':
        variant = 'champagne'
        label = 'Escrow Funded'
        break
      case 'ESCROW_DEPOSITED':
        variant = 'champagne'
        label = 'Escrow Deposited'
        break
      case 'LEGAL_CONFIRMATION_PENDING':
        variant = 'warning'
        label = 'Legal Approval Pending'
        break
      case 'OWNERSHIP_TRANSFERRED':
        variant = 'success'
        label = 'Ownership Transferred'
        break
      case 'CONVEYANCE_FAILED':
        variant = 'danger'
        label = 'Conveyance Failed'
        break
      case 'COMPLETED':
        variant = 'success'
        label = 'Completed'
        break
      case 'REJECTED':
        variant = 'danger'
        label = 'Rejected'
        break
      case 'CANCELLED':
        variant = 'danger'
        label = 'Cancelled'
        break

      // Property Verification Lifecycle
      case 'UNVERIFIED':
        variant = 'neutral'
        label = 'Unverified'
        break
      case 'PENDING_REVIEW':
        variant = 'warning'
        label = 'In Review'
        break
      case 'VERIFIED':
        variant = 'success'
        label = 'Verified On-Chain'
        break
      case 'REJECTED_VERIFICATION':
        variant = 'danger'
        label = 'Verification Rejected'
        break

      // Property Status
      case 'ACTIVE':
        variant = 'success'
        label = 'Active Listing'
        break
      case 'PENDING':
        variant = 'warning'
        label = 'Under Contract'
        break
      case 'SOLD':
        variant = 'neutral'
        label = 'Deed Transferred'
        break

      // Risk Levels
      case 'LOW':
        variant = 'success'
        label = 'Low Risk'
        break
      case 'MEDIUM':
        variant = 'warning'
        label = 'Medium Risk'
        break
      case 'HIGH':
      case 'CRITICAL':
        variant = 'danger'
        label = `${status} Risk`
        break

      // Approvals
      case 'APPROVED':
        variant = 'success'
        label = 'Approved'
        break
      case 'NEEDS_CORRECTION':
        variant = 'champagne'
        label = 'Needs Correction'
        break

      default:
        variant = 'neutral'
        label = status?.toString() || 'Unknown'
    }
  }

  return (
    <Badge variant={variant} dot size="sm" className={className}>
      {label}
    </Badge>
  )
}
