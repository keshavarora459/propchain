import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { truncateHash, cn } from '@/lib/utils'

export interface HashDisplayProps {
  value?: string | null
  label?: string
  truncate?: boolean
  startLength?: number
  endLength?: number
  explorerLink?: boolean
  copyable?: boolean
  className?: string
  pendingText?: string
}

export const HashDisplay: React.FC<HashDisplayProps> = ({
  value,
  label,
  truncate = true,
  startLength = 8,
  endLength = 6,
  explorerLink = false,
  copyable = true,
  className,
  pendingText = 'Pending',
}) => {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  if (!value) {
    return (
      <span className={cn('inline-flex items-center text-xs text-slate-400 italic font-mono', className)}>
        {pendingText}
      </span>
    )
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.warn('Failed to copy hash to clipboard:', err)
    }
  }

  const displayedHash = truncate && !isExpanded
    ? truncateHash(value, startLength, endLength)
    : value

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/80 max-w-full',
        className
      )}
      title={value}
    >
      {label && <span className="font-sans font-medium text-[10px] text-slate-500 uppercase tracking-wider">{label}:</span>}

      <span className="font-mono text-blue-600 break-all select-all font-medium">
        {displayedHash}
      </span>

      {truncate && value.length > startLength + endLength && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-slate-700 focus:outline-none p-0.5 rounded transition-colors"
          title={isExpanded ? 'Collapse' : 'Show full hash'}
        >
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      )}

      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="text-slate-400 hover:text-slate-700 focus:outline-none p-0.5 rounded transition-colors"
          title={copied ? 'Copied!' : 'Copy full hash'}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        </button>
      )}

      {explorerLink && (
        <Link
          to={`/blockchain-explorer?q=${encodeURIComponent(value)}`}
          className="text-blue-500 hover:text-blue-700 focus:outline-none p-0.5 rounded transition-colors"
          title="Inspect in Blockchain Explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </span>
  )
}

