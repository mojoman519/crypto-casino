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
import { formatBalance } from '@/lib/currency'
import { PlayModeToggle } from '@/components/shared/PlayModeToggle'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Currency } from '@/types/transactions'

const HOUSE_EDGE = 0.04
const MIN_TARGET = 2
const MAX_TARGET = 98

type Direction = 'over' | 'under'

function getWinChance(target: number, dir: Direction): number {
  return dir === 'over' ? 99 - target : target - 1
}

function getPayout(target: number, dir: Direction): number {
  const chance = getWinChance(target, dir) / 100
  if (chance <= 0) return 0
  return parseFloat(((1 - HOUSE_EDGE) / chance).toFixed(4))
}

const BET_PRESETS = [10, 25, 50, 100]

interface DiceRoll { result: number; won: boolean; target: number; dir: Direction }

export const DiceGame = memo(function DiceGame() {
  const { user } = useAuthStore()
  const { openWalletModal } = useWalletStore()
  const [playMode, setPlayMode] = useState<'neon' | 'real'>('neon')
  const currency: Currency = playMode === 'neon' ? 'NC' : 'SOL'
  const { balance, canAfford, placeBet } = useBalance(currency)
  const { isLocked, withLock } = useGameLock()
  const sounds = useSounds()

  const [betAmount, setBetAmount] = useState('10')
  const [target, setTarget] = useState(50)
  const [direction, setDirection] = useState<Direction>('over')
  const [rolling, setRolling] = useState(false)
  const [displayResult, setDisplayResult] = useState<number | null>(null)
  const [rollingDisplay, setRollingDisplay] = useState<number | null>(null)
  const [history, setHistory] = useState<DiceRoll[]>([])
  const rollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const parsedBet = parseFloat(betAmount) || 0
  const winChance = getWinChance(target, direction)
  const payout = getPayout(target, direction)
  const potentialWin = parsedBet * payout

  const handleRoll = useCallback(async () => {
    if (!user) { openWalletModal(); return }
    if (!parsedBet || !canAfford(parsedBet) || isLocked || winChance <= 0) return

    setRolling(true)
    setDisplayResult(null)
    sounds.playDiceRoll()

    // Fast rolling display animation
    if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current)
    rollingIntervalRef.current = setInterval(() => {
      setRollingDisplay(Math.floor(Math.random() * 100))
    }, 60)

    await withLock(async () => {
      try {
        const gameResult = await placeBet(parsedBet, 'COINFLIP', async () => {
          const res = await fetch('/api/games/dice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
            body: JSON.stringify({ betAmount: parsedBet, target, direction, mode: playMode }),
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

        // Stop rolling animation and show result
        if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current)
        setRollingDisplay(null)
        setRolling(false)

        const roll = gameResult.data.result as number
        setDisplayResult(roll)

        if (gameResult.won) {
          sounds.playWin()
          toast.success(`🎲 Rolled ${roll}! Won ${formatBalance(gameResult.winAmount, currency)}!`, { duration: 4000 })
        } else {
          sounds.playLose()
          toast.error(`🎲 Rolled ${roll} — Lost ${formatBalance(parsedBet, currency)}`)
        }

        setHistory(prev => [
          { result: roll, won: gameResult.won, target, dir: direction },
          ...prev,
        ].slice(0, 20))

        setTimeout(() => setDisplayResult(null), 4000)
      } catch (err: unknown) {
        if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current)
        setRollingDisplay(null)
        setRolling(false)
        toast.error(err instanceof Error ? err.message : 'Game failed')
      }
    })
  }, [user, parsedBet, canAfford, isLocked, target, direction, playMode, currency, winChance, placeBet, withLock, sounds, openWalletModal])

  const clampedTarget = Math.max(MIN_TARGET, Math.min(MAX_TARGET, target))

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PlayModeToggle mode={playMode} onChange={setPlayMode} />

      {/* Dice display */}
      <div className="glass-card p-8 flex flex-col items-center gap-4">
        {/* Big number display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={displayResult ?? (rolling ? 'rolling' : 'idle')}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-center"
          >
            {rolling || rollingDisplay !== null ? (
              <div>
                <div className="text-8xl font-black text-white/40 font-mono tabular-nums w-32 text-center">
                  {rollingDisplay ?? '??'}
                </div>
                <div className="text-white/30 text-sm mt-2 animate-pulse">Rolling...</div>
              </div>
            ) : displayResult !== null ? (
              <div>
                <div className={cn(
                  'text-8xl font-black font-mono tabular-nums w-32 text-center',
                  displayResult > target && direction === 'over' ? 'text-emerald-400' :
                  displayResult < target && direction === 'under' ? 'text-emerald-400' :
                  'text-red-400'
                )}>
                  {displayResult}
                </div>
                <div className={cn(
                  'text-lg font-bold mt-2',
                  (direction === 'over' ? displayResult > target : displayResult < target) ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {(direction === 'over' ? displayResult > target : displayResult < target) ? '🎉 WIN!' : '💸 LOSS'}
                </div>
              </div>
            ) : (
              <div className="text-8xl font-black text-white/10 font-mono w-32 text-center">?</div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Target indicator bar */}
        <div className="w-full max-w-sm relative">
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-200',
                direction === 'over'
                  ? 'bg-gradient-to-r from-transparent via-transparent to-emerald-500'
                  : 'bg-gradient-to-r from-emerald-500 to-transparent'
              )}
              style={{
                width: `${direction === 'over' ? (99 - clampedTarget) : (clampedTarget - 1)}%`,
                marginLeft: direction === 'over' ? `${clampedTarget}%` : '0',
              }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-6 bg-white rounded-sm shadow-lg transition-all duration-200"
            style={{ left: `calc(${clampedTarget}% - 8px)` }}
          />
          <div className="flex justify-between text-xs text-white/20 mt-1">
            <span>0</span><span>Target: {clampedTarget}</span><span>99</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-card p-5 space-y-4">
        {/* Over / Under */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/5">
          {(['over', 'under'] as Direction[]).map(d => (
            <button key={d} onClick={() => setDirection(d)} disabled={rolling}
              className={cn(
                'py-2.5 rounded-lg font-bold text-sm transition-all duration-200 capitalize',
                direction === d ? 'bg-purple-600 text-white shadow-neon-purple' : 'text-white/40 hover:text-white'
              )}>
              {d === 'over' ? '↑ Over' : '↓ Under'} {clampedTarget}
            </button>
          ))}
        </div>

        {/* Target slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-white/40 uppercase tracking-widest">Target Number</label>
            <span className="text-white font-bold font-mono text-lg">{clampedTarget}</span>
          </div>
          <input
            type="range" min={MIN_TARGET} max={MAX_TARGET} value={clampedTarget}
            onChange={e => setTarget(parseInt(e.target.value))}
            disabled={rolling}
            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-purple-500 cursor-pointer"
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Win Chance', value: `${winChance}%` },
            { label: 'Payout', value: `${payout}×` },
            { label: 'Potential Win', value: formatBalance(potentialWin, currency) },
          ].map(s => (
            <div key={s.label} className="glass-card p-2 text-center">
              <div className="text-xs text-white/30 mb-0.5">{s.label}</div>
              <div className="text-sm font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Bet amount */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-white/40 uppercase tracking-widest">Bet</label>
            <AnimatedBalance currency={currency} balance={balance} size="sm" />
          </div>
          <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)}
            disabled={rolling} className="bet-input w-full h-12 text-xl font-bold text-center"
            inputMode="decimal" />
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {BET_PRESETS.map(p => (
              <button key={p} onClick={() => setBetAmount(String(p))} disabled={rolling}
                className="py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-40">
                {p}
              </button>
            ))}
          </div>
        </div>

        <Button variant="neon" className="w-full h-14 text-lg font-black" onClick={handleRoll}
          disabled={rolling || isLocked || !parsedBet || !canAfford(parsedBet) || winChance <= 0}>
          {rolling
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Rolling...</>
            : `🎲 Roll ${direction === 'over' ? '>' : '<'} ${clampedTarget}`}
        </Button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card p-4">
          <div className="text-xs text-white/30 uppercase tracking-widest mb-3">Recent rolls</div>
          <div className="flex gap-1.5 flex-wrap">
            {history.map((h, i) => (
              <div key={i} className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold border',
                h.won ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
              )}>
                {h.result} {h.dir === 'over' ? '>' : '<'} {h.target}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
