'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RotateCcw, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { useWalletStore } from '@/store/walletStore'
import type { BetCurrency, AutoBetConfig } from '@/hooks/useGameBet'

interface BettingPanelProps {
  betAmount: number
  setBetAmount: (v: number) => void
  currency: BetCurrency
  setCurrency: (c: BetCurrency) => void
  isLoading: boolean
  canBet: boolean
  autoBet: AutoBetConfig
  setAutoBet: (a: AutoBetConfig | ((prev: AutoBetConfig) => AutoBetConfig)) => void
  onBet: (() => void) | undefined
  onStopAutoBet?: () => void
  actionLabel?: string
  actionColor?: string
  disabled?: boolean
  children?: React.ReactNode // game-specific controls
}

const QUICK_AMOUNTS_NC = [100, 500, 1_000, 5_000, 10_000, 50_000]
const QUICK_AMOUNTS_SOL = [0.01, 0.05, 0.1, 0.5, 1, 5]

export function BettingPanel({
  betAmount, setBetAmount,
  currency, setCurrency,
  isLoading, canBet,
  autoBet, setAutoBet,
  onBet, onStopAutoBet,
  actionLabel = 'Bet',
  actionColor,
  disabled,
  children,
}: BettingPanelProps) {
  const { NC, SOL, openWalletModal } = useWalletStore()
  const [showAutoBet, setShowAutoBet] = useState(false)

  const balance = currency === 'NC' ? NC : SOL
  const quickAmounts = currency === 'NC' ? QUICK_AMOUNTS_NC : QUICK_AMOUNTS_SOL

  const handleAmount = (v: string) => {
    const n = parseFloat(v)
    if (!isNaN(n) && n >= 0) setBetAmount(n)
  }

  const isAutoBetActive = autoBet.enabled && isLoading

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-3 p-4 bg-[#0d0d18] border-r border-white/[0.06] h-full overflow-y-auto">

      {/* Currency toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04]">
        {(['NC', 'SOL'] as BetCurrency[]).map(c => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
              currency === c ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white/70'
            )}
          >
            {c === 'NC' ? '🎮 NC' : '◎ SOL'}
          </button>
        ))}
      </div>

      {/* Balance */}
      <div className="px-1">
        <AnimatedBalance currency={currency} balance={balance} size="sm" />
        {balance === 0 && (
          <button onClick={openWalletModal} className="text-xs text-purple-400 hover:text-purple-300 mt-1">
            + Add funds
          </button>
        )}
      </div>

      {/* Bet amount */}
      <div>
        <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">Bet Amount</label>
        <div className="relative">
          <Input
            type="number"
            value={betAmount}
            onChange={e => handleAmount(e.target.value)}
            min={0}
            className="pr-20 font-mono font-bold"
            disabled={isAutoBetActive}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
            <button
              onClick={() => setBetAmount(Math.max(1, Math.floor(betAmount / 2)))}
              className="px-2 py-1 text-xs text-white/50 hover:text-white rounded hover:bg-white/10 transition-all"
              disabled={isAutoBetActive}
            >½</button>
            <button
              onClick={() => setBetAmount(Math.min(balance, betAmount * 2))}
              className="px-2 py-1 text-xs text-white/50 hover:text-white rounded hover:bg-white/10 transition-all"
              disabled={isAutoBetActive}
            >2×</button>
          </div>
        </div>

        {/* Quick amounts */}
        <div className="grid grid-cols-3 gap-1 mt-1.5">
          {quickAmounts.map(a => (
            <button
              key={a}
              onClick={() => setBetAmount(a)}
              disabled={isAutoBetActive}
              className={cn(
                'py-1 text-xs rounded-lg border transition-all',
                betAmount === a
                  ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/80 hover:border-white/20'
              )}
            >
              {currency === 'NC'
                ? a >= 1000 ? `${a / 1000}K` : a
                : a}
            </button>
          ))}
        </div>
      </div>

      {/* Max bet */}
      <button
        onClick={() => setBetAmount(balance)}
        disabled={isAutoBetActive}
        className="text-xs text-white/30 hover:text-white/60 text-left transition-colors"
      >
        Max: {currency === 'NC' ? NC.toLocaleString() : SOL} {currency}
      </button>

      {/* Game-specific controls */}
      {children && <div className="border-t border-white/[0.06] pt-3">{children}</div>}

      {/* Auto-bet toggle */}
      <div className="border-t border-white/[0.06] pt-3">
        <button
          onClick={() => setShowAutoBet(s => !s)}
          className="flex items-center justify-between w-full text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Auto Bet
          </span>
          {showAutoBet ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <AnimatePresence>
          {showAutoBet && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3 space-y-2"
            >
              <div>
                <label className="text-[11px] text-white/40 mb-1 block">Number of Bets (0 = ∞)</label>
                <Input
                  type="number"
                  value={autoBet.count}
                  onChange={e => setAutoBet(a => ({ ...a, count: Math.max(0, parseInt(e.target.value) || 0), remaining: Math.max(0, parseInt(e.target.value) || 0) }))}
                  min={0}
                  disabled={isAutoBetActive}
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBet.stopOnWin}
                    onChange={e => setAutoBet(a => ({ ...a, stopOnWin: e.target.checked }))}
                    disabled={isAutoBetActive}
                    className="accent-purple-500"
                  />
                  <span className="text-xs text-white/50">Stop on Win</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBet.stopOnLoss}
                    onChange={e => setAutoBet(a => ({ ...a, stopOnLoss: e.target.checked }))}
                    disabled={isAutoBetActive}
                    className="accent-purple-500"
                  />
                  <span className="text-xs text-white/50">Stop on Loss</span>
                </label>
              </div>
              <button
                onClick={() => setAutoBet(a => ({ ...a, enabled: !a.enabled }))}
                className={cn(
                  'w-full py-1.5 rounded-lg text-xs font-bold transition-all border',
                  autoBet.enabled
                    ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                    : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80'
                )}
              >
                {autoBet.enabled ? '✓ Auto Bet On' : 'Enable Auto Bet'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="mt-auto pt-2">
        {isAutoBetActive ? (
          <Button
            onClick={onStopAutoBet}
            className="w-full h-14 text-base font-black bg-red-600 hover:bg-red-500"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Stop Auto ({autoBet.count > 0 ? `${autoBet.remaining} left` : '∞'})
          </Button>
        ) : (
          <Button
            onClick={onBet ?? undefined}
            disabled={!canBet || disabled || !onBet}
            className={cn(
              'w-full h-14 text-base font-black transition-all',
              actionColor ?? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400',
              (!canBet || disabled) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                {autoBet.enabled ? `Auto ${actionLabel}` : actionLabel}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
