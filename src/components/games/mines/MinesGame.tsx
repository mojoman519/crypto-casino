'use client'

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
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

// ─── R3F Atmosphere (background only, no interaction) ─────────────────────────
function AtmosphereOrb({ position, color, speed }: { position: [number,number,number]; color: string; speed: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const t = useRef(Math.random() * Math.PI * 2)
  useFrame((_, delta) => {
    t.current += delta * speed
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t.current) * 0.4
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.6 + Math.sin(t.current * 1.3) * 0.3
    }
  })
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.5, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.12} />
    </mesh>
  )
}

function Atmosphere() {
  return (
    <>
      <ambientLight intensity={0.1} />
      <AtmosphereOrb position={[-4, 2, -3]} color="#7c3aed" speed={0.4} />
      <AtmosphereOrb position={[4, -1, -4]} color="#06b6d4" speed={0.3} />
      <AtmosphereOrb position={[0, 3, -5]} color="#ec4899" speed={0.5} />
      <AtmosphereOrb position={[-3, -2, -3]} color="#a855f7" speed={0.35} />
      <AtmosphereOrb position={[3, 2, -4]} color="#3b82f6" speed={0.45} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} intensity={2} />
      </EffectComposer>
    </>
  )
}

// ─── Sparkle particles (CSS, triggered on diamond reveal) ─────────────────────
function Sparkles({ active }: { active: boolean }) {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * 360,
    delay: i * 0.04,
    distance: 28 + Math.random() * 16,
  }))

  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-emerald-300"
          style={{ top: '50%', left: '50%', marginTop: -3, marginLeft: -3 }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.6, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

function ExplosionParticles({ active }: { active: boolean }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    angle: (i / 12) * 360,
    delay: i * 0.02,
    distance: 32 + Math.random() * 20,
    color: i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#f97316' : '#fbbf24',
  }))

  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            top: '50%', left: '50%', marginTop: -4, marginLeft: -4,
            background: p.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1.5 }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.5, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

// ─── Individual Tile ──────────────────────────────────────────────────────────
interface TileProps {
  index: number
  state: TileState
  onClick: () => void
  disabled: boolean
  isHitMine: boolean
  revealDelay?: number
}

