import React, { useState, useEffect } from 'react'
import {
  Menu,
  Bell,
  Search,
  Wallet,
  User,
  ChevronDown,
  LogOut,
  Shield,
  AlertCircle,
  ExternalLink,
  X,
  CheckCircle2,
} from 'lucide-react'
import { useUI } from '@/hooks/useUI'
import { useAuth } from '@/hooks/useAuth'
import { useWallet } from '@/context/WalletContext'
import { Button } from '@/components/ui/Button'
import { truncateHash } from '@/lib/utils'

export const Header: React.FC = () => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    setMobileSidebarOpen,
    notificationsCount,
    clearNotifications,
  } = useUI()
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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Left side: Mobile Toggle & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:hidden cursor-pointer"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop sidebar toggle trigger */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative w-full hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search properties, tokens, tx hashes (e.g. 0x9e1f...)"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>
      </div>

      {/* Right side: Wallet, Notifications, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Web3 Wallet Connection (MetaMask) */}
        <div className="relative">
          {isConnected && account ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  isVerified ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
                title={isVerified ? 'Wallet Verified' : 'Wallet Unverified'}
              />
              <span className="font-mono font-medium text-slate-700">
                {truncateHash(account, 6, 4)}
              </span>

              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${
                  chainId === 11155111
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {chainId === 11155111 ? 'Sepolia' : chainId === 31337 ? 'Localhost' : `Chain #${chainId || '?'}`}
              </span>

              {chainId && chainId !== targetChainId && (
                <button
                  onClick={() => switchNetwork(targetChainId)}
                  className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-200 transition-colors cursor-pointer"
                  title={`Switch to ${targetChainId === 11155111 ? 'Sepolia' : 'Local'}`}
                >
                  Switch to {targetChainId === 11155111 ? 'Sepolia' : 'Local'}
                </button>
              )}

              {!isVerified && (
                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="ml-1 text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer disabled:opacity-50"
                  title="Sign Challenge to Link Wallet with PropChain Account"
                >
                  {isVerifying ? 'Signing...' : 'Verify'}
                </button>
              )}

              <button
                onClick={disconnectWallet}
                className="ml-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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
              leftIcon={<Wallet className="h-3.5 w-3.5 text-blue-600" />}
              className="text-xs"
            >
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="sm:hidden">Connect</span>
            </Button>
          )}

          {/* Visible Error Tooltip / Banner */}
          {error && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-xl border border-rose-200 bg-rose-50/95 p-3 shadow-xl backdrop-blur-sm z-50 text-xs">
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
                        className="inline-flex items-center gap-1 font-semibold text-rose-700 underline hover:text-rose-900 transition-colors pt-0.5"
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
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-emerald-200 bg-emerald-50/95 p-2.5 shadow-xl backdrop-blur-sm z-50 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-medium">Wallet verified and linked!</span>
              </div>
              <button
                onClick={() => setVerifySuccess(false)}
                className="text-emerald-500 hover:text-emerald-800 cursor-pointer"
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
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {notificationsCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-900">Notifications</span>
                {notificationsCount > 0 && (
                  <button
                    onClick={clearNotifications}
                    className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 text-xs py-1">
                <div className="py-2">
                  <p className="font-medium text-slate-800">Critical Alert Detected</p>
                  <p className="text-slate-500 text-[11px]">Property PROP-10045 flagged for signature anomaly.</p>
                </div>
                <div className="py-2">
                  <p className="font-medium text-slate-800">Escrow Funded</p>
                  <p className="text-slate-500 text-[11px]">$12.5M deposit received for TXN-9021.</p>
                </div>
                <div className="py-2">
                  <p className="font-medium text-slate-800">Title Token Minted</p>
                  <p className="text-slate-500 text-[11px]">Token #10046 minted to block 5089120.</p>
                </div>
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
            className="flex items-center gap-2 rounded-lg p-1 text-left hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white font-medium text-xs">
              {initials}
            </div>
            <div className="hidden lg:block text-left">
              <span className="block text-xs font-semibold text-slate-800 leading-tight">
                {user?.full_name || 'Network User'}
              </span>
              <span className="block text-[10px] text-slate-500 font-mono">
                {user?.role || 'Guest'}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400 hidden lg:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800">{user?.full_name || 'PropChain User'}</p>
                <p className="text-[11px] text-slate-500 font-mono truncate">{user?.email || 'authenticated session'}</p>
                <div className="mt-1">
                  <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {user?.role || 'BUYER'}
                  </span>
                </div>
              </div>
              <div className="py-1">
                <a
                  href="/settings"
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Account Profile
                </a>
                {user?.role === 'ADMIN' && (
                  <a
                    href="/admin/users"
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Shield className="h-3.5 w-3.5 text-slate-400" />
                    User Governance
                  </a>
                )}
                <button
                  onClick={() => {
                    setProfileOpen(false)
                    logout()
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 text-left cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-red-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
