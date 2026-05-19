'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, type ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'

function BalanceSyncer() {
  const userId = useAuthStore((s) => s.user?.id)
  const user = useAuthStore((s) => s.user)
  const initBalances = useWalletStore((s) => s.initBalances)
  useEffect(() => {
    // Only sync when a NEW user logs in — never overwrite mid-session balances
    if (user) initBalances(user.neonCoins ?? 0, user.solBalance ?? 0)
  }, [userId]) // eslint-disable-line
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
          mutations: { retry: 0 },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <BalanceSyncer />
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(15, 15, 25, 0.95)',
            color: '#f8fafc',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#f8fafc' },
          },
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  )
}
