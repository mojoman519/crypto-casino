'use client'

import { useState, useCallback, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { useBalance } from '@/hooks/useBalance'
import { useGameLock } from '@/hooks/useGameLock'
import { useSounds } from '@/hooks/useSounds'
import { getAuthToken } from '@/lib/token'
import { fireWinCelebration } from '@/components/effects/CelebrationOverlay'
import { formatBalance } from '@/lib/currency'
import { PlayModeToggle } from '@/components/shared/PlayModeToggle'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Currency } from '@/types/transactions'

// Outcome ranges (out of 100)
// Red: 0-47 (48%), Black: 48-95 (48%), Green: 96-99 (4%)
type Outcome = 'red' | 'black' | 'green'
const PAYOUTS: Record<Outcome, number> = { red: 2, black: 2, green: 24 }
const CHANCES: Record<Outcome, number> = { red: 48, black: 48, green: 4 }

const OUTCOME_STYLES: Record<Outcome, { bg: string; border: string; text: string; label: string; icon: string }> = {
  red:   { bg: 'bg-red-600/80',   border: 'border-red-500',   text: 'text-red-200',   label: 'Red',   icon: '🔴' },
  black: { bg: 'bg-slate-700/80', border: 'border-slate-500', text: 'text-slate-200', label: 'Black', icon: '⚫' },
  green: { bg: 'bg-emerald-600/80', border: 'border-emerald-500', text: 'text-emerald-200', label: 'Green', icon: '🟢' },
}

const WHEEL_SEGMENTS: Outcome[] = [
  'red','black','red','black','red','black','red','black',
  'red','black','red','black','red','black','red','black',
  'red','black','red','black','red','black','red','black',
  'green','black','red','black','red','green',
]

const BET_PRESETS = [10, 25, 50, 100, 250, 500]

interface HistoryEntry { outcome: Outcome; amount: number; won: boolean; payout: number }

