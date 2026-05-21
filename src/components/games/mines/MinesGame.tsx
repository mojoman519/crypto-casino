'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameBet } from '@/hooks/useGameBet'
import { BettingPanel } from '@/components/game-engine/BettingPanel'
import { GameLayout } from '@/components/game-engine/GameLayout'
import { getMinesMultiplier } from '@/lib/game-engine/multipliers'
import { fireWinCelebration } from '@/components/effects/CelebrationOverlay'
import { useSounds } from '@/hooks/useSounds'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type TileState = 'hidden' | 'revealing' | 'safe' | 'mine' | 'mine-revealed'

interface ActiveGame {
  txId: string
  mineCount: number
  betAmount: number
  currency: 'NC' | 'SOL'
  revealed: number[]
  status: 'playing' | 'won' | 'lost'
  mines?: number[]
  hitMine?: number
}

// ─── Sparkle burst on diamond reveal ─────────────────────────────────────────
function Sparkles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * 360
        const dist = 20 + Math.random() * 12
        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-emerald-300"
            style={{ top: '50%', left: '50%', marginTop: -2, marginLeft: -2 }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos((angle * Math.PI) / 180) * dist,
              y: Math.sin((angle * Math.PI) / 180) * dist,
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

// ─── Explosion burst on mine hit ──────────────────────────────────────────────
function Explosion() {
  const colors = ['#ef4444', '#f97316', '#fbbf24', '#ef4444', '#f97316']
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * 360
        const dist = 24 + Math.random() * 16
        return (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              top: '50%', left: '50%', marginTop: -3, marginLeft: -3,
              background: colors[i % colors.length],
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1.5 }}
            animate={{
              x: Math.cos((angle * Math.PI) / 180) * dist,
              y: Math.sin((angle * Math.PI) / 180) * dist,
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.015 }}
          />
        )
      })}
    </div>
  )
}

// ─── Single tile ──────────────────────────────────────────────────────────────
interface TileProps {
  index: number
  state: TileState
  isHitMine: boolean
  isClickable: boolean
  revealDelay: number
  onClick: () => void
}

