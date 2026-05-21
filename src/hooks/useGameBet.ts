'use client'

import { useState, useCallback, useRef } from 'react'
import { useWalletStore } from '@/store/walletStore'
import { useAuthStore } from '@/store/authStore'
import { getAuthToken } from '@/lib/token'
import toast from 'react-hot-toast'

export type BetCurrency = 'NC' | 'SOL'

export interface BetConfig {
  amount: number
  currency: BetCurrency
}

export interface AutoBetConfig {
  enabled: boolean
  count: number        // 0 = infinite
  remaining: number
  stopOnWin: boolean
  stopOnLoss: boolean
  increaseOnWin: number   // % to increase bet on win (0 = no change)
  increaseOnLoss: number  // % to increase bet on loss
}

export const DEFAULT_AUTO_BET: AutoBetConfig = {
  enabled: false,
  count: 10,
  remaining: 10,
  stopOnWin: false,
  stopOnLoss: false,
  increaseOnWin: 0,
  increaseOnLoss: 0,
}

interface UseGameBetOptions {
  gameType: string
  defaultAmount?: number
  defaultCurrency?: BetCurrency
}

export function useGameBet({ gameType, defaultAmount = 100, defaultCurrency = 'NC' }: UseGameBetOptions) {
  const { user } = useAuthStore()
  const { NC, SOL, setBalance } = useWalletStore()

  const [betAmount, setBetAmount] = useState(defaultAmount)
  const [currency, setCurrency] = useState<BetCurrency>(defaultCurrency)
  const [isLoading, setIsLoading] = useState(false)
  const [autoBet, setAutoBet] = useState<AutoBetConfig>(DEFAULT_AUTO_BET)
  const autoBetRef = useRef<AutoBetConfig>(autoBet)
  autoBetRef.current = autoBet
  const stopAutoBetRef = useRef(false)

  const balance = currency === 'NC' ? NC : SOL

  const canBet = !isLoading && !!user && betAmount > 0 && betAmount <= balance

  const apiCall = useCallback(async (endpoint: string, body: object) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Request failed')
    return json.data
  }, [])

  const syncBalance = useCallback((data: { newNeonCoins?: number; newBalance?: number; newSolBalance?: number }) => {
    if (currency === 'NC' && data.newNeonCoins !== undefined) setBalance('NC', data.newNeonCoins)
    if (currency === 'SOL' && (data.newBalance !== undefined || data.newSolBalance !== undefined)) {
      setBalance('SOL', data.newBalance ?? data.newSolBalance ?? SOL)
    }
  }, [currency, setBalance, SOL])

  const halfBet = useCallback(() => setBetAmount(a => Math.max(1, Math.floor(a / 2))), [])
  const doubleBet = useCallback(() => setBetAmount(a => Math.min(balance, a * 2)), [balance])
  const maxBet = useCallback(() => setBetAmount(balance), [balance])

  const startAutoBet = useCallback((run: () => Promise<{ won: boolean }>) => {
    stopAutoBetRef.current = false
    const cfg = autoBetRef.current

    const loop = async (currentAmount: number, remaining: number) => {
      if (stopAutoBetRef.current) return
      if (cfg.count > 0 && remaining <= 0) {
        setAutoBet(a => ({ ...a, enabled: false, remaining: a.count }))
        return
      }

      try {
        setBetAmount(currentAmount)
        const result = await run()

        if (stopAutoBetRef.current) return

        let nextAmount = currentAmount
        if (result.won) {
          if (cfg.stopOnWin) { stopAutoBet(); return }
          if (cfg.increaseOnWin > 0) nextAmount = Math.round(currentAmount * (1 + cfg.increaseOnWin / 100))
        } else {
          if (cfg.stopOnLoss) { stopAutoBet(); return }
          if (cfg.increaseOnLoss > 0) nextAmount = Math.round(currentAmount * (1 + cfg.increaseOnLoss / 100))
        }

        nextAmount = Math.min(nextAmount, balance)

        setAutoBet(a => ({ ...a, remaining: cfg.count > 0 ? remaining - 1 : 0 }))
        setTimeout(() => loop(nextAmount, remaining - 1), 600)
      } catch {
        stopAutoBet()
      }
    }

    loop(betAmount, cfg.remaining)
  }, [betAmount, balance])

  const stopAutoBet = useCallback(() => {
    stopAutoBetRef.current = true
    setAutoBet(a => ({ ...a, enabled: false }))
  }, [])

  return {
    betAmount, setBetAmount,
    currency, setCurrency,
    isLoading, setIsLoading,
    autoBet, setAutoBet,
    balance, canBet,
    user,
    apiCall, syncBalance,
    halfBet, doubleBet, maxBet,
    startAutoBet, stopAutoBet,
  }
}
