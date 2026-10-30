import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  FileBadge,
  ArrowLeftRight,
  FileCheck2,
  CheckSquare,
  ShieldAlert,
  Cpu,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Users,
  X,
} from 'lucide-react'
import { useUI } from '@/hooks/useUI'
import { useAuth } from '@/hooks/useAuth'
import { NAVIGATION_ITEMS, type NavItem } from '@/constants/navigation'
import { cn } from '@/lib/utils'

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUI()
  const { user } = useAuth()

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard':
        return <LayoutDashboard className="h-5 w-5 shrink-0" />
      case 'Building2':
        return <Building2 className="h-5 w-5 shrink-0" />
      case 'FileBadge':
        return <FileBadge className="h-5 w-5 shrink-0" />
      case 'ArrowLeftRight':
        return <ArrowLeftRight className="h-5 w-5 shrink-0" />
      case 'FileCheck2':
        return <FileCheck2 className="h-5 w-5 shrink-0" />
      case 'CheckSquare':
        return <CheckSquare className="h-5 w-5 shrink-0" />
      case 'ShieldAlert':
        return <ShieldAlert className="h-5 w-5 shrink-0" />
      case 'Cpu':
        return <Cpu className="h-5 w-5 shrink-0" />
      case 'BarChart3':
        return <BarChart3 className="h-5 w-5 shrink-0" />
      case 'Settings':
        return <Settings className="h-5 w-5 shrink-0" />
      default:
        return <LayoutDashboard className="h-5 w-5 shrink-0" />
    }
  }

  const renderNavLinks = () => (
    <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
      {NAVIGATION_ITEMS.map((item: NavItem) => (
        <NavLink
          key={item.href}
          to={item.href}
          onClick={() => setMobileSidebarOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all group relative',
              isActive
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            )
          }
          title={sidebarCollapsed ? item.title : undefined}
        >
          {getIcon(item.iconName)}
          {!sidebarCollapsed && <span className="truncate">{item.title}</span>}
          {!sidebarCollapsed && item.badge && (
            <span className="ml-auto rounded-full bg-blue-600/30 text-blue-400 px-2 py-0.5 text-[10px] font-bold border border-blue-500/20">
              {item.badge}
            </span>
          )}
          {sidebarCollapsed && item.badge && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-slate-900" />
          )}
        </NavLink>
      ))}

      {user?.role === 'ADMIN' && (
        <NavLink
          to="/admin/users"
          onClick={() => setMobileSidebarOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all group relative',
              isActive
                ? 'bg-blue-900/40 text-blue-300 border border-blue-500/30 font-semibold'
                : 'text-amber-400/80 hover:bg-slate-800/60 hover:text-amber-300'
            )
          }
          title={sidebarCollapsed ? 'User Governance' : undefined}
        >
          <Users className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && <span className="truncate">User Governance</span>}
        </NavLink>
      )}
    </nav>
  )

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 text-white shadow-2xl transition-transform duration-300 md:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm font-bold">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">PropChain</span>
              <span className="block text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                Enterprise EVM
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {renderNavLinks()}
        <div className="border-t border-slate-800/80 p-4">
          <div className="rounded-lg bg-slate-900 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">EVM Hardhat Node</p>
            <p className="font-mono text-[10px] text-emerald-400 mt-0.5">● Connected: 31337</p>
          </div>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-slate-800 bg-slate-950 text-white transition-all duration-300 shrink-0 sticky top-0 h-screen',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm font-bold">
              <Shield className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <span className="text-base font-bold tracking-tight text-white">PropChain</span>
                <span className="block text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                  Enterprise EVM
                </span>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        {renderNavLinks()}

        {/* Network & Environment Footer */}
        <div className="border-t border-slate-800/80 p-3">
          <div className={cn('rounded-lg bg-slate-900 text-xs text-slate-400', sidebarCollapsed ? 'p-2 text-center' : 'p-3')}>
            {!sidebarCollapsed ? (
              <>
                <p className="font-semibold text-slate-200 text-xs">EVM Local Node</p>
                <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-emerald-400">
                  <span>Chain: 31337</span>
                  <span>Synced</span>
                </div>
              </>
            ) : (
              <div className="h-2 w-2 mx-auto rounded-full bg-emerald-500" title="EVM Node 31337 Online" />
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