function MineTile({ index, state, onClick, disabled, isHitMine, revealDelay = 0 }: TileProps) {
  const [showSparkles, setShowSparkles] = useState(false)
  const [showExplosion, setShowExplosion] = useState(false)
  const prevState = useRef(state)

  useEffect(() => {
    if (prevState.current !== state) {
      if (state === 'safe') setShowSparkles(true)
      if (state === 'mine' || state === 'mine-revealed') setShowExplosion(true)
      prevState.current = state
    }
  }, [state])

  useEffect(() => {
    if (showSparkles) {
      const t = setTimeout(() => setShowSparkles(false), 700)
      return () => clearTimeout(t)
    }
  }, [showSparkles])

  useEffect(() => {
    if (showExplosion) {
      const t = setTimeout(() => setShowExplosion(false), 600)
      return () => clearTimeout(t)
    }
  }, [showExplosion])

  const isClickable = state === 'hidden' && !disabled

  return (
    <motion.div
      className={cn(
        'relative aspect-square rounded-xl cursor-pointer select-none overflow-visible',
        'transition-colors duration-150',
        isClickable ? 'cursor-pointer' : 'cursor-default',
      )}
      style={{ perspective: '600px' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.02, type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={isClickable ? { scale: 1.06, zIndex: 10 } : {}}
      whileTap={isClickable ? { scale: 0.94 } : {}}
      onClick={isClickable ? onClick : undefined}
    >
      {/* Tile face */}
      <AnimatePresence mode="wait">
        {state === 'hidden' && (
          <motion.div
            key="hidden"
            className={cn(
              'absolute inset-0 rounded-xl border flex items-center justify-center',
              'bg-gradient-to-br from-purple-950/80 to-slate-900/90',
              isClickable
                ? 'border-purple-700/40 hover:border-purple-500/70 hover:shadow-[0_0_16px_rgba(168,85,247,0.25)]'
                : 'border-purple-900/20',
            )}
            initial={{ rotateX: 0 }}
            exit={{ rotateX: -90, transition: { duration: 0.15 } }}
          >
            {/* Grid cross pattern */}
            <div className="absolute inset-0 rounded-xl overflow-hidden opacity-30">
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(139,92,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.15) 1px, transparent 1px)',
                backgroundSize: '8px 8px',
              }} />
            </div>
            {/* Center gem hint */}
            <div className="w-3 h-3 rounded-sm bg-purple-800/40 rotate-45 border border-purple-700/30" />
          </motion.div>
        )}

        {state === 'revealing' && (
          <motion.div
            key="revealing"
            className="absolute inset-0 rounded-xl bg-white/20 border border-white/40"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
        )}

        {state === 'safe' && (
          <motion.div
            key="safe"
            className="absolute inset-0 rounded-xl border border-emerald-500/50 bg-gradient-to-br from-emerald-950/90 to-green-900/80 flex items-center justify-center shadow-[inset_0_0_20px_rgba(16,185,129,0.15),0_0_20px_rgba(16,185,129,0.1)]"
            initial={{ rotateX: 90, scale: 0.8 }}
            animate={{ rotateX: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: revealDelay }}
          >
            {/* Diamond */}
            <motion.div
              className="relative flex items-center justify-center"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Outer glow */}
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-md scale-150" />
              {/* Diamond shape */}
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rotate-45 rounded-sm bg-gradient-to-br from-emerald-300 via-green-400 to-emerald-600 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                <div className="absolute inset-0 rotate-45 rounded-sm overflow-hidden">
                  <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-white/30 rounded-br-full" />
                </div>
              </div>
            </motion.div>
            {/* Sparkles */}
            <Sparkles active={showSparkles} />
          </motion.div>
        )}

        {(state === 'mine' || state === 'mine-revealed') && (
          <motion.div
            key="mine"
            className={cn(
              'absolute inset-0 rounded-xl border flex items-center justify-center',
              isHitMine
                ? 'border-red-500/80 bg-gradient-to-br from-red-950/95 to-rose-900/90 shadow-[inset_0_0_30px_rgba(239,68,68,0.3),0_0_30px_rgba(239,68,68,0.2)]'
                : 'border-red-800/40 bg-gradient-to-br from-red-950/70 to-slate-900/80',
            )}
            initial={state === 'mine' ? { scale: 1.2, rotateX: 90 } : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, rotateX: 0, opacity: 1 }}
            transition={state === 'mine'
              ? { type: 'spring', stiffness: 400, damping: 15 }
              : { delay: revealDelay * 0.5, duration: 0.3 }
            }
          >
            <motion.div
              className="text-3xl"
              animate={isHitMine ? {
                scale: [1, 1.3, 0.9, 1.1, 1],
                rotate: [-5, 5, -3, 3, 0],
              } : {}}
              transition={{ duration: 0.5 }}
            >
              💣
            </motion.div>
            {/* Explosion ring on hit mine */}
            {isHitMine && (
              <motion.div
                className="absolute inset-0 rounded-xl border-2 border-red-400"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.6 }}
              />
            )}
            <ExplosionParticles active={showExplosion} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Multiplier Display ───────────────────────────────────────────────────────
