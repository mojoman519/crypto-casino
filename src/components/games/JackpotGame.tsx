'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Gem, Users, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { getAuthToken } from '@/lib/token'
import { useGameStore } from '@/store/gameStore'
import { formatCurrency, randomColor, getJackpotWinChance } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { JackpotEntry } from '@/types'

const MOCK_ENTRIES: JackpotEntry[] = [
  { id: '1', userId: 'u1', betAmount: 100, ticketStart: 0, ticketEnd: 100, color: '#7c3aed', user: { username: 'degenKing', avatar: undefined } },
  { id: '2', userId: 'u2', betAmount: 50, ticketStart: 100, ticketEnd: 150, color: '#ec4899', user: { username: 'moonShot', avatar: undefined } },
  { id: '3', userId: 'u3', betAmount: 75, ticketStart: 150, ticketEnd: 225, color: '#06b6d4', user: { username: 'ruggoor', avatar: undefined } },
]

const MIN_BET = 1
const MAX_BET = 10_000
const ROUND_DURATION = 60 // seconds

export function JackpotGame() {
  const { user, updateBalance } = useAuthStore()
  const { openWalletModal } = useWalletStore()
  const { jackpot, setJackpotRound, setJackpotWinner, setJackpotSpinning } = useGameStore()

  const [betAmount, setBetAmount] = useState('10')
  const [isEntering, setIsEntering] = useState(false)
  const [entries, setEntries] = useState<JackpotEntry[]>(MOCK_ENTRIES)
  const [poolAmount, setPoolAmount] = useState(225)
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [winner, setWinner] = useState<{ username: string; winAmount: number; color: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const parsedBet = parseFloat(betAmount) || 0
  const myEntry = entries.find((e) => e.userId === user?.id)
  const myTickets = myEntry ? myEntry.ticketEnd - myEntry.ticketStart : 0
  const totalTickets = entries.reduce((sum, e) => sum + (e.ticketEnd - e.ticketStart), 0)
  const winChance = getJackpotWinChance(myTickets, totalTickets)

  // Countdown timer
  useEffect(() => {
    if (winner) return
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval)
          spinWheel()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [winner]) // eslint-disable-line

  useEffect(() => {
    drawWheel()
  }, [entries, wheelRotation]) // eslint-disable-line

  const drawWheel = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const radius = Math.min(cx, cy) - 10

    ctx.clearRect(0, 0, W, H)

    if (totalTickets === 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 2
      ctx.stroke()
      return
    }

    let startAngle = wheelRotation * (Math.PI / 180)

    for (const entry of entries) {
      const tickets = entry.ticketEnd - entry.ticketStart
      const sliceAngle = (tickets / totalTickets) * Math.PI * 2

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle)
      ctx.closePath()
      ctx.fillStyle = entry.color
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      const midAngle = startAngle + sliceAngle / 2
      const labelR = radius * 0.6
      const lx = cx + labelR * Math.cos(midAngle)
      const ly = cy + labelR * Math.sin(midAngle)

      if (sliceAngle > 0.3) {
        ctx.save()
        ctx.translate(lx, ly)
        ctx.rotate(midAngle + Math.PI / 2)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = 'bold 11px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(entry.user?.username?.slice(0, 8) ?? '', 0, 0)
        ctx.fillText(`${((tickets / totalTickets) * 100).toFixed(1)}%`, 0, 14)
        ctx.restore()
      }

      startAngle += sliceAngle
    }

    // Center circle
    ctx.beginPath()
    ctx.arc(cx, cy, 30, 0, Math.PI * 2)
    ctx.fillStyle = '#050508'
    ctx.fill()
    ctx.strokeStyle = 'rgba(124,58,237,0.5)'
    ctx.lineWidth = 3
    ctx.stroke()

    // Center gem
    ctx.font = '20px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('💎', cx, cy)

    // Pointer
    ctx.beginPath()
    ctx.moveTo(cx, cy - radius - 5)
    ctx.lineTo(cx - 12, cy - radius + 20)
    ctx.lineTo(cx + 12, cy - radius + 20)
    ctx.closePath()
    ctx.fillStyle = '#f8fafc'
    ctx.fill()
    ctx.strokeStyle = 'rgba(124,58,237,0.8)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const spinWheel = () => {
    if (entries.length === 0) return
    setJackpotSpinning(true)

    const randomEntry = entries[Math.floor(Math.random() * entries.length)]
    const spinTurns = 5 + Math.random() * 5
    const finalRotation = wheelRotation + spinTurns * 360

    let current = wheelRotation
    const target = finalRotation
    const duration = 4000
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 4)
      const currentRot = current + (target - current) * eased
      setWheelRotation(currentRot % 360)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setJackpotSpinning(false)
        setWinner({
          username: randomEntry.user?.username ?? 'Anonymous',
          winAmount: poolAmount * 0.95,
          color: randomEntry.color,
        })
      }
    }
    requestAnimationFrame(animate)
  }

  const handleEnter = async () => {
    if (!user) { openWalletModal(); return }
    if (parsedBet < MIN_BET || parsedBet > MAX_BET || parsedBet > user.balance) return
    if (timeLeft === 0) {
      toast.error('Round ended, wait for next round')
      return
    }

    setIsEntering(true)
    try {
      const res = await fetch('/api/games/jackpot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ betAmount: parsedBet }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }

      const { data } = await res.json()
      const color = randomColor()
      const newEntry: JackpotEntry = {
        id: data.entryId,
        userId: user.id,
        betAmount: parsedBet,
        ticketStart: totalTickets,
        ticketEnd: totalTickets + parsedBet,
        color,
        user: { username: user.username },
      }

      setEntries((prev) => [...prev, newEntry])
      setPoolAmount((p) => p + parsedBet)
      updateBalance(user.balance - parsedBet)
      toast.success(`Entered jackpot with $${formatCurrency(parsedBet)}!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to enter')
    } finally {
      setIsEntering(false)
    }
  }

  const timePercent = (timeLeft / ROUND_DURATION) * 100

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Wheel */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Gem className="w-4 h-4 text-cyan-400" />
              Jackpot Round
            </h3>
            <div className={cn(
              'px-3 py-1 rounded-full text-sm font-bold',
              timeLeft > 10 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'
            )}>
              ⏱ {timeLeft}s
            </div>
          </div>

          {/* Timer bar */}
          <div className="w-full h-1.5 bg-white/10 rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
              animate={{ width: `${timePercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Jackpot pool */}
          <div className="text-center mb-4">
            <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Total Pool</div>
            <div className="text-5xl font-black neon-text animate-pulse-neon">
              ${formatCurrency(poolAmount)}
            </div>
            <div className="text-xs text-white/30 mt-1">Winner takes 95%</div>
          </div>

          {/* Wheel canvas */}
          <div className="relative">
            <canvas ref={canvasRef} width={320} height={320} className="rounded-full" />
            {jackpot.spinning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full rounded-full border-4 border-purple-500/50 animate-spin-slow" />
              </div>
            )}
          </div>

          {/* Winner announcement */}
          <AnimatePresence>
            {winner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-center w-full"
              >
                <div className="text-4xl mb-2">🎉</div>
                <div className="text-xl font-black text-yellow-400">{winner.username}</div>
                <div className="text-3xl font-black text-white mt-1">
                  Won ${formatCurrency(winner.winAmount)}!
                </div>
                <div className="text-xs text-white/40 mt-2">Provably fair — verify below</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls + players */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <Gem className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-white">Enter Jackpot</span>
            </div>

            {myEntry && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm">
                <div className="text-white/60">Your entry:</div>
                <div className="font-bold text-purple-300">${formatCurrency(myEntry.betAmount)}</div>
                <div className="text-xs text-white/40 mt-1">Win chance: {winChance.toFixed(2)}%</div>
              </div>
            )}

            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Bet Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  disabled={timeLeft === 0}
                  className="bet-input w-full pl-7 h-11 text-lg font-bold"
                  min={MIN_BET}
                  max={MAX_BET}
                />
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2">
                {[5, 25, 100].map((a) => (
                  <button
                    key={a}
                    onClick={() => setBetAmount(String(a))}
                    className="py-1 rounded text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors"
                  >
                    ${a}
                  </button>
                ))}
              </div>
            </div>

            {parsedBet > 0 && totalTickets > 0 && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/40">Win chance</span>
                  <span className="text-white font-bold">
                    {((parsedBet / (totalTickets + parsedBet)) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Potential win</span>
                  <span className="text-emerald-400 font-bold">
                    ${formatCurrency((poolAmount + parsedBet) * 0.95)}
                  </span>
                </div>
              </div>
            )}

            <Button
              variant="neon"
              className="w-full h-12"
              onClick={handleEnter}
              disabled={isEntering || timeLeft === 0 || !parsedBet}
            >
              {isEntering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gem className="w-4 h-4" />}
              {timeLeft === 0 ? 'Round Ended' : `Enter $${formatCurrency(parsedBet)}`}
            </Button>
          </div>

          {/* Players list */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white/60">
              <Users className="w-4 h-4" />
              {entries.length} Players
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-white/70 truncate max-w-[80px]">{entry.user?.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white/90">${formatCurrency(entry.betAmount)}</span>
                    <span className="text-xs text-white/30">
                      {((( entry.ticketEnd - entry.ticketStart) / totalTickets) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
