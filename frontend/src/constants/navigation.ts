export interface NavItem {
  title: string
  href: string
  iconName: string
  badge?: string
}

export const NAVIGATION_ITEMS: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
  { title: 'Properties', href: '/properties', iconName: 'Building2' },
  { title: 'Ownership Records', href: '/ownership', iconName: 'FileBadge' },
  { title: 'Deals & Escrow', href: '/transactions', iconName: 'ArrowLeftRight' },
  { title: 'Verify Documents', href: '/documents', iconName: 'FileCheck2' },
  { title: 'Approvals', href: '/approvals', iconName: 'CheckSquare', badge: '3' },
  { title: 'Fraud & Security', href: '/fraud-detection', iconName: 'ShieldAlert', badge: '2' },
  { title: 'Blockchain Ledger', href: '/blockchain-explorer', iconName: 'Cpu' },
  { title: 'Reports', href: '/reports', iconName: 'BarChart3' },
  { title: 'Settings', href: '/settings', iconName: 'Settings' },
]

