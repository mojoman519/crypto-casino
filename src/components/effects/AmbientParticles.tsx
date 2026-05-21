'use client'

import { useRef } from 'react'
import { useParticleEngine } from '@/hooks/useParticleEngine'

interface Props {
  theme?: string
  className?: string
  /** z-index of the canvas layer */
  zIndex?: number
  /** Pass false to pause the rAF loop (e.g. on game pages) */
  enabled?: boolean
}

export function AmbientParticles({ theme, className, zIndex = 0, enabled = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useParticleEngine(canvasRef, { theme, enabled })

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex,
        // Hint browser to use compositor thread
        willChange: 'transform',
      }}
      aria-hidden="true"
    />
  )
}
