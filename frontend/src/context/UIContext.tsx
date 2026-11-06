import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UIContext } from './UIContextDef'
import { useAuth } from '@/hooks/useAuth'
import notificationService from '@/services/notificationService'
import type { NotificationItem } from '@/types/notification'

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('propchain_sidebar_collapsed') === 'true'
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false)
  const { user, token } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    localStorage.setItem('propchain_sidebar_collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev)

  const isUserAuthenticated = Boolean(user && token)

  // Fetch unread count, refresh every 30 seconds
  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    queryFn: () => notificationService.getUnreadCount(),
    enabled: isUserAuthenticated,
    refetchInterval: 30000,
  })

  // Fetch latest 10 notifications, refresh every 30 seconds
  const { data: notificationsData, isLoading: notificationsLoading, refetch: refetchList } = useQuery({
    queryKey: ['notifications', 'latest', user?.id],
    queryFn: () => notificationService.getNotifications(false, 10, 0),
    enabled: isUserAuthenticated,
    refetchInterval: 30000,
  })

  const notificationsCount = typeof unreadCountData === 'number' ? unreadCountData : 0
  const notifications: NotificationItem[] = notificationsData || []

  const refetchNotifications = useCallback(() => {
    refetchUnreadCount()
    refetchList()
  }, [refetchUnreadCount, refetchList])

  const markAsRead = useCallback(async (id: string) => {
    await notificationService.markAsRead(id)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [queryClient])

  const markAllAsRead = useCallback(async () => {
    await notificationService.markAllAsRead()
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [queryClient])

  const clearNotifications = useCallback(() => {
    markAllAsRead()
  }, [markAllAsRead])

  return (
    <UIContext.Provider
      value={{
        sidebarCollapsed,
        toggleSidebar,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        notificationsCount,
        notifications,
        notificationsLoading,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        refetchNotifications,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}
