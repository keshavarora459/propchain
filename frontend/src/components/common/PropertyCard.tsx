import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Maximize2, ShieldCheck, ArrowRight, FileCheck2, AlertCircle, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { StatusBadge } from './StatusBadge'
import { HashDisplay } from '@/components/common/HashDisplay'
import { formatCurrency, getPropertyLabel, getVerificationLabel } from '@/lib/utils'
import type { Property } from '@/types/property'
import { useAuth } from '@/hooks/useAuth'

export interface PropertyCardProps {
  property: Property
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const { user } = useAuth()
  const rawStatus = (property.verification_status || property.verificationStatus || '').toString().toUpperCase()
  const isVerified = rawStatus === 'VERIFIED'
  const isActive = !property.status || property.status.toString().toUpperCase() === 'ACTIVE'
  const isPending = rawStatus === 'PENDING' || !rawStatus
  const isNeedsCorrection =
    rawStatus === 'NEEDS_CORRECTION' ||
    rawStatus === 'CORRECTION_REQUESTED' ||
    rawStatus === 'REQUIRES_CORRECTION'
  const isSubmitted = rawStatus === 'SUBMITTED'

  const isOwner = Boolean(
    user?.id && (
      (property.current_owner_id && String(property.current_owner_id).toLowerCase() === String(user.id).toLowerCase()) ||
      (property.creator_user_id && String(property.creator_user_id).toLowerCase() === String(user.id).toLowerCase()) ||
      ((property as any).owner_id && String((property as any).owner_id).toLowerCase() === String(user.id).toLowerCase())
    ) || (
      user?.email && (
        (property.ownerAddress && property.ownerAddress.toLowerCase() === user.email.toLowerCase()) ||
        (property.currentOwner && property.currentOwner.toLowerCase() === user.email.toLowerCase())
      )
    )
  )

  const isSeller = user?.role === 'PROPERTY_OWNER'
  // Show Make Offer ONLY to BUYER role, and never on own property
  const canMakeOffer = user?.role === 'BUYER' && !isOwner

  return (
    <Card className="hover:shadow-md transition-all group overflow-hidden border-slate-200">
      <div className="h-40 bg-slate-900 relative p-4 flex flex-col justify-between overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded backdrop-blur-xs">
            Parcel ID: {property.propertyId}
          </span>
          <StatusBadge
            status={property.verification_status || property.verificationStatus || 'Pending'}
            label={getVerificationLabel(property, user?.role)}
          />
        </div>

        <div className="relative z-10">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
            {property.propertyType}
          </span>
          <p className="text-xl font-bold text-white tracking-tight mt-0.5">
            {formatCurrency(property.valuation)}
          </p>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {getPropertyLabel(property)}
          </h4>
          <p className="flex items-center text-xs text-slate-500 mt-1 line-clamp-1">
            <MapPin className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
            {property.address}, {property.city}, {property.state} {property.postalCode}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span className="flex items-center">
            <Maximize2 className="h-3.5 w-3.5 mr-1 text-slate-400" />
            {property.area.toLocaleString()} {property.areaUnit}
          </span>
          <span className="flex items-center text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            {property.currentOwner}
          </span>
        </div>

        {isVerified && (
          <div className="pt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Recorded on blockchain {property.blockchain_block_number ? `(Block #${property.blockchain_block_number})` : ''}</span>
            {(property.blockchain_tx_hash || property.anchor_tx_hash) && (
              <HashDisplay
                value={property.blockchain_tx_hash || property.anchor_tx_hash}
                explorerLink
                className="bg-transparent border-0 px-0 py-0 text-emerald-800"
              />
            )}
          </div>
        )}

        <div className="pt-2 flex items-center gap-2">
          {isSeller && isOwner ? (
            <>
              {isPending && (
                <>
                  <Link
                    to={`/documents?propertyId=${property.id || property.propertyId}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors shadow-xs"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    <span>Upload documents</span>
                  </Link>
                  <Link
                    to={`/properties/${property.id}`}
                    className="flex items-center justify-center py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"
                    title="View Details"
                  >
                    <span>Details</span>
                  </Link>
                </>
              )}
              {isNeedsCorrection && (
                <>
                  <Link
                    to={`/documents?propertyId=${property.id || property.propertyId}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white transition-colors shadow-xs"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Fix documents</span>
                  </Link>
                  <Link
                    to={`/properties/${property.id}`}
                    className="flex items-center justify-center py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"
                    title="View Details"
                  >
                    <span>Details</span>
                  </Link>
                </>
              )}
              {isSubmitted && (
                <>
                  <Link
                    to={`/documents?propertyId=${property.id || property.propertyId}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"
                    title={getVerificationLabel(property, user?.role)}
                  >
                    <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="truncate max-w-[130px]">{getVerificationLabel(property, user?.role)}</span>
                  </Link>
                  <Link
                    to={`/properties/${property.id}`}
                    className="flex items-center justify-center py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"
                    title="View Details"
                  >
                    <span>Details</span>
                  </Link>
                </>
              )}
              {isVerified && (
                <Link
                  to={`/properties/${property.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition-colors"
                >
                  <span>Details</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
              {!isPending && !isNeedsCorrection && !isSubmitted && !isVerified && (
                <Link
                  to={`/properties/${property.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition-colors"
                >
                  <span>Details</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to={`/properties/${property.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
              >
                <span>Details</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
              {canMakeOffer && isVerified && isActive && (
                <Link
                  to={`/transactions?propertyId=${property.id}&initiate=true`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white transition-colors shadow-xs"
                >
                  <span>Make Offer</span>
                </Link>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
