'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  login: (user: User, token: string) => void
  logout: () => void
  updateBalance: (balance: number) => void
  updateNeonCoins: (neonCoins: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setLoading: (isLoading) => set({ isLoading }),
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      updateBalance: (balance) =>
        set((state) => ({
          user: state.user ? { ...state.user, balance } : null,
        })),
      updateNeonCoins: (neonCoins) =>
        set((state) => ({
          user: state.user ? { ...state.user, neonCoins } : null,
        })),
    }),
    {
      name: 'casino-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
)
