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
  UserCheck,
  Scale,
  Home,
  ShoppingBag,
} from 'lucide-react'
import { useUI } from '@/hooks/useUI'
import { useAuth } from '@/hooks/useAuth'
import { getNavigationForRole, type NavItem } from '@/constants/navigation'
import { cn, getRoleLabel } from '@/lib/utils'

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUI()
  const { user } = useAuth()

  const navItems = getNavigationForRole(user?.role)

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
      case 'Users':
        return <Users className="h-5 w-5 shrink-0" />
      case 'ShoppingBag':
        return <ShoppingBag className="h-5 w-5 shrink-0" />
      default:
        return <LayoutDashboard className="h-5 w-5 shrink-0" />
    }
  }

  const getRoleBadge = () => {
    switch (user?.role) {
      case 'ADMIN':
        return { label: getRoleLabel('ADMIN'), icon: Shield, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
      case 'LEGAL_AUTHORITY':
        return { label: getRoleLabel('LEGAL_AUTHORITY'), icon: Scale, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' }
      case 'VERIFIER':
        return { label: getRoleLabel('VERIFIER'), icon: UserCheck, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' }
      case 'PROPERTY_OWNER':
        return { label: getRoleLabel('PROPERTY_OWNER'), icon: Home, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
      case 'BUYER':
      default:
        return { label: getRoleLabel('BUYER'), icon: ShoppingBag, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
    }
  }

  const roleMeta = getRoleBadge()
  const RoleIcon = roleMeta.icon

  const renderNavLinks = (isDrawer = false) => {
    const isCollapsed = !isDrawer && sidebarCollapsed

    return (
      <nav className={cn('flex-1 space-y-1 overflow-y-auto', isCollapsed ? 'px-2 py-4' : 'px-3 py-4')}>
        {navItems.map((item: NavItem) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={() => setMobileSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg text-xs font-medium transition-all group relative',
                isCollapsed
                  ? 'justify-center h-10 w-10 mx-auto'
                  : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              )
            }
            title={item.title}
          >
            {getIcon(item.iconName)}
            {!isCollapsed && <span className="truncate">{item.title}</span>}
            {!isCollapsed && item.badge && (
              <span className="ml-auto rounded-full bg-blue-600/30 text-blue-400 px-2 py-0.5 text-[10px] font-bold border border-blue-500/20">
                {item.badge}
              </span>
            )}
            {isCollapsed && item.badge && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-slate-900" />
            )}

            {/* Floating tooltip for collapsed mode */}
            {isCollapsed && (
              <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl border border-slate-700 whitespace-nowrap group-hover:flex items-center gap-2">
                <span>{item.title}</span>
                {item.badge && (
                  <span className="rounded-full bg-blue-500/30 text-blue-300 px-1.5 py-0.2 text-[10px] font-bold border border-blue-400/20">
                    {item.badge}
                  </span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    )
  }

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

        {/* Role identifier in mobile drawer */}
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
          <div className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium', roleMeta.color)}>
            <RoleIcon className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{roleMeta.label}</span>
          </div>
        </div>

        {renderNavLinks(true)}

        <div className="border-t border-slate-800/80 p-4">
          <div className="rounded-lg bg-slate-900 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">EVM Hardhat Node</p>
            <p className="font-mono text-[10px] text-emerald-400 mt-0.5">● Connected: 31337</p>
          </div>
        </div>
      </div>

      {/* Desktop Persistent & Smoothly Collapsible Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-slate-800 bg-slate-950 text-white shrink-0 sticky top-0 h-screen select-none transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-slate-800/80 transition-all duration-300',
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          {sidebarCollapsed ? (
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md hover:bg-blue-500 transition-all cursor-pointer relative group"
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
            >
              <Shield className="h-5 w-5" />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 shadow-xs">
                <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm font-bold">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <span className="text-base font-bold tracking-tight text-white block">PropChain</span>
                  <span className="block text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                    Enterprise EVM
                  </span>
                </div>
              </div>
              <button
                onClick={toggleSidebar}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Collapse Sidebar"
                aria-label="Collapse Sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* User Role Badge in Sidebar */}
        {sidebarCollapsed ? (
          <div className="px-2 pt-3 flex justify-center">
            <div
              className={cn(
                'flex items-center justify-center h-10 w-10 rounded-lg border cursor-default group relative',
                roleMeta.color
              )}
              title={`Current Role: ${roleMeta.label}`}
            >
              <RoleIcon className="h-5 w-5 shrink-0" />
              <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-xl border border-slate-700 whitespace-nowrap group-hover:block">
                Role: {roleMeta.label}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-3 pt-3">
            <div className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium', roleMeta.color)}>
              <RoleIcon className="h-4 w-4 shrink-0" />
              <div className="truncate">
                <p className="text-[10px] uppercase tracking-wider font-semibold opacity-70">Current Role</p>
                <p className="font-semibold text-xs truncate">{roleMeta.label}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        {renderNavLinks(false)}

        {/* Network & Environment Footer */}
        <div className="border-t border-slate-800/80 p-3">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <div
                className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center cursor-default group relative"
                title="EVM Hardhat Node (Chain 31337) - Synced"
              >
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-emerald-400 shadow-xl border border-slate-700 whitespace-nowrap group-hover:block">
                  EVM Node: 31337 (Synced)
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-900 p-3 text-xs text-slate-400">
              <p className="font-semibold text-slate-200 text-xs">EVM Local Node</p>
              <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-emerald-400">
                <span>Chain: 31337</span>
                <span>Synced</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
