'use client'

import { useState, useRef, useCallback, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, RoundedBox, Float } from '@react-three/drei'
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

type TileState = 'hidden' | 'safe' | 'mine' | 'mine-revealed'

interface GameState {
  txId: string
  mineCount: number
  betAmount: number
  currency: 'NC' | 'SOL'
  revealed: number[]
  currentMultiplier: number
  tiles: TileState[]
  status: 'playing' | 'won' | 'lost'
}

// ─── Tile 3D ─────────────────────────────────────────────────────────────────
interface TileProps {
  position: [number, number, number]
  state: TileState
  onClick: () => void
  disabled: boolean
  index: number
}

function Tile({ position, state, onClick, disabled, index }: TileProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const scaleRef = useRef(1)
  const [hovered, setHovered] = useState(false)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const targetScale = hovered && state === 'hidden' && !disabled ? 1.08 : 1
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, delta * 12)
    meshRef.current.scale.setScalar(scaleRef.current)
  })

  const color = state === 'hidden'
    ? (hovered ? '#4c1d95' : '#1e1b4b')
    : state === 'safe'
    ? '#059669'
    : '#dc2626'

  const emissive = state === 'safe' ? '#10b981' : state === 'mine' || state === 'mine-revealed' ? '#ef4444' : '#6d28d9'
  const emissiveIntensity = state === 'hidden' ? (hovered ? 1.5 : 0.3) : 2

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={state === 'hidden' && !disabled ? onClick : undefined}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={[0.85, 0.85, 0.2]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Gem on safe tile */}
      {state === 'safe' && (
        <mesh position={[0, 0, 0.18]}>
          <octahedronGeometry args={[0.22]} />
          <meshStandardMaterial
            color="#34d399"
            emissive="#10b981"
            emissiveIntensity={3}
            metalness={0.2}
            roughness={0}
          />
        </mesh>
      )}

      {/* Skull on mine */}
      {(state === 'mine' || state === 'mine-revealed') && (
        <Text
          position={[0, 0, 0.15]}
          fontSize={0.35}
          anchorX="center"
          anchorY="middle"
        >
          💣
        </Text>
      )}

      {/* Hidden tile pattern */}
      {state === 'hidden' && (
        <>
          <mesh position={[0, 0, 0.12]}>
            <planeGeometry args={[0.6, 0.02]} />
            <meshStandardMaterial color="#4c1d95" emissive="#7c3aed" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.12]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[0.6, 0.02]} />
            <meshStandardMaterial color="#4c1d95" emissive="#7c3aed" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
    </group>
  )
}

// ─── Board 3D ─────────────────────────────────────────────────────────────────
interface BoardProps {
  tiles: TileState[]
  onTileClick: (i: number) => void
  disabled: boolean
}

function Board3D({ tiles, onTileClick, disabled }: BoardProps) {
  const GRID = 5
  const SPACING = 1.05

  return (
    <Float speed={0.5} rotationIntensity={0.05} floatIntensity={0.2}>
      <group>
        {/* Board base */}
        <mesh position={[0, 0, -0.2]}>
          <boxGeometry args={[GRID * SPACING + 0.3, GRID * SPACING + 0.3, 0.15]} />
          <meshStandardMaterial
            color="#0f0a1e"
            emissive="#1e0a3e"
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {tiles.map((state, i) => {
          const col = i % GRID
          const row = Math.floor(i / GRID)
          const x = (col - 2) * SPACING
          const y = (2 - row) * SPACING
          return (
            <Tile
              key={i}
              index={i}
              position={[x, y, 0]}
              state={state}
              onClick={() => onTileClick(i)}
              disabled={disabled}
            />
          )
        })}
      </group>
    </Float>
  )
}

