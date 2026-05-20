'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { useBalance } from '@/hooks/useBalance'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { PlayModeToggle } from '@/components/shared/PlayModeToggle'
import { getAuthToken } from '@/lib/token'
import { formatBalance } from '@/lib/currency'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Currency } from '@/types/transactions'
import { fireWinCelebration } from '@/components/effects/CelebrationOverlay'

type Choice = 'heads' | 'tails'
type GamePhase = 'idle' | 'flipping' | 'result'

interface GameResult {
  result: Choice
  won: boolean
  winAmount: number
  serverSeedHash: string
  clientSeed: string
  nonce: number
}

const BET_PRESETS = [1, 5, 10, 25, 50, 100]

export function CoinFlip() {
  const { user } = useAuthStore()
  const { openWalletModal, openDepositModal } = useWalletStore()
  const [playMode, setPlayMode] = useState<'neon' | 'real'>('neon')
  const currency: Currency = playMode === 'neon' ? 'NC' : 'SOL'
  const { balance, canAfford, placeBet } = useBalance(currency)
  const [choice, setChoice] = useState<Choice>('heads')
  const [betAmount, setBetAmount] = useState('1')
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [result, setResult] = useState<GameResult | null>(null)
  const [history, setHistory] = useState<GameResult[]>([])
  const [isFlipping, setIsFlipping] = useState(false)

  const parsedBet = parseFloat(betAmount) || 0
  const canPlay = user && parsedBet > 0 && canAfford(parsedBet) && phase === 'idle'

  const handlePlay = useCallback(async () => {
    if (!user) { openWalletModal(); return }
    if (!canPlay) return

    setPhase('flipping')
    setIsFlipping(true)
    setResult(null)

    try {
      await new Promise((r) => setTimeout(r, 200))

      const gameResult = await placeBet(parsedBet, 'COINFLIP', async () => {
        const res = await fetch('/api/games/coinflip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({ betAmount: parsedBet, choice, mode: playMode }),
        })
        if (!res.ok) {
          const { error } = await res.json()
          throw new Error(error || 'Game failed')
        }
        const { data } = await res.json()
        const serverBalance = currency === 'NC' ? data.newNeonCoins : data.newBalance
        return { won: data.won, winAmount: data.winAmount, data, serverBalance }
      })

      await new Promise((r) => setTimeout(r, 1500))
      setResult(gameResult.data)
      setIsFlipping(false)
      setPhase('result')

      if (gameResult.won) {
        toast.success(`🎉 Won ${formatBalance(gameResult.winAmount, currency)}!`, { duration: 4000 })
        fireWinCelebration({ amount: gameResult.winAmount })
      } else {
        toast.error(`💸 Lost ${formatBalance(parsedBet, currency)}`, { duration: 3000 })
      }

      setHistory((prev) => [gameResult.data, ...prev].slice(0, 10))
      setTimeout(() => setPhase('idle'), 3000)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('idle')
      setIsFlipping(false)
    }
  }, [user, canPlay, parsedBet, choice, playMode, currency, placeBet, openWalletModal])

  const adjustBet = (multiplier: number) => {
    const newBet = Math.max(0.01, Math.min(parsedBet * multiplier, balance))
    setBetAmount(newBet.toFixed(currency === 'NC' ? 0 : 4))
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <PlayModeToggle mode={playMode} onChange={setPlayMode} />
      </div>
      {/* Coin display */}
      <div className="flex justify-center mb-10">
        <div className="relative">
          {/* Glow */}
          <div className={cn(
            'absolute inset-0 rounded-full blur-3xl transition-all duration-500',
            phase === 'result' && result?.won ? 'bg-emerald-500/30' : '',
            phase === 'result' && !result?.won ? 'bg-red-500/20' : '',
            phase === 'flipping' ? 'bg-purple-500/30' : '',
            phase === 'idle' ? 'bg-purple-500/10' : '',
          )} />

          <motion.div
            className="relative w-40 h-40 rounded-full"
            animate={
              isFlipping
                ? { rotateY: [0, 180, 360, 540, 720, 900, 1080, 1260, 1440], scale: [1, 1.1, 1] }
                : phase === 'result'
                ? { scale: [1, 1.15, 1], rotateY: result?.result === 'heads' ? 0 : 180 }
                : {}
            }
            transition={
              isFlipping
                ? { duration: 1.5, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Heads side */}
            <div
              className={cn(
                'absolute inset-0 rounded-full flex items-center justify-center text-7xl backface-hidden',
                'bg-gradient-to-br from-yellow-400 to-amber-600 shadow-lg'
              )}
              style={{ backfaceVisibility: 'hidden' }}
            >
              🌕
            </div>
            {/* Tails side */}
            <div
              className={cn(
                'absolute inset-0 rounded-full flex items-center justify-center text-7xl',
                'bg-gradient-to-br from-slate-400 to-slate-600 shadow-lg'
              )}
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              🌑
            </div>
          </motion.div>

          {/* Result overlay */}
          <AnimatePresence>
            {phase === 'result' && result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'absolute -bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap',
                  result.won
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-red-500/20 border border-red-500/40 text-red-400'
                )}
              >
                {result.won ? `+${formatBalance(result.winAmount, currency)} WIN!` : `−${formatBalance(parsedBet, currency)} LOSS`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="glass-card p-6 space-y-5">
        {/* Choice */}
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">Your Pick</label>
          <div className="grid grid-cols-2 gap-3">
            {(['heads', 'tails'] as Choice[]).map((c) => (
              <button
                key={c}
                onClick={() => phase === 'idle' && setChoice(c)}
                disabled={phase !== 'idle'}
                className={cn(
                  'py-4 rounded-xl font-bold text-lg transition-all duration-200 border capitalize',
                  choice === c && c === 'heads'
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)]'
                    : choice === c && c === 'tails'
                    ? 'bg-slate-500/20 border-slate-400/50 text-slate-300 shadow-[0_0_20px_rgba(148,163,184,0.2)]'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:border-white/20 hover:text-white/80',
                  'disabled:cursor-not-allowed'
                )}
              >
                {c === 'heads' ? '🌕 Heads' : '🌑 Tails'}
              </button>
            ))}
          </div>
        </div>

        {/* Bet amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/40 uppercase tracking-widest">Bet Amount</label>
            <AnimatedBalance currency={currency} balance={balance} size="sm" />
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={phase !== 'idle'}
              className="bet-input w-full pl-8 pr-4 h-12 text-xl font-bold"
              min="0.01"
              step="0.01"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {BET_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setBetAmount(String(p))}
                disabled={phase !== 'idle'}
                className="py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                ${p}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[['½x', 0.5], ['2x', 2], ['Max', Infinity]].map(([label, mult]) => (
              <button
                key={String(label)}
                onClick={() => {
                  if (mult === Infinity) setBetAmount(String(user?.balance ?? 0))
                  else adjustBet(mult as number)
                }}
                disabled={phase !== 'idle'}
                className="py-1 rounded-lg text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Win info */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <span className="text-sm text-white/40">Potential win</span>
          <span className="text-lg font-black neon-text-green">
            +{formatBalance(parsedBet * 1.94, currency)}
          </span>
        </div>

        {/* Play button */}
        {user ? (
          <Button
            variant="neon"
            className="w-full h-14 text-lg font-black"
            onClick={handlePlay}
            disabled={!canPlay}
          >
            {phase === 'flipping' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Flipping...
              </>
            ) : phase === 'result' ? (
              result?.won ? '🎉 YOU WON!' : '💸 Try Again'
            ) : (
              parsedBet > 0 ? `Flip for ${formatBalance(parsedBet, currency)}` : 'Flip'
            )}
          </Button>
        ) : (
          <Button variant="neon" className="w-full h-14 text-lg" onClick={openWalletModal}>
            Connect Wallet to Play
          </Button>
        )}

        {parsedBet > balance && user && (
          <button
            onClick={playMode === 'real' ? openDepositModal : undefined}
            className="text-sm text-center w-full text-purple-400 hover:text-purple-300 transition-colors"
          >
            {playMode === 'neon' ? 'Not enough Neon Coins — reduce bet' : 'Need more SOL? Deposit →'}
          </button>
        )}
      </div>

      {/* Provably fair */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 glass-card p-4 space-y-2"
        >
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <Shield className="w-4 h-4" />
            Provably Fair Verification
          </div>
          <div className="space-y-1 font-mono text-xs text-white/40">
            <div className="flex gap-2"><span className="text-white/30">Server Seed Hash:</span><span className="truncate">{result.serverSeedHash}</span></div>
            <div className="flex gap-2"><span className="text-white/30">Client Seed:</span><span>{result.clientSeed}</span></div>
            <div className="flex gap-2"><span className="text-white/30">Nonce:</span><span>{result.nonce}</span></div>
          </div>
        </motion.div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-white/30 uppercase tracking-widest mb-2">Last {history.length} games</div>
          <div className="flex gap-1.5 flex-wrap">
            {history.map((h, i) => (
              <div
                key={i}
                className={cn(
                  'px-2 py-1 rounded-lg text-xs font-bold',
                  h.won
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400'
                )}
              >
                {h.result === 'heads' ? 'H' : 'T'} {h.won ? '+' : '-'}{formatBalance(h.won ? h.winAmount : parsedBet, currency)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
