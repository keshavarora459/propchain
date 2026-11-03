import React, { useState, useRef, useEffect } from 'react'
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
  const [openUpward, setOpenUpward] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isExpanded) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isExpanded])

  if (!value) {
    return (
      <span className={cn('inline-flex items-center text-xs text-slate-400 italic font-mono whitespace-nowrap', className)}>
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

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!isExpanded && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const scrollParent = containerRef.current.closest('.overflow-x-auto, .overflow-y-auto')
      let spaceBelowParent = spaceBelow
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect()
        spaceBelowParent = parentRect.bottom - rect.bottom
      }

      // If near bottom of container or viewport, pop upward
      if ((spaceBelow < 170 || spaceBelowParent < 150) && rect.top > 170) {
        setOpenUpward(true)
      } else {
        setOpenUpward(false)
      }

      // If near right edge of viewport, align to right
      if (rect.left + 320 > window.innerWidth) {
        setAlignRight(true)
      } else {
        setAlignRight(false)
      }
    }
    setIsExpanded(!isExpanded)
  }

  const isTruncatable = truncate && value.length > startLength + endLength
  const displayedHash = isTruncatable
    ? truncateHash(value, startLength, endLength)
    : value

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200/90 shrink-0',
          isTruncatable && 'whitespace-nowrap',
          className
        )}
        title={value}
      >
        {label && (
          <span className="font-sans font-medium text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap">
            {label}:
          </span>
        )}

        <span
          className={cn(
            'font-mono text-blue-600 font-medium select-all',
            isTruncatable ? 'whitespace-nowrap' : 'break-all leading-relaxed'
          )}
        >
          {displayedHash}
        </span>

        {isTruncatable && (
          <button
            type="button"
            onClick={toggleExpand}
            className="text-slate-400 hover:text-slate-700 focus:outline-none p-0.5 rounded transition-colors inline-flex items-center"
            title={isExpanded ? 'Collapse full hash' : 'Show full hash'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-slate-400 hover:text-slate-700 focus:outline-none p-0.5 rounded transition-colors inline-flex items-center"
            title={copied ? 'Copied!' : 'Copy full hash'}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          </button>
        )}

        {explorerLink && (
          <Link
            to={`/blockchain-explorer?q=${encodeURIComponent(value)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-blue-500 hover:text-blue-700 focus:outline-none p-0.5 rounded transition-colors inline-flex items-center"
            title="Inspect in Blockchain Explorer"
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </span>

      {/* Popover / Dropdown showing the full hash */}
      {isExpanded && (
        <div
          className={cn(
            'absolute z-50 w-72 sm:w-80 max-w-md p-3 bg-slate-900 text-slate-100 rounded-lg shadow-xl border border-slate-700 text-xs text-left',
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            alignRight ? 'right-0' : 'left-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-700/80">
            <span className="font-sans font-semibold text-[10px] uppercase tracking-wider text-slate-400">
              Full SHA-256 Hash Proof
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
              title="Close"
            >
              <span className="text-xs leading-none">✕</span>
            </button>
          </div>

          <div className="bg-slate-950/90 p-2 rounded border border-slate-800 text-[11px] font-mono break-all text-slate-200 select-all leading-relaxed whitespace-normal">
            {value}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-sans transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy full hash</span>
                </>
              )}
            </button>

            {explorerLink && (
              <Link
                to={`/blockchain-explorer?q=${encodeURIComponent(value)}`}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 font-sans transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                <span>Explorer</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
