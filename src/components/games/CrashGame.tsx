'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, TrendingUp, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { useBalance } from '@/hooks/useBalance'
import { useGameLock } from '@/hooks/useGameLock'
import { useSounds } from '@/hooks/useSounds'
import { getAuthToken } from '@/lib/token'
import { formatMultiplier } from '@/lib/utils'
import { formatBalance } from '@/lib/currency'
import { PlayModeToggle } from '@/components/shared/PlayModeToggle'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Currency } from '@/types/transactions'

type Phase = 'waiting' | 'flying' | 'crashed'

const HISTORY_COLOR = (p: number) =>
  p < 1.5 ? 'text-red-400 bg-red-500/10 border-red-500/20'
  : p < 2 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  : p < 5 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  : 'text-purple-400 bg-purple-500/10 border-purple-500/20'

const GROWTH_RATE = 0.00006 // controls how fast multiplier rises

function computeMultiplier(elapsedMs: number): number {
  return Math.pow(Math.E, GROWTH_RATE * elapsedMs)
}

export const CrashGame = memo(function CrashGame() {
  const { user } = useAuthStore()
  const { openWalletModal } = useWalletStore()
  const [playMode, setPlayMode] = useState<'neon' | 'real'>('neon')
  const currency: Currency = playMode === 'neon' ? 'NC' : 'SOL'
  const { balance, canAfford } = useBalance(currency)
  const { isLocked, withLock } = useGameLock()
  const sounds = useSounds()

  // Bet state
  const [betAmount, setBetAmount] = useState('10')
  const [autoCashout, setAutoCashout] = useState('')
  const [myBet, setMyBet] = useState<{ amount: number } | null>(null)
  const [cashedOut, setCashedOut] = useState(false)
  const [cashoutMult, setCashoutMult] = useState(0)

  // Phase & display (React state — triggers re-renders only when phase changes)
  const [phase, setPhase] = useState<Phase>('waiting')
  const [displayMult, setDisplayMult] = useState(1.0)
  const [crashedAt, setCrashedAt] = useState(0)
  const [history, setHistory] = useState<{ id: string; crashPoint: number }[]>([])
  const [countdown, setCountdown] = useState(5)

  // RAF refs — never cause re-renders
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const multRef = useRef(1.0)
  const phaseRef = useRef<Phase>('waiting')
  const myBetRef = useRef<typeof myBet>(null)
  const cashedOutRef = useRef(false)
  const autoCashoutRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<[number, number][]>([[0, 0]])

  const parsedBet = parseFloat(betAmount) || 0
  const parsedAuto = parseFloat(autoCashout) || 0

  // ─── Canvas draw ────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.fillStyle = '#0a0a14'
    ctx.fillRect(0, 0, W, H)

    const pts = pointsRef.current
    if (pts.length < 2) return

    const lastPt = pts[pts.length - 1]
    const crashed = phaseRef.current === 'crashed'

    // Gradient line
    const grad = ctx.createLinearGradient(0, H, lastPt[0], lastPt[1])
    grad.addColorStop(0, crashed ? 'rgba(239,68,68,0.8)' : 'rgba(124,58,237,0.8)')
    grad.addColorStop(1, crashed ? 'rgba(239,68,68,1)' : 'rgba(16,185,129,1)')

    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])

    // Fill under line
    ctx.lineTo(lastPt[0], H - 10)
    ctx.lineTo(pts[0][0], H - 10)
    ctx.closePath()
    const fill = ctx.createLinearGradient(0, 0, 0, H)
    fill.addColorStop(0, crashed ? 'rgba(239,68,68,0.1)' : 'rgba(124,58,237,0.1)')
    fill.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = fill
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.strokeStyle = grad
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    // Rocket/explosion at tip
    ctx.font = '20px serif'
    ctx.textAlign = 'center'
    ctx.fillText(crashed ? '💥' : '🚀', lastPt[0], lastPt[1] - 8)

    // Grid lines (light)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(i * W / 5, 0); ctx.lineTo(i * W / 5, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * H / 5); ctx.lineTo(W, i * H / 5); ctx.stroke()
    }
  }, [])

  // ─── RAF loop ────────────────────────────────────────────────────────────────
  const rafLoop = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current
    const mult = computeMultiplier(elapsed)
    multRef.current = mult

    // Update canvas point (curve up and right)
    const canvas = canvasRef.current
    if (canvas) {
      const W = canvas.width
      const H = canvas.height
      const maxVisible = computeMultiplier(15000) // 15s at max visible
      const t = Math.min(elapsed / 15000, 1)
      const x = 20 + t * (W - 40)
      const ratio = Math.min((mult - 1) / (maxVisible - 1), 1)
      const y = H - 20 - ratio * (H - 50)
      pointsRef.current.push([x, y])
      if (pointsRef.current.length > 300) pointsRef.current.shift()
    }

    drawCanvas()

    // Throttle React state update to every 100ms for display
    if (elapsed % 100 < 16) {
      setDisplayMult(parseFloat(mult.toFixed(2)))
    }

    // Auto cashout check
    if (autoCashoutRef.current > 1 && mult >= autoCashoutRef.current && myBetRef.current && !cashedOutRef.current) {
      handleCashout()
      return
    }

    // Simulate crash for demo (replace with socket event in production)
    if (mult >= multRef.current && phaseRef.current === 'flying') {
      rafRef.current = requestAnimationFrame(rafLoop)
    }
  }, [drawCanvas])

  // ─── Phase transitions ───────────────────────────────────────────────────────
  const startRound = useCallback(() => {
    phaseRef.current = 'flying'
    setPhase('flying')
    pointsRef.current = [[20, canvasRef.current?.height ?? 280 - 20]]
    multRef.current = 1.0
    startTimeRef.current = 0
    setDisplayMult(1.0)
    setCashedOut(false)
    cashedOutRef.current = false
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(rafLoop)
  }, [rafLoop])

  const endRound = useCallback((crashPoint: number) => {
    cancelAnimationFrame(rafRef.current)
    phaseRef.current = 'crashed'
    setPhase('crashed')
    setCrashedAt(crashPoint)
    setDisplayMult(crashPoint)
    drawCanvas()
    sounds.playCrashBoom()

    if (myBetRef.current && !cashedOutRef.current) {
      toast.error(`💥 Crashed at ${formatMultiplier(crashPoint)}!`)
    }

    setHistory(prev => [{ id: Date.now().toString(), crashPoint }, ...prev].slice(0, 15))

    // Next round after 3s countdown
    let c = 5
    setCountdown(c)
    const timer = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        clearInterval(timer)
        phaseRef.current = 'waiting'
        setPhase('waiting')
        setMyBet(null)
        myBetRef.current = null
        startRound()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [drawCanvas, sounds, startRound])

  // ─── Mount: start simulated game ─────────────────────────────────────────────
  useEffect(() => {
    phaseRef.current = 'waiting'
    let cleanup: (() => void) | void

    const beginRound = () => {
      startRound()
      // Random crash point (1.01 to 20x, weighted toward lower)
      const crashAt = Math.random() < 0.35
        ? 1.0 + Math.random() * 0.8
        : 1.5 + Math.pow(Math.random(), 1.5) * 18
      const crashMs = Math.log(crashAt) / GROWTH_RATE

      const timeout = setTimeout(() => {
        cleanup = endRound(parseFloat(crashAt.toFixed(2)))
      }, crashMs)

      return () => clearTimeout(timeout)
    }

    const stop = beginRound()
    return () => {
      stop()
      cancelAnimationFrame(rafRef.current)
    }
  }, []) // eslint-disable-line

  // Sync autoCashout ref
  useEffect(() => { autoCashoutRef.current = parsedAuto }, [parsedAuto])

  // ─── Bet ─────────────────────────────────────────────────────────────────────
  const handlePlaceBet = useCallback(async () => {
    if (!user) { openWalletModal(); return }
    if (phase !== 'waiting' || !parsedBet || !canAfford(parsedBet)) return

    await withLock(async () => {
      sounds.playBet()
      const res = await fetch('/api/games/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ betAmount: parsedBet, autoCashout: parsedAuto > 1 ? parsedAuto : null, mode: playMode }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }
      setMyBet({ amount: parsedBet })
      myBetRef.current = { amount: parsedBet }
      toast.success(`Bet placed: ${formatBalance(parsedBet, currency)}`)
    })
  }, [user, phase, parsedBet, parsedAuto, canAfford, playMode, currency, withLock, sounds, openWalletModal])

  // ─── Cashout ─────────────────────────────────────────────────────────────────
  const handleCashout = useCallback(async () => {
    if (!myBetRef.current || cashedOutRef.current || phaseRef.current !== 'flying') return
    cashedOutRef.current = true
    const mult = multRef.current
    setCashedOut(true)
    setCashoutMult(parseFloat(mult.toFixed(2)))
    sounds.playCashout()

    const winAmount = myBetRef.current.amount * mult * 0.97
    toast.success(`🚀 Cashed out at ${formatMultiplier(mult)}! +${formatBalance(winAmount, currency)}`, { duration: 5000 })

    try {
      await fetch('/api/games/crash/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ multiplier: mult }),
      })
    } catch {}
  }, [currency, sounds])

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <PlayModeToggle mode={playMode} onChange={setPlayMode} />

      {/* History */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {history.map(h => (
          <span key={h.id} className={cn('px-2 py-1 rounded-lg text-xs font-bold border whitespace-nowrap flex-shrink-0', HISTORY_COLOR(h.crashPoint))}>
            {formatMultiplier(h.crashPoint)}
          </span>
        ))}
        {history.length === 0 && <span className="text-xs text-white/20">Round history</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 glass-card overflow-hidden relative" style={{ minHeight: 280 }}>
          <canvas ref={canvasRef} className="w-full h-full" width={600} height={280} style={{ touchAction: 'none' }} />

          {/* Multiplier overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <AnimatePresence mode="wait">
              {phase === 'waiting' && (
                <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  <div className="text-white/30 text-xs uppercase tracking-widest mb-1">Next round in</div>
                  <div className="text-5xl font-black text-white">{countdown}s</div>
                </motion.div>
              )}
              {phase === 'flying' && (
                <motion.div key="fly" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                  <div className={cn('text-6xl font-black font-mono tabular-nums transition-colors duration-100', displayMult > 5 ? 'text-purple-300' : displayMult > 2 ? 'text-emerald-300' : 'text-white')}>
                    {formatMultiplier(displayMult)}
                  </div>
                  {myBet && !cashedOut && (
                    <div className="text-sm text-emerald-400 mt-1 font-semibold">
                      +{formatBalance(myBet.amount * displayMult - myBet.amount, currency)}
                    </div>
                  )}
                </motion.div>
              )}
              {phase === 'crashed' && (
                <motion.div key="crash" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                  <div className="text-5xl mb-1">💥</div>
                  <div className="text-4xl font-black text-red-400 font-mono">{formatMultiplier(crashedAt)}</div>
                  <div className="text-red-400/60 text-xs uppercase tracking-widest mt-1">CRASHED</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/80 border-b border-white/5 pb-3">
            <Rocket className="w-4 h-4 text-purple-400" />
            Place Bet
            <AnimatedBalance currency={currency} balance={balance} size="sm" className="ml-auto" />
          </div>

          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest mb-1.5 block">Bet Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">{currency === 'NC' ? '🎮' : '◎'}</span>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                disabled={phase === 'flying' || isLocked}
                className="bet-input w-full pl-8 pr-3 h-11 text-base font-bold"
                inputMode="decimal"
              />
            </div>
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              {[5, 10, 25, 50].map(a => (
                <button key={a} onClick={() => setBetAmount(String(a))} disabled={phase === 'flying'}
                  className="py-1 rounded-lg text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-40">
                  {currency === 'NC' ? a.toLocaleString() : a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest mb-1.5 block">Auto Cashout</label>
            <div className="relative">
              <input type="number" value={autoCashout} onChange={e => setAutoCashout(e.target.value)}
                disabled={phase === 'flying'} placeholder="e.g. 2.00"
                className="bet-input w-full pr-6 h-10 text-sm"
                inputMode="decimal" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">×</span>
            </div>
          </div>

          {cashedOut && (
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-400 text-sm font-bold">
              ✓ Cashed out {formatMultiplier(cashoutMult)}
            </div>
          )}

          {phase === 'flying' && myBet && !cashedOut ? (
            <Button variant="success" className="w-full h-12 text-lg font-black animate-pulse-neon"
              onClick={handleCashout}>
              CASHOUT {formatMultiplier(displayMult)}
            </Button>
          ) : (
            <Button variant="neon" className="w-full h-12" onClick={handlePlaceBet}
              disabled={isLocked || phase === 'flying' || !parsedBet || !canAfford(parsedBet)}>
              {isLocked ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {phase === 'flying' ? 'Round in progress' : `Bet ${formatBalance(parsedBet || 0, currency)}`}
            </Button>
          )}
        </div>
      </div>

      {/* Active bets placeholder */}
      <div className="glass-card p-3">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Users className="w-3.5 h-3.5" />
          {myBet ? `Your bet: ${formatBalance(myBet.amount, currency)}` : 'No active bet this round'}
        </div>
      </div>
    </div>
  )
})