function MultiplierBadge({ multiplier, revealed, betAmount }: { multiplier: number; revealed: number; betAmount: number }) {
  const potentialWin = Math.round(betAmount * multiplier * 100) / 100
  const intensity = Math.min(revealed / 10, 1)

  return (
    <motion.div
      className="flex items-center gap-4 px-6 py-3 rounded-2xl border"
      style={{
        background: `rgba(16, 185, 129, ${0.05 + intensity * 0.1})`,
        borderColor: `rgba(52, 211, 153, ${0.2 + intensity * 0.4})`,
        boxShadow: `0 0 ${20 + intensity * 30}px rgba(16, 185, 129, ${0.05 + intensity * 0.15})`,
      }}
      key={multiplier}
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 0.25 }}
    >
      <div>
        <div className="text-[11px] text-white/40 uppercase tracking-widest">Multiplier</div>
        <motion.div
          className="text-2xl font-black"
          style={{ color: `hsl(${140 + intensity * 20}, 80%, ${60 + intensity * 15}%)` }}
          key={multiplier}
          initial={{ scale: 1.3, color: '#ffffff' }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          {multiplier.toFixed(2)}×
        </motion.div>
      </div>
      <div className="w-px h-10 bg-white/10" />
      <div>
        <div className="text-[11px] text-white/40 uppercase tracking-widest">Win if cashout</div>
        <div className="text-2xl font-black text-white">{potentialWin.toLocaleString()}</div>
      </div>
    </motion.div>
  )
}

