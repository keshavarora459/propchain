import { createContext } from 'react'

export interface UIContextType {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  walletConnected: boolean
  walletAddress: string | null
  connectWallet: () => void
  disconnectWallet: () => void
  notificationsCount: number
  clearNotifications: () => void
}

export const UIContext = createContext<UIContextType | undefined>(undefined)

