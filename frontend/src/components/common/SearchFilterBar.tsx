import React from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

export interface SearchFilterBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  typeFilter: string
  onTypeFilterChange: (type: string) => void
  typeOptions: readonly string[]
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  statusOptions: readonly string[]
  onReset: () => void
  placeholder?: string
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  typeOptions,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  onReset,
  placeholder = 'Search by ID, title, address, owner or wallet...',
}) => {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-xl border border-slate-200/80 mb-6 shadow-xs">
      <div className="flex-1">
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
          className="bg-slate-50 border-slate-200"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-36">
          <Select
            options={typeOptions}
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            placeholder="All Types"
            className="bg-slate-50"
          />
        </div>
        <div className="w-36">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            placeholder="All Statuses"
            className="bg-slate-50"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onReset} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
          Reset
        </Button>
      </div>
    </div>
  )
}

