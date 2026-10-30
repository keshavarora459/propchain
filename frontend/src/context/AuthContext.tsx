import React, { createContext, useEffect, useState, useCallback } from 'react'
import type { LoginRequest, RegisterRequest, User } from '@/types/auth'
import authService from '@/services/authService'

export interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (data: { full_name?: string; phone_number?: string }) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('propchain_token'))
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Initialize and verify authentication state on mount
  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem('propchain_token')
    if (!storedToken) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const currentUser = await authService.getMe()
      setUser(currentUser)
      setToken(storedToken)
    } catch {
      // If /me fails, attempt silent refresh before clearing
      try {
        const storedRefresh = localStorage.getItem('propchain_refresh_token')
        const refreshed = await authService.refresh(storedRefresh || undefined)
        localStorage.setItem('propchain_token', refreshed.access_token)
        if (refreshed.refresh_token) {
          localStorage.setItem('propchain_refresh_token', refreshed.refresh_token)
        }
        setToken(refreshed.access_token)
        setUser(refreshed.user)
      } catch {
        localStorage.removeItem('propchain_token')
        localStorage.removeItem('propchain_refresh_token')
        setUser(null)
        setToken(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true)
    try {
      const response = await authService.login(credentials)
      localStorage.setItem('propchain_token', response.access_token)
      if (response.refresh_token) {
        localStorage.setItem('propchain_refresh_token', response.refresh_token)
      }
      setToken(response.access_token)
      setUser(response.user)
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (data: RegisterRequest) => {
    setIsLoading(true)
    try {
      await authService.register(data)
      // Automatically log in newly registered user
      await login({ email: data.email, password: data.password })
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      const storedRefresh = localStorage.getItem('propchain_refresh_token')
      await authService.logout(storedRefresh || undefined)
    } catch (err) {
      console.warn('Logout network error (clearing local state):', err)
    } finally {
      localStorage.removeItem('propchain_token')
      localStorage.removeItem('propchain_refresh_token')
      setUser(null)
      setToken(null)
      setIsLoading(false)
    }
  }

  const updateProfile = async (data: { full_name?: string; phone_number?: string }) => {
    const updated = await authService.updateMe(data)
    setUser(updated)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
export default AuthContext
