'use client'

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, RoundedBox, Sphere, MeshTransmissionMaterial, Environment } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import { useGameBet } from '@/hooks/useGameBet'
import { BettingPanel } from '@/components/game-engine/BettingPanel'
import { GameLayout } from '@/components/game-engine/GameLayout'
import { PLINKO_MULTIPLIERS } from '@/lib/game-engine/multipliers'
import { fireWinCelebration } from '@/components/effects/CelebrationOverlay'
import { useSounds } from '@/hooks/useSounds'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

type Risk = 'low' | 'medium' | 'high'
type RowCount = 8 | 12 | 16

const BUCKET_COLORS: Record<string, string> = {
  high: '#ef4444',   // red for high multipliers
  med: '#f59e0b',
  low: '#6366f1',
  zero: '#374151',
}

function getBucketColor(multiplier: number): string {
  if (multiplier >= 10) return BUCKET_COLORS.high
  if (multiplier >= 3) return BUCKET_COLORS.med
  if (multiplier >= 1) return BUCKET_COLORS.low
  return BUCKET_COLORS.zero
}

// ─── Peg ────────────────────────────────────────────────────────────────────
function Peg({ position, lit }: { position: [number, number, number]; lit?: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current && lit) {
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 2, delta * 8)
    } else if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0.3, delta * 4)
    }
  })
  return (
    <mesh ref={ref} position={position}>
      <cylinderGeometry args={[0.08, 0.08, 0.3, 12]} />
      <meshStandardMaterial
        color={lit ? '#a855f7' : '#4c1d95'}
        emissive={lit ? '#a855f7' : '#6d28d9'}
        emissiveIntensity={0.3}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  )
}

// ─── Ball ────────────────────────────────────────────────────────────────────
interface BallProps {
  path: boolean[]
  rows: number
  onComplete: () => void
  active: boolean
}

function Ball({ path, rows, onComplete, active }: BallProps) {
  const ref = useRef<THREE.Mesh>(null)
  const progressRef = useRef(0)
  const completedRef = useRef(false)
  const colX = useRef(0) // current column (centered)

  useEffect(() => {
    progressRef.current = 0
    completedRef.current = false
    colX.current = 0
    if (ref.current) {
      ref.current.position.set(0, rows * 0.6, 0.2)
    }
  }, [path, rows, active])

  useFrame((_, delta) => {
    if (!active || !ref.current || completedRef.current) return

    progressRef.current += delta * 2.5

    const row = Math.floor(progressRef.current)
    const frac = progressRef.current - row

    if (row >= rows) {
      completedRef.current = true
      onComplete()
      return
    }

    // Interpolate position to next peg
    const targetX = colX.current + (path[row] ? 0.5 : -0.5)
    const currentY = (rows - row) * 0.6
    const nextY = (rows - row - 1) * 0.6

    ref.current.position.x = THREE.MathUtils.lerp(colX.current * 0.6, targetX * 0.6, Math.min(frac, 1))
    ref.current.position.y = THREE.MathUtils.lerp(currentY, nextY, Math.min(frac, 1))
    ref.current.position.z = 0.2 + Math.sin(frac * Math.PI) * 0.15

    if (frac >= 1) colX.current = colX.current + (path[row] ? 1 : -1)
  })

  if (!active) return null

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial
        color="#f0abfc"
        emissive="#c026d3"
        emissiveIntensity={2}
        metalness={0.1}
        roughness={0.1}
      />
    </mesh>
  )
}

