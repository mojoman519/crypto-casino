'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, TrendingUp, Loader2, Shield, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { useGameStore } from '@/store/gameStore'
import { formatCurrency, formatMultiplier } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const HISTORY_COLORS = (point: number) => {
  if (point < 1.5) return 'text-red-400 bg-red-500/10 border-red-500/20'
  if (point < 2) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  if (point < 5) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  return 'text-purple-400 bg-purple-500/10 border-purple-500/20'
}

export function CrashGame() {
  const { user, updateBalance } = useAuthStore()
  const { openWalletModal } = useWalletStore()
  const { crash, setCrashMultiplier, setCrashPhase, setMyCrashBet, setCashedOut, addCrashHistory } = useGameStore()

  const [betAmount, setBetAmount] = useState('10')
  const [autoCashout, setAutoCashout] = useState('')
  const [isPlacingBet, setIsPlacingBet] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const multiplierRef = useRef(1.0)
  const startTimeRef = useRef(0)
  const pointsRef = useRef<{ x: number; y: number }[]>([])

  const parsedBet = parseFloat(betAmount) || 0
  const parsedAutoCashout = parseFloat(autoCashout) || 0

  // Simulated crash game engine (replace with socket.io events in production)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (crash.phase === 'flying') {
      startTimeRef.current = Date.now()
      pointsRef.current = [{ x: 0, y: 0 }]
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const mult = Math.pow(Math.E, 0.12 * elapsed)
        multiplierRef.current = mult
        setCrashMultiplier(parseFloat(mult.toFixed(2)))
        drawCrashLine()

        // Auto cashout
        if (parsedAutoCashout > 0 && mult >= parsedAutoCashout && crash.myBet && !crash.hasCashedOut) {
          handleCashout()
        }
      }, 50)
    }
    return () => clearInterval(interval)
  }, [crash.phase]) // eslint-disable-line

  const drawCrashLine = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const mult = multiplierRef.current
    const progress = Math.min((mult - 1) / 9, 1)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath()
      ctx.moveTo((i / 10) * W, 0)
      ctx.lineTo((i / 10) * W, H)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, (i / 10) * H)
      ctx.lineTo(W, (i / 10) * H)
      ctx.stroke()
    }

    // Crash line
    const currentX = progress * (W - 40) + 20
    const currentY = H - 20 - progress * (H - 60)

    pointsRef.current.push({ x: currentX, y: currentY })
    if (pointsRef.current.length > 200) pointsRef.current.shift()

    if (pointsRef.current.length < 2) return

    // Gradient line
    const grad = ctx.createLinearGradient(20, H - 20, currentX, currentY)
    grad.addColorStop(0, 'rgba(124, 58, 237, 0.8)')
    grad.addColorStop(1, crash.phase === 'crashed' ? 'rgba(239, 68, 68, 1)' : 'rgba(16, 185, 129, 1)')

    ctx.beginPath()
    ctx.moveTo(20, H - 20)
    for (const pt of pointsRef.current) {
      ctx.lineTo(pt.x, pt.y)
    }

    // Fill under the line
    ctx.lineTo(currentX, H - 20)
    ctx.lineTo(20, H - 20)
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H)
    fillGrad.addColorStop(0, 'rgba(124, 58, 237, 0.15)')
    fillGrad.addColorStop(1, 'rgba(124, 58, 237, 0)')
    ctx.fillStyle = fillGrad
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(20, H - 20)
    for (const pt of pointsRef.current) {
      ctx.lineTo(pt.x, pt.y)
    }
    ctx.strokeStyle = grad
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Rocket emoji at tip
    ctx.font = '24px serif'
    ctx.fillText(crash.phase === 'crashed' ? '💥' : '🚀', currentX - 12, currentY - 8)
  }, [crash.phase])

  const handlePlaceBet = async () => {
    if (!user) { openWalletModal(); return }
    if (parsedBet <= 0 || parsedBet > user.balance) return
    if (crash.phase !== 'waiting') {
      toast.error('Wait for next round to place bet')
      return
    }

    setIsPlacingBet(true)
    try {
      const res = await fetch('/api/games/crash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('casino_token') ?? ''}`,
        },
        body: JSON.stringify({
          betAmount: parsedBet,
          autoCashout: parsedAutoCashout > 1 ? parsedAutoCashout : null,
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }

      const { data } = await res.json()
      setMyCrashBet(data.bet)
      updateBalance(user.balance - parsedBet)
      toast.success(`Bet placed: $${formatCurrency(parsedBet)}`)
      setCrashPhase('flying')
      setCashedOut(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to place bet')
    } finally {
      setIsPlacingBet(false)
    }
  }

  const handleCashout = async () => {
    if (!crash.myBet || crash.hasCashedOut) return
    setCashedOut(true)

    try {
      const res = await fetch('/api/games/crash/cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('casino_token') ?? ''}`,
        },
        body: JSON.stringify({ multiplier: crash.currentMultiplier }),
      })

      if (!res.ok) throw new Error('Cashout failed')
      const { data } = await res.json()
      updateBalance(data.newBalance)
      const winAmount = parsedBet * crash.currentMultiplier
      toast.success(`Cashed out at ${formatMultiplier(crash.currentMultiplier)}! +$${formatCurrency(winAmount)}`, { duration: 5000 })
    } catch {
      setCashedOut(false)
    }
  }

  // Mock: simulate crash rounds
  const simulateRound = () => {
    if (crash.phase !== 'idle' && crash.phase !== 'waiting') return
    setCrashPhase('flying')
    const crashAt = Math.random() < 0.3 ? 1.0 + Math.random() * 0.5 : 1.5 + Math.random() * 8
    setTimeout(() => {
      setCrashPhase('crashed')
      addCrashHistory({ crashPoint: parseFloat(crashAt.toFixed(2)), id: `r_${Date.now()}` })
      drawCrashLine()
      setTimeout(() => {
        setCrashPhase('waiting')
        multiplierRef.current = 1.0
        setCrashMultiplier(1.0)
        pointsRef.current = []
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          ctx?.clearRect(0, 0, canvas.width, canvas.height)
        }
        setTimeout(() => setCrashPhase('flying'), 5000)
      }, 3000)
    }, crashAt * 1000 * 1.5)
  }

  return (
    <div className="space-y-4">
      {/* History bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {crash.history.map((h) => (
          <span
            key={h.id}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap flex-shrink-0', HISTORY_COLORS(h.crashPoint))}
          >
            {formatMultiplier(h.crashPoint)}
          </span>
        ))}
        {crash.history.length === 0 && (
          <span className="text-xs text-white/30">No history yet</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 glass-card overflow-hidden relative" style={{ minHeight: 300 }}>
          {/* Multiplier overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <AnimatePresence mode="wait">
              {crash.phase === 'waiting' && (
                <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  <div className="text-white/30 text-sm uppercase tracking-widest mb-2">Next round in</div>
                  <div className="text-4xl font-black text-white">5s</div>
                </motion.div>
              )}
              {crash.phase === 'flying' && (
                <motion.div key="flying" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                  <motion.div
                    className="text-6xl font-black neon-text font-mono"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ repeat: Infinity, duration: 0.3 }}
                  >
                    {formatMultiplier(crash.currentMultiplier)}
                  </motion.div>
                  {crash.myBet && !crash.hasCashedOut && (
                    <div className="text-sm text-emerald-400 mt-1 font-semibold">
                      Profit: +${formatCurrency(parsedBet * crash.currentMultiplier - parsedBet)}
                    </div>
                  )}
                </motion.div>
              )}
              {crash.phase === 'crashed' && (
                <motion.div key="crashed" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                  <div className="text-5xl mb-2">💥</div>
                  <div className="text-4xl font-black text-red-400 font-mono">
                    {formatMultiplier(crash.currentMultiplier)}
                  </div>
                  <div className="text-red-400/60 text-sm mt-1 uppercase tracking-widest">CRASHED</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <canvas
            ref={canvasRef}
            className="w-full h-full crash-canvas"
            width={600}
            height={300}
          />

          {/* Dev: simulate button */}
          <button
            onClick={simulateRound}
            className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs bg-white/5 text-white/20 hover:text-white/60 transition-colors"
          >
            Simulate
          </button>
        </div>

        {/* Controls */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Rocket className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-white">Place Bet</span>
          </div>

          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Bet Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={crash.phase === 'flying'}
                className="bet-input w-full pl-7 pr-3 h-11 text-lg font-bold"
              />
            </div>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {[5, 10, 25, 50].map((a) => (
                <button
                  key={a}
                  onClick={() => setBetAmount(String(a))}
                  className="py-1 rounded-lg text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors"
                >
                  ${a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">
              Auto Cashout (optional)
            </label>
            <div className="relative">
              <input
                type="number"
                value={autoCashout}
                onChange={(e) => setAutoCashout(e.target.value)}
                disabled={crash.phase === 'flying'}
                placeholder="e.g. 2.00"
                className="bet-input w-full pr-6 h-11"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">×</span>
            </div>
          </div>

          {/* Potential win */}
          {parsedBet > 0 && parsedAutoCashout > 1 && (
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="text-xs text-white/40">At {formatMultiplier(parsedAutoCashout)}</div>
              <div className="text-lg font-black text-emerald-400">
                +${formatCurrency(parsedBet * parsedAutoCashout)}
              </div>
            </div>
          )}

          {crash.phase === 'flying' && crash.myBet && !crash.hasCashedOut ? (
            <Button
              variant="success"
              className="w-full h-14 text-xl font-black animate-pulse-neon"
              onClick={handleCashout}
            >
              CASHOUT {formatMultiplier(crash.currentMultiplier)}
            </Button>
          ) : (
            <Button
              variant="neon"
              className="w-full h-12"
              onClick={handlePlaceBet}
              disabled={isPlacingBet || crash.phase === 'flying' || !parsedBet}
            >
              {isPlacingBet ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {crash.phase === 'flying' ? 'Round in progress' : `Bet $${formatCurrency(parsedBet)}`}
            </Button>
          )}

          {crash.hasCashedOut && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-400 text-sm font-semibold">
              ✓ Cashed out at {formatMultiplier(crash.currentMultiplier)}
            </div>
          )}
        </div>
      </div>

      {/* Active bets */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white/60">
          <Users className="w-4 h-4" />
          Active Bets (0)
        </div>
        <div className="text-center py-4 text-white/20 text-sm">
          No active bets this round
        </div>
      </div>
    </div>
  )
}
