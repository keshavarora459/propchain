import { useState } from 'react'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UIProvider } from '@/context/UIContext'
import { AuthProvider } from '@/context/AuthContext'
import { WalletProvider } from '@/context/WalletContext'
import { AppRoutes } from '@/routes/AppRoutes'
import './index.css'

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WalletProvider>
          <UIProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </UIProvider>
        </WalletProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
