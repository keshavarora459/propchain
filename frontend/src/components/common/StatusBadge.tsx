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
    // Transaction lifecycle
    case 'PENDING_SELLER_ACCEPTANCE':
      variant = 'warning'
      label = 'Pending Seller Acceptance'
      break
    case 'PENDING_DOCUMENT_VERIFICATION':
      variant = 'info'
      label = 'Seller Accepted'
      break
    case 'PENDING_LEGAL_REGISTRATION':
      variant = 'info'
      label = 'Pending Legal Registration'
      break
    case 'PENDING_ESCROW_DEPOSIT':
      variant = 'warning'
      label = 'Awaiting Escrow Deposit'
      break
    case 'COMPLETED':
      variant = 'success'
      label = 'Completed'
      break
    case 'REJECTED':
    case 'Rejected':
      variant = 'danger'
      label = 'Rejected'
      break
    case 'CANCELLED':
      variant = 'danger'
      label = 'Cancelled'
      break

    // Verification & Approval
    case 'SUBMITTED':
    case 'Submitted':
    case 'Waiting for verifier':
      variant = 'info'
      label = 'Waiting for verifier'
      break

    case 'SUBMITTED_FOR_REVIEW':
      variant = 'info'
      label = 'Submitted for review'
      break

    case 'CORRECTION_REQUESTED':
    case 'REQUIRES_CORRECTION':
    case 'Correction Requested':
    case 'Needs correction':
      variant = 'warning'
      label = 'Needs correction'
      break

    case 'VERIFIED':
    case 'Verified':
    case 'Approved':
    case 'Completed':
    case 'Resolved':
      variant = 'success'
      label = status === 'VERIFIED' ? 'Verified' : status
      break

    case 'Replaced':
      variant = 'neutral'
      label = 'Replaced'
      break

    case 'Recorded on blockchain':
    case 'BLOCKCHAIN_REGISTERED':
    case 'Registered On-Chain':
      variant = 'success'
      label = 'Registered On-Chain'
      break

    case 'BLOCKCHAIN_PENDING':
    case 'Blockchain Pending':
      variant = 'warning'
      label = 'Blockchain Pending'
      break

    case 'BLOCKCHAIN_FAILED':
    case 'Blockchain Failed':
      variant = 'danger'
      label = 'Blockchain Failed'
      break

    case 'Not yet recorded':
      variant = 'neutral'
      label = 'Not yet recorded'
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
