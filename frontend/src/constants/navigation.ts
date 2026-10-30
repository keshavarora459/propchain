export interface NavItem {
  title: string
  href: string
  iconName: string
  badge?: string
}

export const NAVIGATION_ITEMS: NavItem[] = [
  { title: 'Overview', href: '/dashboard', iconName: 'LayoutDashboard' },
  { title: 'Properties', href: '/properties', iconName: 'Building2' },
  { title: 'Ownership Registry', href: '/ownership', iconName: 'FileBadge' },
  { title: 'Transactions', href: '/transactions', iconName: 'ArrowLeftRight' },
  { title: 'Document Verification', href: '/documents', iconName: 'FileCheck2' },
  { title: 'Approvals', href: '/approvals', iconName: 'CheckSquare', badge: '3' },
  { title: 'Fraud Detection', href: '/fraud-detection', iconName: 'ShieldAlert', badge: '2' },
  { title: 'Blockchain Explorer', href: '/blockchain-explorer', iconName: 'Cpu' },
  { title: 'Reports', href: '/reports', iconName: 'BarChart3' },
  { title: 'Settings', href: '/settings', iconName: 'Settings' },
]