// ─── Bucket ──────────────────────────────────────────────────────────────────
function Bucket({ x, y, multiplier, lit, width }: { x: number; y: number; multiplier: number; lit: boolean; width: number }) {
  const color = getBucketColor(multiplier)
  const ref = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, lit ? 3 : 0.2, delta * 8)
  })

  return (
    <group position={[x * 0.6, y, 0]}>
      <mesh ref={ref}>
        <boxGeometry args={[width * 0.58, 0.25, 0.2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          metalness={0.5}
          roughness={0.4}
          transparent
          opacity={0.85}
        />
      </mesh>
      <Text
        position={[0, 0, 0.15]}
        fontSize={0.13}
        color="white"
        font="/fonts/inter-bold.woff"
        anchorX="center"
        anchorY="middle"
      >
        {multiplier >= 100 ? `${multiplier}×` : multiplier >= 10 ? `${multiplier}×` : `${multiplier}×`}
      </Text>
    </group>
  )
}

// ─── Board ───────────────────────────────────────────────────────────────────
interface BoardProps {
  rows: RowCount
  risk: Risk
  activePath: boolean[] | null
  landedBucket: number | null
}

function Board({ rows, risk, activePath, landedBucket }: BoardProps) {
  const pegs: [number, number, number][] = []
  const litPegs = new Set<string>()

  // Compute lit pegs from active path
  if (activePath) {
    let col = 0
    for (let row = 0; row < activePath.length; row++) {
      litPegs.add(`${row}-${col + row}`) // peg key
      col += activePath[row] ? 1 : 0
    }
  }

  // Build peg grid
  for (let row = 0; row < rows; row++) {
    const pegsInRow = row + 2
    const rowWidth = pegsInRow - 1
    for (let col = 0; col < pegsInRow; col++) {
      pegs.push([
        (col - rowWidth / 2) * 0.6,
        (rows - row) * 0.6,
        0,
      ])
    }
  }

  const multipliers = PLINKO_MULTIPLIERS[risk]?.[rows] ?? []
  const buckets = multipliers.length
  const bucketWidth = 1

  return (
    <group>
      {/* Board backing */}
      <mesh position={[0, rows * 0.3, -0.2]}>
        <planeGeometry args={[(rows + 2) * 0.6, (rows + 2) * 0.6]} />
        <meshStandardMaterial color="#0a0a14" transparent opacity={0.8} />
      </mesh>

      {/* Pegs */}
      {pegs.map((pos, i) => {
        const row = Math.floor(-1 + Math.sqrt(1 + 8 * i) / 2)
        return <Peg key={i} position={pos} lit={litPegs.has(`${row}-${i}`)} />
      })}

      {/* Buckets */}
      {multipliers.map((mult, i) => (
        <Bucket
          key={i}
          x={i - (buckets - 1) / 2}
          y={0}
          multiplier={mult}
          lit={landedBucket === i}
          width={bucketWidth}
        />
      ))}
    </group>
  )
}

// ─── Scene ───────────────────────────────────────────────────────────────────
interface SceneProps {
  rows: RowCount
  risk: Risk
  activePath: boolean[] | null
  landedBucket: number | null
  onBallComplete: () => void
}

function Scene({ rows, risk, activePath, landedBucket, onBallComplete }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, rows * 0.5, 5]} intensity={2} color="#a855f7" />
      <pointLight position={[-5, 0, 3]} intensity={1} color="#06b6d4" />
      <pointLight position={[5, 0, 3]} intensity={1} color="#ec4899" />

      <Board rows={rows} risk={risk} activePath={activePath} landedBucket={landedBucket} />

      {activePath && (
        <Ball
          path={activePath}
          rows={rows}
          active={true}
          onComplete={onBallComplete}
        />
      )}

      <EffectComposer>
        <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} height={300} intensity={1.2} />
      </EffectComposer>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PlinkoGame() {
  const [rows, setRows] = useState<RowCount>(16)
  const [risk, setRisk] = useState<Risk>('medium')
  const [activePath, setActivePath] = useState<boolean[] | null>(null)
  const [landedBucket, setLandedBucket] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<{ multiplier: number; won: boolean } | null>(null)
  const pendingResult = useRef<{ multiplier: number; won: boolean; winAmount: number; newNeonCoins?: number; newBalance?: number } | null>(null)

  const sounds = useSounds()
  const game = useGameBet({ gameType: 'PLINKO', defaultAmount: 100 })

  const handleBallComplete = useCallback(() => {
    const result = pendingResult.current
    if (!result) return
    setLastResult({ multiplier: result.multiplier, won: result.won })
    game.syncBalance(result)
    if (result.won) {
      sounds.playWin()
      if (result.multiplier >= 10) fireWinCelebration({ amount: result.winAmount })
    } else {
      sounds.playLose()
    }
    pendingResult.current = null
    game.setIsLoading(false)
  }, [game, sounds])

  const handleBet = useCallback(async () => {
    if (!game.canBet || game.isLoading) return
    game.setIsLoading(true)
    setLandedBucket(null)
    setLastResult(null)
    sounds.playClick()

    try {
      const data = await game.apiCall('/api/games/plinko', {
        betAmount: game.betAmount,
        rows,
        risk,
        mode: game.currency === 'NC' ? 'neon' : 'real',
      })

      pendingResult.current = {
        multiplier: data.multiplier,
        won: data.won,
        winAmount: data.winAmount,
        newNeonCoins: data.newNeonCoins,
        newBalance: data.newBalance,
      }

      setActivePath(data.path)
      setLandedBucket(data.bucket)

      setTimeout(() => {
        if (pendingResult.current) {
          handleBallComplete()
          setActivePath(null)
        }
      }, (rows / 2.5 + 1) * 1000)
    } catch (err) {
      game.setIsLoading(false)
      toast.error(err instanceof Error ? err.message : 'Bet failed')
    }
  }, [game, rows, risk, sounds, handleBallComplete])

  const multipliers = PLINKO_MULTIPLIERS[risk]?.[rows] ?? []

  const panel = (
    <BettingPanel
      {...game}
      onBet={game.autoBet.enabled ? () => game.startAutoBet(async () => {
        await handleBet()
        return { won: pendingResult.current?.won ?? false }
      }) : handleBet}
      onStopAutoBet={game.stopAutoBet}
      actionLabel="Drop Ball"
    >
      {/* Rows selector */}
      <div>
        <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">Rows</label>
        <div className="flex gap-1">
          {([8, 12, 16] as RowCount[]).map(r => (
            <button
              key={r}
              onClick={() => setRows(r)}
              disabled={game.isLoading}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                rows === r
                  ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/60'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Risk selector */}
      <div className="mt-3">
        <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">Risk</label>
        <div className="flex gap-1">
          {(['low', 'medium', 'high'] as Risk[]).map(r => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              disabled={game.isLoading}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize',
                risk === r
                  ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/60'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </BettingPanel>
  )

  const gameView = (
    <div className="relative w-full h-full flex flex-col">
      {/* Result overlay */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn(
              'absolute top-4 left-1/2 -translate-x-1/2 z-20 px-6 py-2 rounded-full font-black text-lg border',
              lastResult.won
                ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                : 'bg-red-600/20 border-red-500/30 text-red-300'
            )}
          >
            {lastResult.won ? `${lastResult.multiplier}×` : 'No win'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Canvas */}
      <div className="flex-1 w-full">
        <Canvas
          camera={{ position: [0, rows * 0.3, rows * 0.8], fov: 50 }}
          style={{ background: 'transparent' }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene
              rows={rows}
              risk={risk}
              activePath={activePath}
              landedBucket={landedBucket}
              onBallComplete={handleBallComplete}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Multiplier buckets display (2D overlay for readability) */}
      <div className="flex gap-0.5 px-4 pb-3 overflow-x-auto">
        {multipliers.map((m, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 min-w-[28px] py-1 rounded text-center text-[10px] font-black transition-all duration-300',
              landedBucket === i ? 'scale-110 shadow-lg' : '',
            )}
            style={{
              background: `${getBucketColor(m)}${landedBucket === i ? 'cc' : '33'}`,
              color: landedBucket === i ? '#fff' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${getBucketColor(m)}${landedBucket === i ? 'ff' : '44'}`,
            }}
          >
            {m}×
          </div>
        ))}
      </div>
    </div>
  )

  return <GameLayout panel={panel} game={gameView} title="Plinko" badge="Provably Fair" />
}