// ─── Near-Win Tension overlay ─────────────────────────────────────────────────
function TensionOverlay({ revealed, maxSafe }: { revealed: number; maxSafe: number }) {
  const tension = Math.min(revealed / Math.max(maxSafe * 0.6, 1), 1)
  if (tension < 0.3) return null
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none rounded-2xl"
      animate={{
        boxShadow: [
          `inset 0 0 ${tension * 60}px rgba(168, 85, 247, ${tension * 0.12})`,
          `inset 0 0 ${tension * 80}px rgba(168, 85, 247, ${tension * 0.18})`,
          `inset 0 0 ${tension * 60}px rgba(168, 85, 247, ${tension * 0.12})`,
        ],
      }}
      transition={{ duration: 1.5 - tension, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// ─── Main Game Component ──────────────────────────────────────────────────────
export function MinesGame() {
  const [mineCount, setMineCount] = useState(3)
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [tiles, setTiles] = useState<TileState[]>(Array(25).fill('hidden'))
  const [shaking, setShaking] = useState(false)
  const isRevealingRef = useRef(false)

  const sounds = useSounds()
  const bet = useGameBet({ gameType: 'MINES', defaultAmount: 100 })

  const currentMultiplier = game ? getMinesMultiplier(game.mineCount, game.revealed.length) : 1
  const maxSafe = game ? 25 - game.mineCount : 25 - mineCount
  const isPlaying = game?.status === 'playing'

  // Screen shake on bomb
  const triggerShake = useCallback(() => {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }, [])

  // Build tile states from game state
  const computeTiles = useCallback((g: ActiveGame | null): TileState[] => {
    if (!g) return Array(25).fill('hidden')
    return Array.from({ length: 25 }, (_, i) => {
      if (g.revealed.includes(i)) return 'safe'
      if (g.status !== 'playing' && g.mines) {
        if (i === g.hitMine) return 'mine'
        if (g.mines.includes(i)) return 'mine-revealed'
      }
      return 'hidden'
    })
  }, [])

  const handleStartGame = useCallback(async () => {
    if (!bet.canBet || bet.isLoading) return
    bet.setIsLoading(true)
    sounds.playClick()
    setTiles(Array(25).fill('hidden'))

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
      setTiles(computeTiles(newGame))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      bet.setIsLoading(false)
    }
  }, [bet, mineCount, sounds, computeTiles])

  const handleReveal = useCallback(async (position: number) => {
    if (!game || game.status !== 'playing' || isRevealingRef.current) return
    if (tiles[position] !== 'hidden') return
    isRevealingRef.current = true
    sounds.playClick()

    // Optimistic: show revealing state
    setTiles(prev => {
      const next = [...prev]
      next[position] = 'revealing'
      return next
    })

    try {
      const data = await bet.apiCall('/api/games/mines/reveal', {
        txId: game.txId,
        position,
      })

      if (data.isMine) {
        sounds.playLose()
        triggerShake()
        const updatedGame: ActiveGame = {
          ...game,
          revealed: data.revealed,
          status: 'lost',
          mines: data.mines,
          hitMine: position,
        }
        setGame(updatedGame)

        // Stagger-reveal remaining mines
        const minePositions: number[] = data.mines.filter((m: number) => m !== position)
        setTiles(prev => {
          const next = [...prev]
          next[position] = 'mine'
          return next
        })

        minePositions.forEach((minePos: number, idx: number) => {
          setTimeout(() => {
            setTiles(prev => {
              const next = [...prev]
              next[minePos] = 'mine-revealed'
              return next
            })
          }, 150 + idx * 80)
        })

        bet.syncBalance({ newNeonCoins: data.newNeonCoins, newBalance: data.newBalance })
        toast.error('💣 Mine hit!', { duration: 2500 })
      } else {
        sounds.playWin()
        const updatedGame: ActiveGame = {
          ...game,
          revealed: data.revealed,
          status: data.autoWin ? 'won' : 'playing',
          ...(data.autoWin ? { mines: data.mines } : {}),
        }
        setGame(updatedGame)
        setTiles(prev => {
          const next = [...prev]
          next[position] = 'safe'
          return next
        })

        if (data.autoWin) {
          bet.syncBalance({ newNeonCoins: data.newNeonCoins, newBalance: data.newBalance })
          fireWinCelebration({ amount: game.betAmount * data.multiplier })
          toast.success(`🎉 ${data.multiplier}× — all safe tiles found!`)
        }
      }
    } catch (err) {
      setTiles(prev => {
        const next = [...prev]
        next[position] = 'hidden'
        return next
      })
      toast.error(err instanceof Error ? err.message : 'Reveal failed')
    } finally {
      isRevealingRef.current = false
    }
  }, [game, tiles, bet, sounds, triggerShake])

  const handleCashout = useCallback(async () => {
    if (!game || game.status !== 'playing' || game.revealed.length === 0) return
    bet.setIsLoading(true)
    sounds.playCashout()

    try {
      const data = await bet.apiCall('/api/games/mines/cashout', { txId: game.txId })
      bet.syncBalance(data)
      fireWinCelebration({ amount: data.winAmount })
      toast.success(`💰 ${data.multiplier}× — +${data.winAmount.toLocaleString()} ${bet.currency}!`)

      // Reveal mines after cashout
      const updatedGame: ActiveGame = { ...game, status: 'won', mines: data.mines }
      setGame(updatedGame)
      data.mines.forEach((minePos: number, idx: number) => {
        setTimeout(() => {
          setTiles(prev => {
            const next = [...prev]
            next[minePos] = 'mine-revealed'
            return next
          })
        }, idx * 60)
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cashout failed')
    } finally {
      bet.setIsLoading(false)
    }
  }, [game, bet, sounds])

  const handleReset = useCallback(() => {
    setGame(null)
    setTiles(Array(25).fill('hidden'))
    bet.setIsLoading(false)
  }, [bet])

  const panel = (
    <BettingPanel
      {...bet}
      onBet={isPlaying
        ? (game.revealed.length > 0 ? handleCashout : undefined)
        : handleStartGame
      }
      disabled={isPlaying && game.revealed.length === 0}
      actionLabel={
        isPlaying
          ? game.revealed.length === 0
            ? 'Reveal a tile...'
            : `Cashout ${currentMultiplier.toFixed(2)}×`
          : 'Start Game'
      }
      actionColor={
        isPlaying && game.revealed.length > 0
          ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400'
          : undefined
      }
    >
      {/* Mine count */}
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
            <span>1 mine</span>
            <span>24 mines</span>
          </div>
          {/* Mine count presets */}
          <div className="grid grid-cols-4 gap-1 mt-2">
            {[1, 3, 5, 10, 15, 20, 23, 24].map(n => (
              <button key={n} onClick={() => setMineCount(n)}
                className={cn(
                  'py-1 rounded text-xs font-bold border transition-all',
                  mineCount === n
                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Mines hidden</span>
            <span className="font-bold text-red-400">{game.mineCount} 💣</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Safe tiles left</span>
            <span className="font-bold text-emerald-400">{maxSafe - game.revealed.length}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Revealed</span>
            <span className="font-bold text-white">{game.revealed.length} / {maxSafe}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
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

  const gameView = (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 min-h-[500px]">

      {/* R3F atmosphere background */}
      <div className="absolute inset-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 1.5]} style={{ opacity: 0.6 }}>
          <Suspense fallback={null}>
            <Atmosphere />
          </Suspense>
        </Canvas>
      </div>

      {/* Multiplier bar */}
      {game && isPlaying && game.revealed.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10"
        >
          <MultiplierBadge
            multiplier={currentMultiplier}
            revealed={game.revealed.length}
            betAmount={game.betAmount}
          />
        </motion.div>
      )}

      {/* Board */}
      <motion.div
        className="relative z-10 w-full max-w-[440px]"
        animate={shaking ? {
          x: [-6, 6, -4, 4, -2, 2, 0],
          transition: { duration: 0.4 }
        } : {}}
        style={{ perspective: '1000px' }}
      >
        <motion.div
          className="relative p-3 sm:p-4 rounded-2xl"
          style={{
            background: 'rgba(10, 8, 25, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            transformStyle: 'preserve-3d',
            rotateX: 3,
          }}
        >
          {/* Board glow overlay on near-win */}
          {game && isPlaying && <TensionOverlay revealed={game.revealed.length} maxSafe={maxSafe} />}

          {/* Grid */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {tiles.map((state, i) => (
              <MineTile
                key={i}
                index={i}
                state={state}
                onClick={() => handleReveal(i)}
                disabled={!isPlaying || bet.isLoading}
                isHitMine={game?.hitMine === i}
                revealDelay={state === 'mine-revealed' ? i * 0.04 : 0}
              />
            ))}
          </div>

          {/* Board corner accents */}
          {(['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'] as const).map((pos, i) => (
            <div
              key={i}
              className={`absolute ${pos} w-4 h-4 border-purple-600/40`}
              style={{
                borderTopWidth: i < 2 ? 1 : 0,
                borderBottomWidth: i >= 2 ? 1 : 0,
                borderLeftWidth: i % 2 === 0 ? 1 : 0,
                borderRightWidth: i % 2 === 1 ? 1 : 0,
                borderRadius: i === 0 ? '4px 0 0 0' : i === 1 ? '0 4px 0 0' : i === 2 ? '0 0 0 4px' : '0 0 4px 0',
              }}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* End-game overlay */}
      <AnimatePresence>
        {game && !isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative z-20"
          >
            <div className={cn(
              'flex flex-col items-center gap-3 px-8 py-5 rounded-2xl border text-center',
              game.status === 'won'
                ? 'bg-emerald-950/90 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
                : 'bg-red-950/90 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.15)]',
            )}>
              <div className="text-3xl font-black text-white">
                {game.status === 'won' ? '🎉 Cashed Out!' : '💣 Game Over'}
              </div>
              <div className={cn(
                'text-lg font-bold',
                game.status === 'won' ? 'text-emerald-400' : 'text-red-400'
              )}>
                {game.status === 'won'
                  ? `${currentMultiplier.toFixed(2)}× — ${Math.round(game.betAmount * currentMultiplier)} ${game.currency}`
                  : `Lost ${game.betAmount} ${game.currency}`}
              </div>
              <button
                onClick={handleReset}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-white/80 hover:text-white transition-all font-semibold mt-1"
              >
                Play Again →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle prompt */}
      {!game && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 text-xs text-white/30 text-center mt-2"
        >
          Set your bet and mine count, then click Start Game
        </motion.p>
      )}
    </div>
  )

  return <GameLayout panel={panel} game={gameView} title="Mines" badge="Provably Fair" />
}
