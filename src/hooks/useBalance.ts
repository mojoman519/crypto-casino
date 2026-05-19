'use client'

import { useWalletStore } from '@/store/walletStore'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'
import type { Currency, GameType } from '@/types/transactions'

export function useBalance(currency: Currency) {
  const store = useWalletStore()
  const balance = store[currency] ?? 0
  const isLoading = store.isUpdatingBalance

  const canAfford = (amount: number) => balance >= amount && amount > 0

  const placeBet = async <T>(
    amount: number,
    gameType: GameType,
    action: () => Promise<{ won: boolean; winAmount: number; data: T; serverBalance?: number }>
  ): Promise<{ won: boolean; winAmount: number; data: T }> => {
    if (!canAfford(amount)) throw new Error('Insufficient balance')

    const pendingId = store.deductBalance(amount, currency, `${gameType} bet`, gameType)

    try {
      const result = await action()

      if (result.won && result.winAmount > 0) {
        store.creditBalance(result.winAmount, currency, `${gameType} win`, pendingId, gameType)
      } else {
        useWalletStore.setState((state) => ({
          isUpdatingBalance: false,
          transactions: state.transactions.map((t) =>
            t.id === pendingId
              ? { ...t, type: 'LOSS' as const, status: 'confirmed' as const }
              : t
          ),
        }))
      }

      // Sync exact server balance to prevent any drift
      if (result.serverBalance !== undefined) {
        store.setBalance(currency, result.serverBalance)
      }

      return result
    } catch (err) {
      store.rollbackBalance(pendingId)
      throw err
    }
  }

  return { balance, isLoading, canAfford, placeBet }
}

// Syncs wallet store balances from auth user on login
export function useBalanceSync() {
  const user = useAuthStore((s) => s.user)
  const initBalances = useWalletStore((s) => s.initBalances)

  useEffect(() => {
    if (user) {
      initBalances(
        user.neonCoins ?? 0,
        user.solBalance ?? 0,
        0,
        0
      )
    }
  }, [user?.id]) // eslint-disable-line
}