function Scene({ tiles, onTileClick, disabled }: BoardProps) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 5, 5]} intensity={3} color="#a855f7" />
      <pointLight position={[-5, -3, 3]} intensity={2} color="#06b6d4" />
      <pointLight position={[5, -3, 3]} intensity={2} color="#ec4899" />
      <Board3D tiles={tiles} onTileClick={onTileClick} disabled={disabled} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.3} intensity={1.5} />
      </EffectComposer>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MinesGame() {
  const [mineCount, setMineCount] = useState(3)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const isRevealingRef = useRef(false)

  const sounds = useSounds()
  const game = useGameBet({ gameType: 'MINES', defaultAmount: 100 })

  const tiles: TileState[] = gameState
    ? Array.from({ length: 25 }, (_, i) => {
        if (gameState.status === 'lost') {
          // Show all mines after game over
          const minesArray = (gameState as GameState & { mines?: number[] }).mines
          if (minesArray?.includes(i)) return i === (gameState as GameState & { hitMine?: number }).hitMine ? 'mine' : 'mine-revealed'
        }
        if (gameState.revealed.includes(i)) return 'safe'
        const minesArray = (gameState as GameState & { mines?: number[] }).mines
        if (gameState.status !== 'playing' && minesArray?.includes(i)) return 'mine-revealed'
        return 'hidden'
      })
    : Array(25).fill('hidden')

  const currentMultiplier = gameState
    ? getMinesMultiplier(gameState.mineCount, gameState.revealed.length)
    : 1

  const potentialWin = gameState
    ? Math.round(gameState.betAmount * currentMultiplier * 100) / 100
    : 0

  const handleStartGame = useCallback(async () => {
    if (!game.canBet || game.isLoading) return
    game.setIsLoading(true)
    sounds.playClick()

    try {
      const data = await game.apiCall('/api/games/mines', {
        betAmount: game.betAmount,
        mineCount,
        mode: game.currency === 'NC' ? 'neon' : 'real',
      })

      setGameState({
        txId: data.txId,
        mineCount: data.mineCount,
        betAmount: data.betAmount,
        currency: data.currency,
        revealed: [],
        currentMultiplier: 1,
        tiles: Array(25).fill('hidden'),
        status: 'playing',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      game.setIsLoading(false)
    }
  }, [game, mineCount, sounds])

  const handleReveal = useCallback(async (position: number) => {
    if (!gameState || gameState.status !== 'playing' || isRevealingRef.current) return
    isRevealingRef.current = true
    sounds.playClick()

    try {
      const data = await game.apiCall('/api/games/mines/reveal', {
        txId: gameState.txId,
        position,
      })

      if (data.isMine) {
        sounds.playLose()
        setGameState(prev => prev ? {
          ...prev,
          revealed: data.revealed,
          status: 'lost',
          mines: data.mines,
          hitMine: position,
        } as GameState & { mines: number[]; hitMine: number } : null)
        game.syncBalance({ newNeonCoins: data.newNeonCoins, newBalance: data.newBalance })
        toast.error('💣 Mine hit! Better luck next time.', { duration: 3000 })
      } else {
        sounds.playWin()
        const newState = {
          ...gameState,
          revealed: data.revealed,
          currentMultiplier: data.multiplier,
          status: data.autoWin ? 'won' as const : 'playing' as const,
        }

        if (data.autoWin) {
          game.syncBalance({ newNeonCoins: data.newNeonCoins, newBalance: data.newBalance })
          fireWinCelebration({ amount: gameState.betAmount * data.multiplier })
          toast.success(`🎉 All safe tiles revealed! ${data.multiplier}× win!`)
          setGameState({ ...newState, mines: data.mines } as GameState & { mines: number[] })
          return
        }

        setGameState(newState as GameState)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reveal failed')
    } finally {
      isRevealingRef.current = false
    }
  }, [gameState, game, sounds])

  const handleCashout = useCallback(async () => {
    if (!gameState || gameState.status !== 'playing' || gameState.revealed.length === 0) return
    game.setIsLoading(true)
    sounds.playCashout()

    try {
      const data = await game.apiCall('/api/games/mines/cashout', { txId: gameState.txId })
      game.syncBalance(data)
      fireWinCelebration({ amount: data.winAmount })
      toast.success(`💰 Cashed out ${data.multiplier}× — +${data.winAmount} ${game.currency}!`)
      setGameState(prev => prev ? {
        ...prev,
        status: 'won',
        mines: data.mines,
        currentMultiplier: data.multiplier,
      } as GameState & { mines: number[] } : null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cashout failed')
    } finally {
      game.setIsLoading(false)
    }
  }, [gameState, game, sounds])

  const handleReset = useCallback(() => {
    setGameState(null)
    game.setIsLoading(false)
  }, [game])

  const isPlaying = gameState?.status === 'playing'

  const panel = (
    <BettingPanel
      {...game}
      onBet={isPlaying ? handleCashout : handleStartGame}
      actionLabel={isPlaying ? (gameState.revealed.length === 0 ? 'Start Game' : `Cashout ${currentMultiplier}×`) : 'Start Game'}
      actionColor={isPlaying && gameState.revealed.length > 0
        ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400'
        : undefined}
      disabled={isPlaying && gameState.revealed.length === 0}
    >
      {/* Mine count selector */}
      {!isPlaying && (
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">Mines: {mineCount}</label>
          <input
            type="range"
            min={1}
            max={24}
            value={mineCount}
            onChange={e => setMineCount(parseInt(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
            <span>1 (safe)</span>
            <span>24 (risky)</span>
          </div>
        </div>
      )}

      {/* Playing stats */}
      {isPlaying && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Multiplier</span>
            <span className="font-bold text-emerald-400">{currentMultiplier}×</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Potential Win</span>
            <span className="font-bold text-white">{potentialWin} {game.currency}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Tiles Revealed</span>
            <span className="font-bold text-white">{gameState.revealed.length}/{25 - gameState.mineCount}</span>
          </div>
        </div>
      )}
    </BettingPanel>
  )

  const gameView = (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-4">
      {/* Status overlay */}
      <AnimatePresence>
        {gameState && gameState.status !== 'playing' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 px-8 py-4 rounded-2xl border',
              gameState.status === 'won'
                ? 'bg-emerald-600/20 border-emerald-500/40'
                : 'bg-red-600/20 border-red-500/40'
            )}
          >
            <div className="text-2xl font-black text-white">
              {gameState.status === 'won' ? '🎉 Win!' : '💣 Boom!'}
            </div>
            <div className="text-sm text-white/60">
              {gameState.status === 'won'
                ? `${currentMultiplier}× multiplier`
                : 'Hit a mine'}
            </div>
            <button
              onClick={handleReset}
              className="mt-1 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white/70 hover:text-white transition-all"
            >
              Play Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Board */}
      <div className="w-full" style={{ height: 'min(500px, 60vw)' }}>
        <Canvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          style={{ background: 'transparent' }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene
              tiles={tiles}
              onTileClick={handleReveal}
              disabled={!isPlaying || game.isLoading}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* 2D Grid fallback/overlay for clear hit detection on mobile */}
      <div className="grid grid-cols-5 gap-1.5 p-4 w-full max-w-[320px] lg:hidden">
        {tiles.map((state, i) => (
          <button
            key={i}
            onClick={() => state === 'hidden' && isPlaying && !game.isLoading && handleReveal(i)}
            disabled={state !== 'hidden' || !isPlaying || game.isLoading}
            className={cn(
              'aspect-square rounded-lg border flex items-center justify-center text-xl transition-all',
              state === 'hidden' && isPlaying ? 'bg-purple-900/40 border-purple-600/30 hover:bg-purple-800/50 cursor-pointer' : '',
              state === 'safe' ? 'bg-emerald-900/40 border-emerald-500/40' : '',
              state === 'mine' ? 'bg-red-900/50 border-red-500/50' : '',
              state === 'mine-revealed' ? 'bg-red-900/30 border-red-800/30' : '',
              (!isPlaying || state !== 'hidden') ? 'cursor-default' : '',
            )}
          >
            {state === 'safe' && '💎'}
            {(state === 'mine' || state === 'mine-revealed') && '💣'}
          </button>
        ))}
      </div>
    </div>
  )

  return <GameLayout panel={panel} game={gameView} title="Mines" badge="Provably Fair" />
}
