'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Currency, WalletTransaction, GameType } from '@/types/transactions'
import type { Chain, Wallet } from '@/types'

interface WalletState {
  // Connected wallet
  connectedWallet: Wallet | null
  isConnecting: boolean

  // Modal state
  isWalletModalOpen: boolean
  isDepositModalOpen: boolean
  isWithdrawModalOpen: boolean
  selectedChain: Chain

  // Balances
  NC: number
  SOL: number
  ETH: number
  USDC: number

  // Transaction history (persisted, last 100)
  transactions: WalletTransaction[]

  // Loading
  isUpdatingBalance: boolean

  // Wallet modal actions
  setConnectedWallet: (wallet: Wallet | null) => void
  setConnecting: (connecting: boolean) => void
  openWalletModal: () => void
  closeWalletModal: () => void
  openDepositModal: () => void
  closeDepositModal: () => void
  openWithdrawModal: () => void
  closeWithdrawModal: () => void
  setSelectedChain: (chain: Chain) => void

  // Balance actions
  initBalances: (nc: number, sol: number, eth?: number, usdc?: number) => void
  getBalance: (currency: Currency) => number

  // Optimistic bet flow
  deductBalance: (amount: number, currency: Currency, description: string, gameType?: GameType) => string
  creditBalance: (amount: number, currency: Currency, description: string, pendingId: string, gameType?: GameType) => void
  rollbackBalance: (pendingId: string) => void

  // Direct updates (from server)
  setBalance: (currency: Currency, amount: number) => void

  // Deposit / withdrawal
  applyDeposit: (amount: number, currency: Currency) => void
  applyWithdrawal: (amount: number, currency: Currency) => void

  // History
  getRecentTransactions: (limit?: number) => WalletTransaction[]
  clearHistory: () => void
}

// Pending rollbacks: pendingId → { currency, amount }
const pendingRollbacks = new Map<string, { currency: Currency; amount: number }>()

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Wallet connection
      connectedWallet: null,
      isConnecting: false,
      isWalletModalOpen: false,
      isDepositModalOpen: false,
      isWithdrawModalOpen: false,
      selectedChain: 'SOLANA',

      // Balances
      NC: 0,
      SOL: 0,
      ETH: 0,
      USDC: 0,

      transactions: [],
      isUpdatingBalance: false,

      // ─── Wallet modal ────────────────────────────────────────────────
      setConnectedWallet: (connectedWallet) => set({ connectedWallet }),
      setConnecting: (isConnecting) => set({ isConnecting }),
      openWalletModal: () => set({ isWalletModalOpen: true }),
      closeWalletModal: () => set({ isWalletModalOpen: false }),
      openDepositModal: () => set({ isDepositModalOpen: true }),
      closeDepositModal: () => set({ isDepositModalOpen: false }),
      openWithdrawModal: () => set({ isWithdrawModalOpen: true }),
      closeWithdrawModal: () => set({ isWithdrawModalOpen: false }),
      setSelectedChain: (selectedChain) => set({ selectedChain }),

      // ─── Balance helpers ─────────────────────────────────────────────
      initBalances: (nc, sol, eth = 0, usdc = 0) =>
        set({ NC: Math.max(0, nc), SOL: Math.max(0, sol), ETH: Math.max(0, eth), USDC: Math.max(0, usdc) }),

      getBalance: (currency) => {
        const s = get()
        return s[currency] ?? 0
      },

      setBalance: (currency, amount) =>
        set({ [currency]: Math.max(0, amount) }),

      // ─── Optimistic deduction ────────────────────────────────────────
      deductBalance: (amount, currency, description, gameType) => {
        const pendingId = nanoid()
        set((state) => {
          const current = state[currency] ?? 0
          const newBalance = Math.max(0, current - amount)
          const tx: WalletTransaction = {
            id: pendingId,
            type: 'BET',
            currency,
            amount,
            description,
            timestamp: Date.now(),
            gameType,
            balanceAfter: newBalance,
            status: 'pending',
          }
          return {
            [currency]: newBalance,
            isUpdatingBalance: true,
            transactions: [tx, ...state.transactions].slice(0, 100),
          }
        })
        pendingRollbacks.set(pendingId, { currency, amount })
        return pendingId
      },

      // ─── Credit on win ───────────────────────────────────────────────
      creditBalance: (amount, currency, description, pendingId, gameType) => {
        pendingRollbacks.delete(pendingId)
        set((state) => {
          const current = state[currency] ?? 0
          const newBalance = current + amount
          const tx: WalletTransaction = {
            id: nanoid(),
            type: 'WIN',
            currency,
            amount,
            description,
            timestamp: Date.now(),
            gameType,
            balanceAfter: newBalance,
            status: 'confirmed',
          }
          // Mark pending tx confirmed
          const updatedTxs = state.transactions.map((t) =>
            t.id === pendingId ? { ...t, status: 'confirmed' as const } : t
          )
          return {
            [currency]: newBalance,
            isUpdatingBalance: false,
            transactions: [tx, ...updatedTxs].slice(0, 100),
          }
        })
      },

      // ─── Rollback on failure ─────────────────────────────────────────
      rollbackBalance: (pendingId) => {
        const rollback = pendingRollbacks.get(pendingId)
        if (!rollback) return
        pendingRollbacks.delete(pendingId)
        set((state) => {
          const current = state[rollback.currency] ?? 0
          const restored = current + rollback.amount
          const updatedTxs = state.transactions.map((t) =>
            t.id === pendingId ? { ...t, status: 'rolled_back' as const } : t
          )
          return {
            [rollback.currency]: restored,
            isUpdatingBalance: false,
            transactions: updatedTxs,
          }
        })
      },

      // ─── Deposit / withdrawal ────────────────────────────────────────
      applyDeposit: (amount, currency) => {
        set((state) => {
          const newBalance = (state[currency] ?? 0) + amount
          const tx: WalletTransaction = {
            id: nanoid(),
            type: 'DEPOSIT',
            currency,
            amount,
            description: `Deposited ${amount} ${currency}`,
            timestamp: Date.now(),
            balanceAfter: newBalance,
            status: 'confirmed',
          }
          return {
            [currency]: newBalance,
            transactions: [tx, ...state.transactions].slice(0, 100),
          }
        })
      },

      applyWithdrawal: (amount, currency) => {
        set((state) => {
          const newBalance = Math.max(0, (state[currency] ?? 0) - amount)
          const tx: WalletTransaction = {
            id: nanoid(),
            type: 'WITHDRAWAL',
            currency,
            amount,
            description: `Withdrew ${amount} ${currency}`,
            timestamp: Date.now(),
            balanceAfter: newBalance,
            status: 'confirmed',
          }
          return {
            [currency]: newBalance,
            transactions: [tx, ...state.transactions].slice(0, 100),
          }
        })
      },

      getRecentTransactions: (limit = 20) => get().transactions.slice(0, limit),
      clearHistory: () => set({ transactions: [] }),
    }),
    {
      name: 'neonbet-wallet',
      partialize: (state) => ({
        NC: state.NC,
        SOL: state.SOL,
        ETH: state.ETH,
        USDC: state.USDC,
        transactions: state.transactions.slice(0, 50),
        connectedWallet: state.connectedWallet,
      }),
    }
  )
)
