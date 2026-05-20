'use client'

import { useRef, useEffect } from 'react'
import { useParticleEngine } from '@/hooks/useParticleEngine'

export interface WinCelebrationEvent {
  amount: number
  x?: number  // screen X (optional — defaults to center)
  y?: number  // screen Y (optional — defaults to center)
}

/** Dispatch this event from any game component to trigger the win burst */
export function fireWinCelebration(detail: WinCelebrationEvent) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('win-celebration', { detail }))
}

/**
 * Mount this ONCE in layout.tsx — it listens globally for 'win-celebration'
 * events and renders particle bursts on a full-screen overlay canvas.
 */
export function CelebrationOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { celebrateAt } = useParticleEngine(canvasRef, { theme: 'neonDiamonds' })

  useEffect(() => {
    const handler = (e: Event) => {
      const { amount, x, y } = (e as CustomEvent<WinCelebrationEvent>).detail
      const canvas = canvasRef.current
      if (!canvas) return

      const cx = x ?? window.innerWidth / 2
      const cy = y ?? window.innerHeight * 0.4

      // Scale burst intensity with win size
      const intensity = amount > 10000 ? 2.0 : amount > 1000 ? 1.5 : 1.0
      const count = amount > 10000 ? 120 : amount > 1000 ? 90 : 60

      celebrateAt(cx, cy, count, intensity)
    }

    window.addEventListener('win-celebration', handler)
    return () => window.removeEventListener('win-celebration', handler)
  }, [celebrateAt])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
        willChange: 'transform',
      }}
      aria-hidden="true"
    />
  )
}