function MineTile({ index, state, isHitMine, isClickable, revealDelay, onClick }: TileProps) {
  const [burstKey, setBurstKey] = useState(0)
  const prevState = useRef<TileState>('hidden')

  useEffect(() => {
    if (state !== prevState.current && (state === 'safe' || state === 'mine')) {
      setBurstKey(k => k + 1)
    }
    prevState.current = state
  }, [state])

  return (
    <div
      className={cn(
        'relative aspect-square rounded-xl select-none',
        isClickable ? 'cursor-pointer' : 'cursor-default',
      )}
      onClick={isClickable ? onClick : undefined}
    >
      <AnimatePresence mode="wait">

        {/* Hidden */}
        {state === 'hidden' && (
          <motion.div
            key="hidden"
            className={cn(
              'absolute inset-0 rounded-xl border flex items-center justify-center',
              'bg-[#13102a] border-purple-800/30',
              isClickable && 'hover:bg-[#1c1840] hover:border-purple-600/60 hover:shadow-[0_0_12px_rgba(139,92,246,0.2)] transition-all duration-100',
            )}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.018, type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="w-3 h-3 rotate-45 rounded-sm bg-purple-900/60 border border-purple-700/30" />
          </motion.div>
        )}

        {/* Revealing */}
        {state === 'revealing' && (
          <motion.div
            key="revealing"
            className="absolute inset-0 rounded-xl bg-purple-500/20 border border-purple-400/40"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.35, repeat: Infinity }}
          />
        )}

        {/* Safe — diamond */}
        {state === 'safe' && (
          <motion.div
            key="safe"
            className="absolute inset-0 rounded-xl border border-emerald-600/40 bg-[#071a10] flex items-center justify-center shadow-[inset_0_0_16px_rgba(16,185,129,0.1)]"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          >
            {/* Diamond shape */}
            <motion.div
              className="relative w-7 h-7"
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="absolute inset-0 rotate-45 rounded-sm bg-gradient-to-br from-emerald-300 via-green-400 to-emerald-600 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
              {/* Shine */}
              <div className="absolute inset-0 rotate-45 rounded-sm overflow-hidden">
                <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-white/25 rounded-br-full" />
              </div>
            </motion.div>
            {/* Sparkle burst — re-mounts each time burstKey changes */}
            <Sparkles key={burstKey} />
          </motion.div>
        )}

        {/* Mine (hit) */}
        {state === 'mine' && (
          <motion.div
            key="mine-hit"
            className="absolute inset-0 rounded-xl border border-red-500/60 bg-[#1a0505] flex items-center justify-center shadow-[inset_0_0_20px_rgba(239,68,68,0.2),0_0_20px_rgba(239,68,68,0.15)]"
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 12 }}
          >
            <motion.span
              className="text-2xl"
              animate={{ rotate: [-8, 8, -5, 5, 0], scale: [1, 1.2, 0.95, 1] }}
              transition={{ duration: 0.45 }}
            >
              💣
            </motion.span>
            {/* Explosion ring */}
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-red-400/70"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.55 }}
            />
            <Explosion key={burstKey} />
          </motion.div>
        )}

        {/* Mine (revealed after game) */}
        {state === 'mine-revealed' && (
          <motion.div
            key="mine-reveal"
            className="absolute inset-0 rounded-xl border border-red-900/40 bg-[#150505] flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: revealDelay, duration: 0.25 }}
          >
            <span className="text-xl opacity-60">💣</span>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

// ─── Multiplier badge ─────────────────────────────────────────────────────────
function MultiplierBadge({ multiplier, betAmount, revealed }: { multiplier: number; betAmount: number; revealed: number }) {
  const win = Math.round(betAmount * multiplier * 100) / 100
  const glow = Math.min(revealed / 8, 1)

  return (
    <motion.div
      key={multiplier}
      className="flex items-center gap-4 px-5 py-2.5 rounded-2xl border"
      style={{
        background: `rgba(5, 46, 22, ${0.6 + glow * 0.2})`,
        borderColor: `rgba(52,211,153,${0.25 + glow * 0.45})`,
        boxShadow: `0 0 ${16 + glow * 24}px rgba(16,185,129,${0.06 + glow * 0.1})`,
      }}
      animate={{ scale: [1, 1.03, 1] }}
      transition={{ duration: 0.2 }}
    >
      <div className="text-center">
        <div className="text-[10px] text-white/35 uppercase tracking-widest mb-0.5">Multiplier</div>
        <motion.div
          className="text-xl font-black text-emerald-300"
          key={multiplier}
          initial={{ scale: 1.4, color: '#fff' }}
          animate={{ scale: 1, color: '#6ee7b7' }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {multiplier.toFixed(2)}×
        </motion.div>
      </div>
      <div className="w-px h-8 bg-white/10" />
      <div className="text-center">
        <div className="text-[10px] text-white/35 uppercase tracking-widest mb-0.5">Cashout</div>
        <div className="text-xl font-black text-white">{win.toLocaleString()}</div>
      </div>
    </motion.div>
  )
}

// ─── Near-win tension ring ────────────────────────────────────────────────────
function TensionRing({ revealed, maxSafe }: { revealed: number; maxSafe: number }) {
  const t = Math.min(revealed / Math.max(maxSafe * 0.55, 1), 1)
  if (t < 0.25) return null
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl pointer-events-none"
      style={{ zIndex: 0 }}
      animate={{
        boxShadow: [
          `inset 0 0 ${t * 50}px rgba(168,85,247,${t * 0.1})`,
          `inset 0 0 ${t * 70}px rgba(168,85,247,${t * 0.16})`,
          `inset 0 0 ${t * 50}px rgba(168,85,247,${t * 0.1})`,
        ],
      }}
      transition={{ duration: Math.max(0.7, 1.6 - t), repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MinesGame() {
  const [mineCount, setMineCount] = useState(3)
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [tiles, setTiles] = useState<TileState[]>(Array(25).fill('hidden' as TileState))
  const [shaking, setShaking] = useState(false)
  const isRevealingRef = useRef(false)

  const sounds = useSounds()
  const bet = useGameBet({ gameType: 'MINES', defaultAmount: 100 })

  const isPlaying = game?.status === 'playing'
  const maxSafe = game ? 25 - game.mineCount : 25 - mineCount
  const currentMultiplier = game ? getMinesMultiplier(game.mineCount, game.revealed.length) : 1

  const triggerShake = useCallback(() => {
    setShaking(true)
    setTimeout(() => setShaking(false), 480)
  }, [])

  // ── Start game ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!bet.canBet || bet.isLoading) return
    bet.setIsLoading(true)
    sounds.playClick()
    setTiles(Array(25).fill('hidden' as TileState))

    try {
      const data = await bet.apiCall('/api/games/mines', {
        betAmount: bet.betAmount,
        mineCount,
        mode: bet.currency === 'NC' ? 'neon' : 'real',
      })
      const newGame: ActiveGame = {
        txId: data.txId,
        mineCount: data.mineCount,
        betAmount: data.betAmount,
        currency: data.currency,
        revealed: [],
        status: 'playing',
      }
      setGame(newGame)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      bet.setIsLoading(false)
    }
  }, [bet, mineCount, sounds])

  // ── Reveal tile ─────────────────────────────────────────────────────────────
  const handleReveal = useCallback(async (position: number) => {
    if (!game || game.status !== 'playing') return
    if (tiles[position] !== 'hidden') return
    if (isRevealingRef.current) return
    isRevealingRef.current = true

    // Optimistic loading state
    setTiles(prev => { const n = [...prev]; n[position] = 'revealing'; return n })
    sounds.playClick()

    try {
      const data = await bet.apiCall('/api/games/mines/reveal', { txId: game.txId, position })

      if (data.isMine) {
        sounds.playLose()
        triggerShake()

        // Show hit mine immediately
        setTiles(prev => { const n = [...prev]; n[position] = 'mine'; return n })

        // Stagger-reveal remaining mines
        const others: number[] = (data.mines as number[]).filter(m => m !== position)
        others.forEach((minePos, idx) => {
          setTimeout(() => {
            setTiles(prev => { const n = [...prev]; n[minePos] = 'mine-revealed'; return n })
          }, 120 + idx * 70)
        })

        setGame(g => g ? { ...g, revealed: data.revealed, status: 'lost', mines: data.mines, hitMine: position } : null)
        bet.syncBalance({ newNeonCoins: data.newNeonCoins, newBalance: data.newBalance })
        toast.error('💣 Hit a mine!', { duration: 2500 })
      } else {
        sounds.playWin()
        setTiles(prev => { const n = [...prev]; n[position] = 'safe'; return n })
        setGame(g => g ? { ...g, revealed: data.revealed, status: data.autoWin ? 'won' : 'playing' } : null)

        if (data.autoWin) {
          bet.syncBalance({ newNeonCoins: data.newNeonCoins, newBalance: data.newBalance })
          fireWinCelebration({ amount: game.betAmount * data.multiplier })
          toast.success(`🎉 ${data.multiplier}× — all safe tiles found!`)
          // Reveal mines
          const mines = data.mines as number[]
          mines.forEach((minePos: number, idx: number) => {
            setTimeout(() => {
              setTiles(prev => { const n = [...prev]; n[minePos] = 'mine-revealed'; return n })
            }, idx * 60)
          })
        }
      }
    } catch (err) {
      setTiles(prev => { const n = [...prev]; n[position] = 'hidden'; return n })
      toast.error(err instanceof Error ? err.message : 'Reveal failed')
    } finally {
      isRevealingRef.current = false
    }
  }, [game, tiles, bet, sounds, triggerShake])

  // ── Cashout ─────────────────────────────────────────────────────────────────
  const handleCashout = useCallback(async () => {
    if (!game || game.status !== 'playing' || game.revealed.length === 0) return
    bet.setIsLoading(true)
    sounds.playCashout()

    try {
      const data = await bet.apiCall('/api/games/mines/cashout', { txId: game.txId })
      bet.syncBalance(data)
      fireWinCelebration({ amount: data.winAmount })
      toast.success(`💰 ${data.multiplier}× — +${data.winAmount.toLocaleString()} ${bet.currency}!`)
      setGame(g => g ? { ...g, status: 'won', mines: data.mines } : null)
      const mines = data.mines as number[]
      mines.forEach((minePos: number, idx: number) => {
        setTimeout(() => {
          setTiles(prev => { const n = [...prev]; n[minePos] = 'mine-revealed'; return n })
        }, idx * 55)
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cashout failed')
    } finally {
      bet.setIsLoading(false)
    }
  }, [game, bet, sounds])

  const handleReset = useCallback(() => {
    setGame(null)
    setTiles(Array(25).fill('hidden' as TileState))
    bet.setIsLoading(false)
  }, [bet])

  // ─── Sidebar panel ──────────────────────────────────────────────────────────
  const panel = (
    <BettingPanel
      {...bet}
      onBet={isPlaying
        ? (game.revealed.length > 0 ? handleCashout : undefined)
        : handleStart}
      disabled={isPlaying && game.revealed.length === 0}
      actionLabel={
        isPlaying
          ? game.revealed.length === 0
            ? 'Reveal a tile first'
            : `Cashout ${currentMultiplier.toFixed(2)}×`
          : 'Start Game'
      }
      actionColor={
        isPlaying && game.revealed.length > 0
          ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400'
          : undefined
      }
    >
      {/* Mine count controls */}
      {!isPlaying ? (
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-widest mb-2 block">
            Mines: <span className="text-white font-bold">{mineCount}</span>
          </label>
          <input
            type="range" min={1} max={24} value={mineCount}
            onChange={e => setMineCount(parseInt(e.target.value))}
            className="w-full accent-purple-500 h-1.5"
          />
          <div className="flex justify-between text-[10px] text-white/20 mt-1">
            <span>1</span><span>24</span>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-2">
            {[1, 3, 5, 10, 15, 20, 23, 24].map(n => (
              <button key={n} onClick={() => setMineCount(n)}
                className={cn(
                  'py-1 rounded text-xs font-bold border transition-all',
                  mineCount === n
                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70'
                )}
              >{n}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Mines</span>
            <span className="font-bold text-red-400">{game.mineCount} 💣</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Safe left</span>
            <span className="font-bold text-emerald-400">{maxSafe - game.revealed.length} 💎</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Revealed</span>
            <span className="font-bold text-white">{game.revealed.length}/{maxSafe}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-1">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400"
              animate={{ width: `${(game.revealed.length / maxSafe) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}
    </BettingPanel>
  )

  // ─── Game area ──────────────────────────────────────────────────────────────
  const gameArea = (
    <div className="w-full flex flex-col items-center gap-4 pt-2">

      {/* Multiplier bar — visible only while playing and after first reveal */}
      <AnimatePresence>
        {game && isPlaying && game.revealed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <MultiplierBadge
              multiplier={currentMultiplier}
              betAmount={game.betAmount}
              revealed={game.revealed.length}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board */}
      <motion.div
        className="relative w-full max-w-[420px]"
        animate={shaking ? { x: [-5, 5, -4, 4, -2, 2, 0] } : {}}
        transition={shaking ? { duration: 0.4 } : {}}
      >
        {/* Board card */}
        <div
          className="relative rounded-2xl p-3 sm:p-4"
          style={{
            background: 'rgba(9, 7, 20, 0.9)',
            border: '1px solid rgba(109, 40, 217, 0.2)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Near-win tension ring */}
          {game && isPlaying && (
            <TensionRing revealed={game.revealed.length} maxSafe={maxSafe} />
          )}

          {/* 5×5 tile grid */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 relative z-10">
            {tiles.map((state, i) => (
              <MineTile
                key={i}
                index={i}
                state={state}
                isHitMine={game?.hitMine === i}
                isClickable={state === 'hidden' && !!isPlaying && !bet.isLoading}
                revealDelay={state === 'mine-revealed' ? i * 0.04 : 0}
                onClick={() => handleReveal(i)}
              />
            ))}
          </div>

          {/* Corner accents */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-purple-600/30 rounded-tl pointer-events-none" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-purple-600/30 rounded-tr pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-purple-600/30 rounded-bl pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-purple-600/30 rounded-br pointer-events-none" />
        </div>
      </motion.div>

      {/* End-game result card */}
      <AnimatePresence>
        {game && !isPlaying && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              'w-full max-w-[420px] flex items-center justify-between px-5 py-4 rounded-2xl border',
              game.status === 'won'
                ? 'bg-emerald-950/80 border-emerald-600/30'
                : 'bg-red-950/80 border-red-700/30',
            )}
          >
            <div>
              <div className="text-base font-black text-white">
                {game.status === 'won' ? '🎉 Cashed Out' : '💣 Game Over'}
              </div>
              <div className={cn(
                'text-sm font-semibold mt-0.5',
                game.status === 'won' ? 'text-emerald-400' : 'text-red-400',
              )}>
                {game.status === 'won'
                  ? `+${Math.round(game.betAmount * currentMultiplier).toLocaleString()} ${game.currency}`
                  : `Lost ${game.betAmount.toLocaleString()} ${game.currency}`}
              </div>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-sm text-white/70 hover:text-white transition-all font-semibold border border-white/10"
            >
              Play Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle hint */}
      {!game && (
        <p className="text-xs text-white/25 text-center mt-1">
          Set your bet and mine count, then click Start Game
        </p>
      )}
    </div>
  )

  return <GameLayout panel={panel} game={gameArea} title="Mines" badge="Provably Fair" />
}
