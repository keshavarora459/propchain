import React, { useState, useMemo } from 'react'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PropertyCard } from '@/components/common/PropertyCard'
import { SearchFilterBar } from '@/components/common/SearchFilterBar'
import { EmptyState } from '@/components/common/EmptyState'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { RegisterPropertyModal } from './RegisterPropertyModal'
import { MOCK_PROPERTIES } from '@/mock-data/properties'
import { PROPERTY_TYPES, VERIFICATION_STATUSES } from '@/constants/options'
import { formatCurrency } from '@/lib/utils'
import type { Property } from '@/types/property'
import type { PropertyRegistrationFormData } from '@/schemas/propertySchema'
import { Link } from 'react-router-dom'

function createPropertyRecord(formData: PropertyRegistrationFormData): Property {
  const timestamp = Date.now()
  return {
    id: `prop-${timestamp}`,
    propertyId: `PROP-${Math.floor(10000 + Math.random() * 90000)}`,
    title: formData.title,
    propertyType: formData.propertyType,
    address: formData.address,
    city: formData.city,
    state: formData.state,
    postalCode: formData.postalCode,
    area: formData.area,
    areaUnit: formData.areaUnit,
    valuation: formData.valuation,
    currentOwner: formData.ownerName,
    ownerAddress: formData.ownerWallet,
    registrationReference: formData.registrationReference,
    verificationStatus: 'Pending',
    registeredAt: new Date(timestamp).toISOString(),
    description: formData.description || 'Newly submitted property parcel.',
  }
}

export const PropertiesPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>(MOCK_PROPERTIES)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  const filteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      const matchesSearch =
        searchQuery === '' ||
        prop.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.propertyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.currentOwner.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.ownerAddress.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = typeFilter === '' || prop.propertyType === typeFilter
      const matchesStatus = statusFilter === '' || prop.verificationStatus === statusFilter

      return matchesSearch && matchesType && matchesStatus
    })
  }, [properties, searchQuery, typeFilter, statusFilter])

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProperties.slice(start, start + itemsPerPage)
  }, [filteredProperties, currentPage])

  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage)

  const handleRegisterSuccess = (formData: PropertyRegistrationFormData) => {
    const newProperty = createPropertyRecord(formData)
    setProperties([newProperty, ...properties])
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setTypeFilter('')
    setStatusFilter('')
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Real Estate Registry"
        description="Comprehensive decentralized ledger of authenticated property deeds and encumbrances."
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Register Parcel
            </Button>
          </div>
        }
      />

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

      {filteredProperties.length === 0 ? (
        <EmptyState
          title="No Matching Real Estate Found"
          description="Try broadening your search query or reset active filters."
          actionLabel="Clear Filters"
          onAction={handleResetFilters}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {paginatedProperties.map((prop) => (
            <PropertyCard key={prop.id} property={prop} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcel ID</TableHead>
                <TableHead>Title & Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Valuation</TableHead>
                <TableHead>Current Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProperties.map((prop) => (
                <TableRow key={prop.id}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900">
                    {prop.propertyId}
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{prop.title}</p>
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
                    <StatusBadge status={prop.verificationStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/properties/${prop.id}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Inspect
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
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
