import React, { useState, useEffect } from 'react'
import { UIContext } from './UIContextDef'

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('propchain_sidebar_collapsed') === 'true'
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false)
  const [walletConnected, setWalletConnected] = useState<boolean>(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [notificationsCount, setNotificationsCount] = useState<number>(5)

  useEffect(() => {
    localStorage.setItem('propchain_sidebar_collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev)

  const connectWallet = () => {
    setWalletConnected(true)
    setWalletAddress('0x3A9E8b6e3f4211516eB70b138F9B6eFe715697F3')
  }

  const disconnectWallet = () => {
    setWalletConnected(false)
    setWalletAddress(null)
  }

  const clearNotifications = () => setNotificationsCount(0)

  return (
    <UIContext.Provider
      value={{
        sidebarCollapsed,
        toggleSidebar,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        walletConnected,
        walletAddress,
        connectWallet,
        disconnectWallet,
        notificationsCount,
        clearNotifications,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}
