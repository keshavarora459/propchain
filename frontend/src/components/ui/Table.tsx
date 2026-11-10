import React from 'react'
import { cn } from '@/lib/utils'

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-xl border border-[#E8E2D5] bg-white shadow-[0_1px_4px_rgba(37,43,40,0.02)]">
      <table ref={ref} className={cn('w-full text-left text-xs sm:text-sm text-[#252B28]', className)} {...props} />
    </div>
  )
)
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('bg-[#FAF8F3] border-b border-[#E8E2D5] text-[11px] font-semibold text-[#6B726B] uppercase tracking-wider', className)} {...props} />
  )
)
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('divide-y divide-[#F4F1EA]', className)} {...props} />
  )
)
TableBody.displayName = 'TableBody'

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'transition-colors duration-200 hover:bg-[#FAF8F3]/90 hover:text-[#252B28]',
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cn('px-4 py-3 font-semibold text-[#6B726B]', className)} {...props} />
  )
)
TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('px-4 py-3 align-middle text-xs font-normal text-[#252B28]', className)} {...props} />
  )
)
TableCell.displayName = 'TableCell'
