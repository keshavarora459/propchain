import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Plus,
  LayoutGrid,
  List,
  Loader2,
  Building2,
  ShoppingBag,
  Check,
  X,
  FileCheck2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { PropertyCard } from '@/components/common/PropertyCard'
import { SearchFilterBar } from '@/components/common/SearchFilterBar'
import { EmptyState } from '@/components/common/EmptyState'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { RegisterPropertyModal } from './RegisterPropertyModal'
import { PROPERTY_TYPES, VERIFICATION_STATUSES } from '@/constants/options'
import { formatCurrency, getPropertyLabel, getVerificationLabel, cn } from '@/lib/utils'
import type { Property } from '@/types/property'
import { propertyService } from '@/services/propertyService'
import { useAuth } from '@/hooks/useAuth'

export const PropertiesPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isSeller = user?.role === 'PROPERTY_OWNER'
  const isBuyer = user?.role === 'BUYER'
  const isAdmin = user?.role === 'ADMIN'

  // If seller, support 'my' vs 'marketplace' tabs
  const tabParam = searchParams.get('tab')
  const activeTab: 'my' | 'marketplace' = isSeller
    ? tabParam === 'marketplace'
      ? 'marketplace'
      : 'my'
    : 'marketplace'

  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [successBanner, setSuccessBanner] = useState<{
    message: string
    propertyId: string
    title: string
  } | null>(null)

  const itemsPerPage = 6

  const loadProperties = useCallback(async () => {
    setIsLoading(true)
    try {
      const isMyView = isSeller && activeTab === 'my'
      const res = await propertyService.getProperties({
        mine: isMyView ? true : undefined,
        page_size: 100,
      })
      if (res && res.items) {
        setProperties(res.items)
      } else {
        setProperties([])
      }
    } catch (err) {
      console.error('Could not load properties from database:', err)
      setProperties([])
    } finally {
      setIsLoading(false)
    }
  }, [isSeller, activeTab])

  useEffect(() => {
    loadProperties()
  }, [loadProperties])

  // Status summary counts for seller in "My Properties" tab
  const statusCounts = useMemo(() => {
    let pending = 0
    let waiting = 0
    let verified = 0
    let needsCorrection = 0
    for (const p of properties) {
      const s = (p.verification_status || p.verificationStatus || '').toString().toUpperCase()
      if (s === 'PENDING' || !s) {
        pending++
      } else if (s === 'SUBMITTED') {
        waiting++
      } else if (s === 'VERIFIED') {
        verified++
      } else if (
        s === 'NEEDS_CORRECTION' ||
        s === 'CORRECTION_REQUESTED' ||
        s === 'REQUIRES_CORRECTION'
      ) {
        needsCorrection++
      }
    }
    return {
      total: properties.length,
      pending,
      waiting,
      verified,
      needsCorrection,
    }
  }, [properties])

  const filteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        searchQuery === '' ||
        (prop.title && prop.title.toLowerCase().includes(q)) ||
        (prop.propertyId && prop.propertyId.toLowerCase().includes(q)) ||
        (prop.address && prop.address.toLowerCase().includes(q)) ||
        (prop.city && prop.city.toLowerCase().includes(q)) ||
        (prop.currentOwner && prop.currentOwner.toLowerCase().includes(q)) ||
        (prop.ownerAddress && prop.ownerAddress.toLowerCase().includes(q))

      const matchesType =
        typeFilter === '' ||
        (prop.propertyType && prop.propertyType.toLowerCase() === typeFilter.toLowerCase())

      const statusUpper = (prop.verification_status || prop.verificationStatus || '').toString().toUpperCase()
      const matchesStatus =
        statusFilter === '' ||
        (statusFilter.toLowerCase() === 'pending' && (statusUpper === 'PENDING' || !statusUpper)) ||
        (statusFilter.toLowerCase() === 'submitted' && statusUpper === 'SUBMITTED') ||
        (statusFilter.toLowerCase() === 'verified' && statusUpper === 'VERIFIED') ||
        (statusFilter.toLowerCase() === 'needs correction' &&
          (statusUpper === 'NEEDS_CORRECTION' ||
            statusUpper === 'CORRECTION_REQUESTED' ||
            statusUpper === 'REQUIRES_CORRECTION')) ||
        (prop.verificationStatus && prop.verificationStatus.toLowerCase() === statusFilter.toLowerCase())

      return matchesSearch && matchesType && matchesStatus
    })
  }, [properties, searchQuery, typeFilter, statusFilter])

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProperties.slice(start, start + itemsPerPage)
  }, [filteredProperties, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredProperties.length / itemsPerPage))

  const handleRegisterSuccess = (newProperty: Property) => {
    setIsModalOpen(false)
    const targetId = newProperty.propertyId || newProperty.id
    setProperties((prev) => [
      {
        ...newProperty,
        verificationStatus: 'Pending',
        verification_status: 'PENDING',
      },
      ...prev.filter(
        (p) => p.id !== newProperty.id && p.propertyId !== newProperty.propertyId
      ),
    ])
    setSuccessBanner({
      message: 'Property registered. Next: upload your 4 documents.',
      propertyId: targetId,
      title: getPropertyLabel(newProperty),
    })
    if (targetId) {
      navigate(`/documents?propertyId=${targetId}`)
    }
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setTypeFilter('')
    setStatusFilter('')
    setCurrentPage(1)
  }

  const isPropOwner = (prop: Property) => {
    return Boolean(
      (user?.id && (
        (prop.current_owner_id && String(prop.current_owner_id).toLowerCase() === String(user.id).toLowerCase()) ||
        (prop.creator_user_id && String(prop.creator_user_id).toLowerCase() === String(user.id).toLowerCase()) ||
        ((prop as any).owner_id && String((prop as any).owner_id).toLowerCase() === String(user.id).toLowerCase())
      )) ||
      (user?.email && (
        (prop.ownerAddress && prop.ownerAddress.toLowerCase() === user.email.toLowerCase()) ||
        (prop.currentOwner && prop.currentOwner.toLowerCase() === user.email.toLowerCase())
      ))
    )
  }

  // Dynamic Page Title & Subtitle
  const pageTitle = isSeller
    ? activeTab === 'my'
      ? 'My Properties'
      : 'Real Estate Marketplace'
    : isBuyer
    ? 'Real Estate Marketplace'
    : 'Real Estate Registry'

  const pageDescription = isSeller
    ? activeTab === 'my'
      ? 'Properties you have listed'
      : 'Browse verified properties across the PropChain network.'
    : isBuyer
    ? 'Browse verified platform properties and authenticated deeds.'
    : 'Comprehensive decentralized ledger of authenticated property deeds and encumbrances.'

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded cursor-pointer ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-400'}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded cursor-pointer ${viewMode === 'table' ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-400'}`}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {(isSeller || isAdmin) && (
              <Button onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Register Property
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs for Seller: My Properties vs Marketplace */}
      {isSeller && (
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => {
              setSearchParams({})
              setStatusFilter('')
              setCurrentPage(1)
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer -mb-[1px]',
              activeTab === 'my'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Building2 className="h-4 w-4" />
            <span>My Properties</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-700">
              {statusCounts.total}
            </span>
          </button>
          <button
            onClick={() => {
              setSearchParams({ tab: 'marketplace' })
              setStatusFilter('')
              setCurrentPage(1)
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer -mb-[1px]',
              activeTab === 'marketplace'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Marketplace</span>
          </button>
        </div>
      )}

      {/* Admin and Legal Authority Verified Filter Chips */}
      {(isAdmin || user?.role === 'LEGAL_AUTHORITY') && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => {
              setStatusFilter('')
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter === ''
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            <span>All Properties</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                statusFilter === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
              )}
            >
              {properties.length}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter(statusFilter.toLowerCase() === 'verified' ? '' : 'Verified')
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter.toLowerCase() === 'verified'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:border-emerald-300'
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Verified</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                statusFilter.toLowerCase() === 'verified'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              )}
            >
              {properties.filter((p) => (p.verification_status || p.verificationStatus || '').toString().toUpperCase() === 'VERIFIED').length}
            </span>
          </button>
        </div>
      )}

      {/* Seller Summary Chips (Total / Pending / Waiting for verifier / Verified / Needs correction) */}
      {isSeller && activeTab === 'my' && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => {
              setStatusFilter('')
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter === ''
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            <span>Total</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                statusFilter === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
              )}
            >
              {statusCounts.total}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter(statusFilter.toLowerCase() === 'pending' ? '' : 'Pending')
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter.toLowerCase() === 'pending'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50/70 text-amber-800 border-amber-200 hover:border-amber-300'
            )}
          >
            <span>Pending</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                statusFilter.toLowerCase() === 'pending'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-100 text-amber-800'
              )}
            >
              {statusCounts.pending}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter(statusFilter.toLowerCase() === 'submitted' ? '' : 'Submitted')
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter.toLowerCase() === 'submitted'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:border-blue-300'
            )}
          >
            <span>Waiting for verifier</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                statusFilter.toLowerCase() === 'submitted'
                  ? 'bg-blue-700 text-white'
                  : 'bg-blue-100 text-blue-800'
              )}
            >
              {statusCounts.waiting}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter(statusFilter.toLowerCase() === 'verified' ? '' : 'Verified')
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter.toLowerCase() === 'verified'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:border-emerald-300'
            )}
          >
            <span>Verified</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                statusFilter.toLowerCase() === 'verified'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              )}
            >
              {statusCounts.verified}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter(
                statusFilter.toLowerCase() === 'needs correction' ? '' : 'Needs correction'
              )
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter.toLowerCase() === 'needs correction'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-rose-50/70 text-rose-800 border-rose-200 hover:border-rose-300'
            )}
          >
            <span>Needs correction</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                statusFilter.toLowerCase() === 'needs correction'
                  ? 'bg-rose-700 text-white'
                  : 'bg-rose-100 text-rose-800'
              )}
            >
              {statusCounts.needsCorrection}
            </span>
          </button>
        </div>
      )}

      {/* Post-Registration Success Banner */}
      {successBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                {successBanner.message}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {successBanner.title} has been added to your properties as{' '}
                <span className="font-semibold uppercase">Pending</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/documents?propertyId=${successBanner.propertyId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <FileCheck2 className="h-4 w-4" />
              <span>Upload documents</span>
            </Link>
            <button
              onClick={() => setSuccessBanner(null)}
              className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q)
          setCurrentPage(1)
        }}
        typeFilter={typeFilter}
        onTypeFilterChange={(t) => {
          setTypeFilter(t)
          setCurrentPage(1)
        }}
        typeOptions={PROPERTY_TYPES}
        statusFilter={statusFilter}
        onStatusFilterChange={(s) => {
          setStatusFilter(s)
          setCurrentPage(1)
        }}
        statusOptions={VERIFICATION_STATUSES}
        onReset={handleResetFilters}
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm font-medium">Loading properties from database...</p>
        </div>
      ) : filteredProperties.length === 0 ? (
        <EmptyState
          title={isSeller && activeTab === 'my' ? 'No Listed Properties' : 'No Matching Real Estate Found'}
          description={
            isSeller && activeTab === 'my'
              ? 'You have not registered any properties yet. Click "Register Property" to get started.'
              : 'Try broadening your search query or reset active filters.'
          }
          actionLabel={isSeller && activeTab === 'my' ? 'Register Property' : 'Clear Filters'}
          onAction={isSeller && activeTab === 'my' ? () => setIsModalOpen(true) : handleResetFilters}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {paginatedProperties.map((prop) => (
            <PropertyCard key={prop.id || prop.propertyId} property={prop} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcel ID</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Valuation</TableHead>
                <TableHead>Current Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProperties.map((prop) => {
                const rawStatus = (prop.verification_status || prop.verificationStatus || '').toString().toUpperCase()
                const isPending = rawStatus === 'PENDING' || !rawStatus
                const isNeedsCorrection =
                  rawStatus === 'NEEDS_CORRECTION' ||
                  rawStatus === 'CORRECTION_REQUESTED' ||
                  rawStatus === 'REQUIRES_CORRECTION'
                const isSubmitted = rawStatus === 'SUBMITTED'
                const isVerified = rawStatus === 'VERIFIED'
                const ownerOfProp = isPropOwner(prop)

                return (
                  <TableRow key={prop.id || prop.propertyId}>
                    <TableCell className="font-mono text-xs text-slate-400">
                      {prop.propertyId}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-900">{getPropertyLabel(prop)}</p>
                      <p className="text-xs text-slate-500">
                        {prop.address}, {prop.city}, {prop.state}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-slate-600">{prop.propertyType}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {prop.area.toLocaleString()} {prop.areaUnit}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {formatCurrency(prop.valuation)}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-slate-800">{prop.currentOwner}</p>
                      <p className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]">
                        {prop.ownerAddress}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={prop.verificationStatus}
                        label={getVerificationLabel(prop, user?.role)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isSeller && ownerOfProp ? (
                          <>
                            {isPending && (
                              <Link
                                to={`/documents?propertyId=${prop.id || prop.propertyId}`}
                                className="inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                              >
                                <FileCheck2 className="h-3 w-3" />
                                <span>Upload documents</span>
                              </Link>
                            )}
                            {isNeedsCorrection && (
                              <Link
                                to={`/documents?propertyId=${prop.id || prop.propertyId}`}
                                className="inline-flex items-center gap-1 rounded bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                              >
                                <AlertCircle className="h-3 w-3" />
                                <span>Fix documents</span>
                              </Link>
                            )}
                            {isSubmitted && (
                              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {getVerificationLabel(prop, user?.role)}
                              </span>
                            )}
                            <Link
                              to={`/properties/${prop.id || prop.propertyId}`}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Details
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link
                              to={`/properties/${prop.id || prop.propertyId}`}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Inspect
                            </Link>
                            {isBuyer && !ownerOfProp && isVerified && (
                              <Link
                                to={`/transactions?propertyId=${prop.id || prop.propertyId}&initiate=true`}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                              >
                                Make Offer
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredProperties.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      <RegisterPropertyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleRegisterSuccess}
      />
    </div>
  )
}

export default PropertiesPage
