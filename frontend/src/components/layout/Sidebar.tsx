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
import { BrandLogo, PropChainMark } from '@/components/common/BrandLogo'

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUI()
  const { user } = useAuth()

  const navItems = getNavigationForRole(user?.role)

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard':
        return <LayoutDashboard className="h-4 w-4 shrink-0" />
      case 'Building2':
        return <Building2 className="h-4 w-4 shrink-0" />
      case 'FileBadge':
        return <FileBadge className="h-4 w-4 shrink-0" />
      case 'ArrowLeftRight':
        return <ArrowLeftRight className="h-4 w-4 shrink-0" />
      case 'FileCheck2':
        return <FileCheck2 className="h-4 w-4 shrink-0" />
      case 'CheckSquare':
        return <CheckSquare className="h-4 w-4 shrink-0" />
      case 'ShieldAlert':
        return <ShieldAlert className="h-4 w-4 shrink-0" />
      case 'Cpu':
        return <Cpu className="h-4 w-4 shrink-0" />
      case 'BarChart3':
        return <BarChart3 className="h-4 w-4 shrink-0" />
      case 'Settings':
        return <Settings className="h-4 w-4 shrink-0" />
      case 'Users':
        return <Users className="h-4 w-4 shrink-0" />
      case 'ShoppingBag':
        return <ShoppingBag className="h-4 w-4 shrink-0" />
      default:
        return <LayoutDashboard className="h-4 w-4 shrink-0" />
    }
  }

  const getRoleBadge = () => {
    switch (user?.role) {
      case 'ADMIN':
        return { label: getRoleLabel('ADMIN'), icon: Shield, color: 'text-[#B49A70] bg-[#FAF8F3] border-[#B49A70]/30' }
      case 'LEGAL_AUTHORITY':
        return { label: getRoleLabel('LEGAL_AUTHORITY'), icon: Scale, color: 'text-[#657565] bg-[#FAF8F3] border-[#657565]/30' }
      case 'REGISTRAR':
      case 'VERIFIER':
        return { label: getRoleLabel('REGISTRAR'), icon: UserCheck, color: 'text-[#B49A70] bg-[#FAF8F3] border-[#B49A70]/30' }
      case 'PROPERTY_OWNER':
        return { label: getRoleLabel('PROPERTY_OWNER'), icon: Home, color: 'text-[#657565] bg-[#FAF8F3] border-[#657565]/30' }
      case 'BUYER':
      default:
        return { label: getRoleLabel('BUYER'), icon: ShoppingBag, color: 'text-[#B49A70] bg-[#FAF8F3] border-[#B49A70]/30' }
    }
  }

  const roleMeta = getRoleBadge()
  const RoleIcon = roleMeta.icon

  const renderNavLinks = (isDrawer = false) => {
    const isCollapsed = !isDrawer && sidebarCollapsed

    return (
      <nav className={cn('flex-1 space-y-1.5 overflow-y-auto', isCollapsed ? 'px-2 py-4' : 'px-3 py-4')}>
        {navItems.map((item: NavItem) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={() => setMobileSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-xl text-xs font-medium transition-all duration-200 group relative',
                isCollapsed
                  ? 'justify-center h-10 w-10 mx-auto hover:bg-[#FAF8F3]/15'
                  : 'gap-3 px-3.5 py-2.5 hover:translate-x-0.5',
                isActive
                  ? 'bg-[#657565] text-white shadow-xs font-medium hover:bg-[#5a6a5a]'
                  : 'text-[#FAF8F3]/70 hover:bg-[#FAF8F3]/10 hover:text-white'
              )
            }
            title={item.title}
          >
            {getIcon(item.iconName)}
            {!isCollapsed && <span className="truncate tracking-wide">{item.title}</span>}
            {!isCollapsed && item.badge && (
              <span className="ml-auto rounded-full bg-[#B49A70]/20 text-[#FAF8F3] px-2 py-0.5 text-[10px] font-bold border border-[#B49A70]/40">
                {item.badge}
              </span>
            )}
            {isCollapsed && item.badge && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#B49A70] ring-2 ring-[#252B28]" />
            )}

            {/* Floating tooltip for collapsed mode */}
            {isCollapsed && (
              <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-lg bg-[#252B28] px-3 py-1.5 text-xs font-medium text-white shadow-xl border border-[#3E4743] whitespace-nowrap group-hover:flex items-center gap-2">
                <span>{item.title}</span>
                {item.badge && (
                  <span className="rounded-full bg-[#B49A70]/30 text-[#FAF8F3] px-1.5 py-0.2 text-[10px] font-semibold border border-[#B49A70]/40">
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
          className="fixed inset-0 z-40 bg-[#252B28]/80 backdrop-blur-xs md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#252B28] text-white shadow-2xl transition-transform duration-300 md:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#363E3A] px-5">
          <BrandLogo theme="dark" size="sm" />
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-lg p-1.5 text-[#FAF8F3]/60 hover:bg-[#FAF8F3]/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role identifier in mobile drawer */}
        <div className="px-5 py-3 border-b border-[#363E3A] bg-[#1E2320]">
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium', roleMeta.color)}>
            <RoleIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium tracking-wide">{roleMeta.label}</span>
          </div>
        </div>

        {renderNavLinks(true)}

        <div className="border-t border-[#363E3A] p-4">
          <div className="rounded-xl bg-[#1E2320] p-3 text-xs text-[#FAF8F3]/70 border border-[#363E3A]">
            <p className="font-semibold text-white tracking-wide">EVM Private Node</p>
            <p className="font-mono text-[10px] text-[#B49A70] mt-0.5">● Connected: 31337</p>
          </div>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-[#363E3A] bg-[#252B28] text-white shrink-0 sticky top-0 h-screen select-none transition-all duration-300 ease-in-out shadow-[4px_0_24px_rgba(37,43,40,0.06)]',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            'flex h-18 items-center border-b border-[#363E3A] transition-all duration-300',
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-5'
          )}
        >
          {sidebarCollapsed ? (
            <button
              onClick={toggleSidebar}
              className="relative flex items-center justify-center rounded-xl transition-transform hover:scale-105 cursor-pointer group"
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
            >
              <PropChainMark variant="sage" size={38} />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#252B28] border border-[#363E3A] text-[#B49A70] shadow-xs">
                <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>
          ) : (
            <>
              <BrandLogo theme="dark" size="md" className="overflow-hidden" />
              <button
                onClick={toggleSidebar}
                className="rounded-lg p-1.5 text-[#FAF8F3]/60 hover:bg-[#FAF8F3]/10 hover:text-white transition-colors cursor-pointer shrink-0"
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
                'flex items-center justify-center h-10 w-10 rounded-xl border cursor-default group relative',
                roleMeta.color
              )}
              title={`Current Role: ${roleMeta.label}`}
            >
              <RoleIcon className="h-4 w-4 shrink-0" />
              <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md bg-[#252B28] px-2.5 py-1 text-xs font-medium text-white shadow-xl border border-[#363E3A] whitespace-nowrap group-hover:block">
                Role: {roleMeta.label}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 pt-4">
            <div className={cn('flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium', roleMeta.color)}>
              <RoleIcon className="h-4 w-4 shrink-0" />
              <div className="truncate">
                <p className="text-[9px] uppercase tracking-[0.15em] font-semibold opacity-70">Current Role</p>
                <p className="font-medium text-xs truncate tracking-wide">{roleMeta.label}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        {renderNavLinks(false)}

        {/* Network & Environment Footer */}
        <div className="border-t border-[#363E3A] p-3.5">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <div
                className="h-8 w-8 rounded-xl bg-[#1E2320] border border-[#363E3A] flex items-center justify-center cursor-default group relative"
                title="EVM Hardhat Node (Chain 31337) - Synced"
              >
                <div className="h-2 w-2 rounded-full bg-[#657565] animate-pulse" />
                <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md bg-[#252B28] px-3 py-1.5 text-[11px] font-medium text-[#B49A70] shadow-xl border border-[#363E3A] whitespace-nowrap group-hover:block">
                  EVM Node: 31337 (Synced)
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#1E2320] p-3 text-xs text-[#FAF8F3]/70 border border-[#363E3A]">
              <p className="font-semibold text-white text-xs tracking-wide">EVM Settlement Node</p>
              <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-[#B49A70]">
                <span>Chain: 31337</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#657565] inline-block animate-pulse" />
                  Synced
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
