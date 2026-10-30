import React from 'react'
import { Badge, type BadgeProps } from '@/components/ui/Badge'
import type { VerificationStatus } from '@/types/property'
import type { TransactionStatus } from '@/types/transaction'
import type { RiskLevel } from '@/types/fraud'
import type { ApprovalStatus } from '@/types/approval'

interface StatusBadgeProps {
  status: VerificationStatus | TransactionStatus | RiskLevel | ApprovalStatus | string
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  let variant: BadgeProps['variant'] = 'neutral'
  let label = status

  switch (status) {
    // Verification & Approval
    case 'Verified':
    case 'Approved':
    case 'Completed':
    case 'Resolved':
      variant = 'success'
      break

    case 'Pending':
    case 'In Review':
    case 'In Escrow':
    case 'OCR Processed':
    case 'Open':
      variant = 'warning'
      break

    case 'Flagged':
    case 'Rejected':
    case 'Disputed':
    case 'Tamper Suspect':
    case 'Cancelled':
      variant = 'danger'
      break

    case 'Under Investigation':
      variant = 'info'
      break

    // Risk Levels
    case 'Low':
      variant = 'success'
      label = 'Low Risk'
      break
    case 'Medium':
      variant = 'warning'
      label = 'Medium Risk'
      break
    case 'High':
    case 'Critical':
      variant = 'danger'
      label = `${status} Risk`
      break

    default:
      variant = 'neutral'
  }

  return (
    <Badge variant={variant} dot className={className}>
      {label}
    </Badge>
  )
}

