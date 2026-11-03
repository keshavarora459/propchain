import type { UserRole } from '@/types/auth'

export interface NavItem {
  title: string
  href: string
  iconName: string
  badge?: string
}

export const ROLE_NAVIGATION: Record<UserRole, NavItem[]> = {
  BUYER: [
    { title: 'Buyer Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
    { title: 'Browse Properties', href: '/properties', iconName: 'Building2' },
    { title: 'My Offers & Deals', href: '/transactions', iconName: 'ArrowLeftRight' },
    { title: 'Ownership & Deeds', href: '/ownership', iconName: 'FileBadge' },
    { title: 'Blockchain Records', href: '/blockchain-explorer', iconName: 'Cpu' },
    { title: 'Profile & Settings', href: '/settings', iconName: 'Settings' },
  ],
  PROPERTY_OWNER: [
    { title: 'Seller Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
    { title: 'My Properties', href: '/properties', iconName: 'Building2' },
    { title: 'Marketplace', href: '/properties?tab=marketplace', iconName: 'ShoppingBag' },
    { title: 'Document Uploads', href: '/documents', iconName: 'FileCheck2' },
    { title: 'Received Offers', href: '/transactions', iconName: 'ArrowLeftRight' },
    { title: 'Ownership Transfer', href: '/ownership', iconName: 'FileBadge' },
    { title: 'Blockchain Records', href: '/blockchain-explorer', iconName: 'Cpu' },
    { title: 'Settings', href: '/settings', iconName: 'Settings' },
  ],
  VERIFIER: [
    { title: 'Agent Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
    { title: 'Assigned Properties', href: '/properties', iconName: 'Building2' },
    { title: 'Document Verification', href: '/documents', iconName: 'FileCheck2' },
    { title: 'Verification Approvals', href: '/approvals', iconName: 'CheckSquare' },
    { title: 'Deals & Tracking', href: '/transactions', iconName: 'ArrowLeftRight' },
    { title: 'Blockchain Ledger', href: '/blockchain-explorer', iconName: 'Cpu' },
    { title: 'Settings', href: '/settings', iconName: 'Settings' },
  ],
  LEGAL_AUTHORITY: [
    { title: 'Legal Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
    { title: 'Pending Legal Approvals', href: '/approvals', iconName: 'CheckSquare' },
    { title: 'Statutory Registry', href: '/ownership', iconName: 'FileBadge' },
    { title: 'Property Documents', href: '/documents', iconName: 'FileCheck2' },
    { title: 'Conveyance Transactions', href: '/transactions', iconName: 'ArrowLeftRight' },
    { title: 'Blockchain Ledger', href: '/blockchain-explorer', iconName: 'Cpu' },
    { title: 'Settings', href: '/settings', iconName: 'Settings' },
  ],
  ADMIN: [
    { title: 'Platform Overview', href: '/dashboard', iconName: 'LayoutDashboard' },
    { title: 'User Management', href: '/admin/users', iconName: 'Users' },
    { title: 'Property Management', href: '/properties', iconName: 'Building2' },
    { title: 'Transactions & Escrow', href: '/transactions', iconName: 'ArrowLeftRight' },
    { title: 'Document Repository', href: '/documents', iconName: 'FileCheck2' },
    { title: 'Governance Approvals', href: '/approvals', iconName: 'CheckSquare' },
    { title: 'Fraud & Security', href: '/fraud-detection', iconName: 'ShieldAlert' },
    { title: 'Blockchain Ledger', href: '/blockchain-explorer', iconName: 'Cpu' },
    { title: 'System Reports', href: '/reports', iconName: 'BarChart3' },
    { title: 'Settings', href: '/settings', iconName: 'Settings' },
  ],
}

export function getNavigationForRole(role?: UserRole | null): NavItem[] {
  if (!role || !(role in ROLE_NAVIGATION)) {
    return ROLE_NAVIGATION.BUYER
  }
  return ROLE_NAVIGATION[role]
}

// Fallback legacy navigation list for backwards compatibility
export const NAVIGATION_ITEMS: NavItem[] = ROLE_NAVIGATION.ADMIN
