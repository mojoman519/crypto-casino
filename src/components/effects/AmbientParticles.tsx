'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useParticleEngine } from '@/hooks/useParticleEngine'

interface Props {
  theme?: string
  className?: string
  /** z-index of the canvas layer */
  zIndex?: number
}

/**
 * Drop this anywhere to add ambient floating particles behind content.
 * The canvas is pointer-events:none so it never blocks clicks.
 *
 * Usage:
 *   <div className="relative">
 *     <AmbientParticles />
 *     <YourContent />
 *   </div>
 */
export function AmbientParticles({ theme, className, zIndex = 0 }: Props) {
  const pathname = usePathname()
  const isGamePage = pathname?.startsWith('/games/')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useParticleEngine(canvasRef, { theme, enabled: !isGamePage })

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
