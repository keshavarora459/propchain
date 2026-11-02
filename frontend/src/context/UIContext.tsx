import React, { useState, useEffect } from 'react'
import { UIContext } from './UIContextDef'

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('propchain_sidebar_collapsed') === 'true'
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false)
  const [notificationsCount, setNotificationsCount] = useState<number>(5)

  useEffect(() => {
    localStorage.setItem('propchain_sidebar_collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev)
  const clearNotifications = () => setNotificationsCount(0)

  return (
    <UIContext.Provider
      value={{
        sidebarCollapsed,
        toggleSidebar,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        notificationsCount,
        clearNotifications,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}
