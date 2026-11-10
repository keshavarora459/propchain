import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Menu,
  Bell,
  Search,
  Wallet,
  ChevronDown,
  LogOut,
  AlertCircle,
  ExternalLink,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { useUI } from '@/hooks/useUI'
import { useAuth } from '@/hooks/useAuth'
import { useWallet } from '@/context/WalletContext'
import { Button } from '@/components/ui/Button'
import { truncateHash, getRoleLabel, cn } from '@/lib/utils'
import type { NotificationItem } from '@/types/notification'

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    if (isNaN(diffMs)) return ''
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} min ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} hr ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  } catch {
    return ''
  }
}

function getNotificationIcon(type: string) {
  switch ((type || '').toUpperCase()) {
    case 'SUCCESS':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
    case 'WARNING':
    case 'ACTION_REQUIRED':
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
    case 'ERROR':
      return <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
    case 'INFO':
    default:
      return <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
  }
}

export const Header: React.FC = () => {
  const {
    setMobileSidebarOpen,
    notificationsCount,
    notifications,
    markAsRead,
    markAllAsRead,
  } = useUI()
  const navigate = useNavigate()

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await markAsRead(notif.id)
    }
    setNotificationsOpen(false)
    if (notif.link) {
      navigate(notif.link)
    }
  }
  const { user, logout } = useAuth()
  const {
    account,
    chainId,
    isConnected,
    isConnecting,
    isVerified,
    error,
    clearError,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    linkWalletWithBackend,
  } = useWallet()

  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifySuccess, setVerifySuccess] = useState(false)

  const targetChainId = Number(import.meta.env.VITE_BLOCKCHAIN_CHAIN_ID || 31337)

  // Auto-hide error banner after 6 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => {
      clearError()
    }, 6000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  const handleConnect = async () => {
    clearError()
    await connectWallet()
  }

  const handleVerify = async () => {
    clearError()
    setIsVerifying(true)
    const success = await linkWalletWithBackend()
    setIsVerifying(false)
    if (success) {
      setVerifySuccess(true)
      const timer = setTimeout(() => {
        setVerifySuccess(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }

  const isNotDetected = error && (
    error.toLowerCase().includes('not detected') ||
    error.toLowerCase().includes('install metamask') ||
    (typeof window !== 'undefined' && !window.ethereum)
  )

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'PC'

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-[#E8E2D5] bg-[#FAF8F3]/90 px-4 sm:px-6 backdrop-blur-md">
      {/* Left side: Mobile Toggle & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="rounded-lg p-2 text-[#252B28] hover:bg-[#EAE4D9] md:hidden cursor-pointer"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative w-full hidden sm:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B49A70]" />
          <input
            type="text"
            placeholder="Search estates, deeds, verified assets, tx hashes..."
            className="w-full rounded-full border border-[#E8E2D5] bg-white py-2 pl-10 pr-4 text-xs text-[#252B28] placeholder:text-[#6B726B]/70 focus:border-[#657565] focus:outline-none focus:ring-1 focus:ring-[#657565] transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Right side: Wallet, Notifications, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Web3 Wallet Connection (MetaMask) */}
        <div className="relative">
          {isConnected && account ? (
            <div className="flex items-center gap-2 rounded-full border border-[#D4CBBC] bg-white px-3 py-1.5 text-xs shadow-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  isVerified ? 'bg-[#657565]' : 'bg-[#B49A70] animate-pulse'
                }`}
                title={isVerified ? 'Wallet Verified' : 'Wallet Unverified'}
              />
              <span className="font-mono font-medium text-[#252B28]">
                {truncateHash(account, 6, 4)}
              </span>

              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full font-medium bg-[#EAE4D9] text-[#252B28]"
              >
                {chainId === 11155111 ? 'Sepolia' : chainId === 31337 ? 'Localhost' : `Chain #${chainId || '?'}`}
              </span>

              {chainId && chainId !== targetChainId && (
                <button
                  onClick={() => switchNetwork(targetChainId)}
                  className="ml-1 rounded-full bg-[#B49A70]/20 px-2 py-0.5 text-[10px] font-semibold text-[#8F764F] hover:bg-[#B49A70]/30 transition-colors cursor-pointer"
                  title={`Switch to ${targetChainId === 11155111 ? 'Sepolia' : 'Local'}`}
                >
                  Switch to {targetChainId === 11155111 ? 'Sepolia' : 'Local'}
                </button>
              )}

              {!isVerified && (
                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="ml-1 text-[11px] font-semibold text-[#657565] hover:underline cursor-pointer disabled:opacity-50"
                  title="Sign Challenge to Link Wallet with PropChain Account"
                >
                  {isVerifying ? 'Signing...' : 'Verify'}
                </button>
              )}

              <button
                onClick={disconnectWallet}
                className="ml-1 text-[#6B726B] hover:text-rose-700 transition-colors cursor-pointer"
                title="Disconnect Wallet"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleConnect}
              isLoading={isConnecting}
              leftIcon={<Wallet className="h-3.5 w-3.5 text-[#657565]" />}
              className="text-xs"
            >
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="sm:hidden">Connect</span>
            </Button>
          )}

          {/* Visible Error Tooltip / Banner */}
          {error && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl border border-rose-200 bg-white p-3.5 shadow-xl backdrop-blur-sm z-50 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-rose-800 leading-snug">{error}</p>
                    {isNotDetected && (
                      <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#657565] underline hover:text-[#526152] transition-colors pt-0.5"
                      >
                        <span>Install MetaMask</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={clearError}
                  className="rounded p-0.5 text-rose-400 hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer"
                  aria-label="Dismiss error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Verification Success Toast */}
          {verifySuccess && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[#657565]/30 bg-white p-3 shadow-xl backdrop-blur-sm z-50 text-xs text-[#252B28] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#657565] shrink-0" />
                <span className="font-medium">Wallet verified and linked!</span>
              </div>
              <button
                onClick={() => setVerifySuccess(false)}
                className="text-[#6B726B] hover:text-[#252B28] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen((prev) => !prev)
              setProfileOpen(false)
            }}
            className="relative rounded-full p-2.5 text-[#252B28] hover:bg-[#EAE4D9]/70 transition-colors cursor-pointer border border-[#E8E2D5] bg-white"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4 text-[#252B28]" />
            {notificationsCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#657565] text-[10px] font-bold text-white shadow-xs">
                {notificationsCount > 99 ? '99+' : notificationsCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-[#E8E2D5] bg-white shadow-xl z-50 overflow-hidden flex flex-col max-h-[480px]">
              <div className="flex items-center justify-between border-b border-[#F4F1EA] px-4 py-3 bg-[#FAF8F3]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#252B28]">Estate Notifications</span>
                  {notificationsCount > 0 && (
                    <span className="rounded-full bg-[#657565]/15 text-[#3F4B3F] border border-[#657565]/30 text-[10px] px-2 py-0.5 font-semibold">
                      {notificationsCount} unread
                    </span>
                  )}
                </div>
                {notificationsCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-[11px] font-medium text-[#657565] hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="overflow-y-auto divide-y divide-[#F4F1EA] flex-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-[#6B726B] text-xs">
                    No new alerts or pending notices.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        'flex items-start gap-3 p-3.5 transition-colors cursor-pointer hover:bg-[#FAF8F3]/70',
                        !notif.is_read ? 'bg-[#FAF8F3]/50' : 'bg-white'
                      )}
                    >
                      {getNotificationIcon(notif.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn('text-xs leading-tight', !notif.is_read ? 'font-semibold text-[#252B28]' : 'font-medium text-[#6B726B]')}>
                            {notif.title}
                          </p>
                          {!notif.is_read && (
                            <span className="h-2 w-2 rounded-full bg-[#657565] shrink-0" title="Unread" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#6B726B] mt-1 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-[#A19D94] mt-1 font-mono">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-[#F4F1EA] p-2.5 text-center bg-[#FAF8F3]/60">
                <Link
                  to="/notifications"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-xs font-semibold text-[#657565] hover:text-[#526152] transition-colors inline-block py-0.5"
                >
                  View all notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen((prev) => !prev)
              setNotificationsOpen(false)
            }}
            className="flex items-center gap-2 rounded-full border border-[#E8E2D5] bg-white p-1.5 pr-3 hover:bg-[#FAF8F3] transition-colors cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#252B28] text-white text-xs font-semibold">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-semibold text-[#252B28] leading-tight truncate max-w-[110px]">
                {user?.full_name || 'Member'}
              </span>
              <span className="block text-[10px] text-[#B49A70] font-medium tracking-wide uppercase">
                {getRoleLabel(user?.role)}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-[#6B726B]" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-[#E8E2D5] bg-white shadow-xl z-50 overflow-hidden py-1">
              <div className="px-4 py-3 border-b border-[#F4F1EA] bg-[#FAF8F3]">
                <p className="text-xs font-semibold text-[#252B28] truncate">{user?.full_name}</p>
                <p className="text-[11px] text-[#6B726B] truncate mt-0.5">{user?.email}</p>
                <p className="text-[10px] font-semibold text-[#657565] mt-1 uppercase tracking-wider">{getRoleLabel(user?.role)}</p>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false)
                  logout()
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
