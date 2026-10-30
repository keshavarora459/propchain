import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Maximize2, ShieldCheck, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { StatusBadge } from './StatusBadge'
import { formatCurrency } from '@/lib/utils'
import type { Property } from '@/types/property'

export interface PropertyCardProps {
  property: Property
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  return (
    <Card className="hover:shadow-md transition-all group overflow-hidden border-slate-200">
      <div className="h-40 bg-slate-900 relative p-4 flex flex-col justify-between overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-mono font-semibold tracking-wider bg-white/10 text-white px-2 py-0.5 rounded backdrop-blur-xs">
            {property.propertyId}
          </span>
          <StatusBadge status={property.verificationStatus} />
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
            {property.title}
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

        <div className="pt-2">
          <Link
            to={`/properties/${property.id}`}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
          >
            <span>View Title & Ledger</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

