import { createContext } from 'react'
import type { NotificationItem } from '@/types/notification'

export interface UIContextType {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  notificationsCount: number
  notifications: NotificationItem[]
  notificationsLoading: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  clearNotifications: () => void
  refetchNotifications: () => void
}

export const UIContext = createContext<UIContextType | undefined>(undefined)
