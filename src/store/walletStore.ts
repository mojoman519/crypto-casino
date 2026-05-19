'use client'

import { create } from 'zustand'
import type { Chain, Wallet } from '@/types'

interface WalletState {
  connectedWallet: Wallet | null
  isConnecting: boolean
  isWalletModalOpen: boolean
  isDepositModalOpen: boolean
  isWithdrawModalOpen: boolean
  selectedChain: Chain
  setConnectedWallet: (wallet: Wallet | null) => void
  setConnecting: (connecting: boolean) => void
  openWalletModal: () => void
  closeWalletModal: () => void
  openDepositModal: () => void
  closeDepositModal: () => void
  openWithdrawModal: () => void
  closeWithdrawModal: () => void
  setSelectedChain: (chain: Chain) => void
}

export const useWalletStore = create<WalletState>((set) => ({
  connectedWallet: null,
  isConnecting: false,
  isWalletModalOpen: false,
  isDepositModalOpen: false,
  isWithdrawModalOpen: false,
  selectedChain: 'SOLANA',
  setConnectedWallet: (connectedWallet) => set({ connectedWallet }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  openWalletModal: () => set({ isWalletModalOpen: true }),
  closeWalletModal: () => set({ isWalletModalOpen: false }),
  openDepositModal: () => set({ isDepositModalOpen: true }),
  closeDepositModal: () => set({ isDepositModalOpen: false }),
  openWithdrawModal: () => set({ isWithdrawModalOpen: true }),
  closeWithdrawModal: () => set({ isWithdrawModalOpen: false }),
  setSelectedChain: (selectedChain) => set({ selectedChain }),
}))
