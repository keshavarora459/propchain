import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center text-xs text-slate-500 mb-1" aria-label="Breadcrumb">
      <Link to="/dashboard" className="flex items-center hover:text-slate-800 transition-colors">
        <Home className="h-3.5 w-3.5 mr-1" />
        <span>Home</span>
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <React.Fragment key={item.label}>
            <ChevronRight className="h-3 w-3 mx-1.5 text-slate-400" />
            {isLast || !item.href ? (
              <span className="font-medium text-slate-800">{item.label}</span>
            ) : (
              <Link to={item.href} className="hover:text-slate-800 transition-colors">
                {item.label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