export const RouletteGame = memo(function RouletteGame() {
  const { user } = useAuthStore()
  const { openWalletModal } = useWalletStore()
  const [playMode, setPlayMode] = useState<'neon' | 'real'>('neon')
  const currency: Currency = playMode === 'neon' ? 'NC' : 'SOL'
  const { balance, canAfford, placeBet } = useBalance(currency)
  const { isLocked, withLock } = useGameLock()
  const sounds = useSounds()

  const [betAmount, setBetAmount] = useState('10')
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>('red')
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Outcome | null>(null)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const currentRotRef = useRef(0)

  const parsedBet = parseFloat(betAmount) || 0
  const potentialWin = parsedBet * PAYOUTS[selectedOutcome]
  const winChance = CHANCES[selectedOutcome]

  const handleSpin = useCallback(async () => {
    if (!user) { openWalletModal(); return }
    if (!parsedBet || !canAfford(parsedBet) || isLocked) return

    setSpinning(true)
    setResult(null)
    sounds.playRouletteSpin()

    await withLock(async () => {
      try {
        sounds.playBet()
        const gameResult = await placeBet(parsedBet, 'COINFLIP', async () => {
          const res = await fetch('/api/games/roulette', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
            body: JSON.stringify({ betAmount: parsedBet, choice: selectedOutcome, mode: playMode }),
          })
          if (!res.ok) {
            const { error } = await res.json()
            throw new Error(error)
          }
          const { data } = await res.json()
          return {
            won: data.won,
            winAmount: data.winAmount,
            data,
            serverBalance: currency === 'NC' ? data.newNeonCoins : data.newBalance,
          }
        })

        const outcomeResult: Outcome = gameResult.data.result

        // Spin wheel to land on result
        const segmentAngle = 360 / WHEEL_SEGMENTS.length
        const resultSegmentIdx = WHEEL_SEGMENTS.lastIndexOf(outcomeResult)
        const targetAngle = resultSegmentIdx * segmentAngle
        const spins = 5 + Math.floor(Math.random() * 3)
        const finalRotation = currentRotRef.current + spins * 360 + (360 - targetAngle)
        currentRotRef.current = finalRotation % 360

        setWheelRotation(finalRotation)

        // Wait for animation
        await new Promise(r => setTimeout(r, 3200))

        setResult(outcomeResult)
        setSpinning(false)

        if (gameResult.won) {
          sounds.playWin()
          toast.success(`🎉 ${outcomeResult.toUpperCase()}! Won ${formatBalance(gameResult.winAmount, currency)}!`, { duration: 5000 })
          fireWinCelebration({ amount: gameResult.winAmount })
        } else {
          sounds.playLose()
          toast.error(`${outcomeResult.toUpperCase()} — Lost ${formatBalance(parsedBet, currency)}`)
        }

        setHistory(prev => [{
          outcome: outcomeResult,
          amount: parsedBet,
          won: gameResult.won,
          payout: gameResult.winAmount,
        }, ...prev].slice(0, 20))

        setTimeout(() => setResult(null), 3000)
      } catch (err: unknown) {
        setSpinning(false)
        toast.error(err instanceof Error ? err.message : 'Game failed')
      }
    })
  }, [user, parsedBet, canAfford, isLocked, selectedOutcome, playMode, currency, placeBet, withLock, sounds, openWalletModal])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PlayModeToggle mode={playMode} onChange={setPlayMode} />

      {/* Wheel */}
      <div className="glass-card p-6 flex flex-col items-center gap-4">
        <div className="relative">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 text-xl">▼</div>

          <motion.div
            className="w-52 h-52 sm:w-64 sm:h-64 rounded-full relative overflow-hidden border-4 border-white/10"
            animate={{ rotate: wheelRotation }}
            transition={{ duration: 3, ease: [0.17, 0.67, 0.34, 0.99] }}
          >
            {WHEEL_SEGMENTS.map((seg, i) => {
              const angle = (360 / WHEEL_SEGMENTS.length) * i
              const colors = { red: '#dc2626', black: '#1e293b', green: '#059669' }
              return (
                <div
                  key={i}
                  className="absolute inset-0 origin-center"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.tan(Math.PI / WHEEL_SEGMENTS.length)}% 0%)`,
                    backgroundColor: colors[seg],
                    opacity: 0.9,
                  }}
                />
              )
            })}
            {/* Center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-background border-2 border-white/20 flex items-center justify-center text-xl">
                🎡
              </div>
            </div>
          </motion.div>
        </div>

        {/* Result flash */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className={cn('px-6 py-3 rounded-2xl font-black text-xl border-2', OUTCOME_STYLES[result].bg, OUTCOME_STYLES[result].border, OUTCOME_STYLES[result].text)}
            >
              {OUTCOME_STYLES[result].icon} {OUTCOME_STYLES[result].label.toUpperCase()}!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Betting panel */}
      <div className="glass-card p-5 space-y-4">
        {/* Choose outcome */}
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Bet on</label>
          <div className="grid grid-cols-3 gap-2">
            {(['red', 'black', 'green'] as Outcome[]).map(o => (
              <button key={o} onClick={() => setSelectedOutcome(o)} disabled={spinning}
                className={cn(
                  'flex flex-col items-center py-3 rounded-xl border-2 font-bold text-sm transition-all duration-200',
                  selectedOutcome === o
                    ? cn(OUTCOME_STYLES[o].bg, OUTCOME_STYLES[o].border, OUTCOME_STYLES[o].text)
                    : 'bg-white/[0.03] border-white/10 text-white/50 hover:border-white/30'
                )}>
                <span className="text-2xl mb-1">{OUTCOME_STYLES[o].icon}</span>
                <span>{OUTCOME_STYLES[o].label}</span>
                <span className="text-xs opacity-70">{CHANCES[o]}% • {PAYOUTS[o]}×</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bet amount */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-white/40 uppercase tracking-widest">Amount</label>
            <AnimatedBalance currency={currency} balance={balance} size="sm" />
          </div>
          <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)}
            disabled={spinning} className="bet-input w-full h-12 text-xl font-bold text-center"
            inputMode="decimal" />
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {BET_PRESETS.map(p => (
              <button key={p} onClick={() => setBetAmount(String(p))} disabled={spinning}
                className="py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                {currency === 'NC' ? p.toLocaleString() : p}
              </button>
            ))}
          </div>
        </div>

        {/* Potential win */}
        {parsedBet > 0 && (
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between text-sm">
            <span className="text-white/40">Win chance / Potential win</span>
            <span className="font-bold">
              <span className="text-white/60">{winChance}%</span>
              <span className="mx-2 text-white/20">/</span>
              <span className="text-emerald-400">{formatBalance(potentialWin, currency)}</span>
            </span>
          </div>
        )}

        <Button variant="neon" className="w-full h-14 text-lg font-black" onClick={handleSpin}
          disabled={spinning || isLocked || !parsedBet || !canAfford(parsedBet)}>
          {spinning
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Spinning...</>
            : `🎡 Spin ${formatBalance(parsedBet || 0, currency)}`}
        </Button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card p-4">
          <div className="text-xs text-white/30 uppercase tracking-widest mb-3">Recent spins</div>
          <div className="flex gap-1.5 flex-wrap">
            {history.map((h, i) => (
              <div key={i} className={cn(
                'px-2 py-1 rounded-lg text-xs font-bold border',
                h.won ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
              )}>
                {OUTCOME_STYLES[h.outcome].icon}
                {h.won ? ` +${formatBalance(h.payout, currency)}` : ` -${formatBalance(h.amount, currency)}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
