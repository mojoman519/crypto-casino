'use client'

import { useEffect, useRef, useCallback } from 'react'
import { ParticleEngine } from '@/lib/particle-engine'

interface Options {
  theme?: string
  density?: number
  enabled?: boolean
  /** Set to 0 for celebration-only engines that shouldn't spawn ambient particles */
  ambientCount?: number
}

export function useParticleEngine(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: Options = {}
) {
  const engineRef = useRef<ParticleEngine | null>(null)
  const { theme, enabled = true, ambientCount } = options

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !enabled) return

    const engine = new ParticleEngine()
    engineRef.current = engine
    engine.init(canvas, theme)
    engine.start(ambientCount)

    // Mouse repulsion
    const onMouseMove = (e: MouseEvent) => engine.setMousePos(e.clientX, e.clientY)
    const onMouseLeave = () => engine.clearMouse()
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseleave', onMouseLeave, { passive: true })

    // Resize
    const onResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      engine.destroy()
      engineRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('resize', onResize)
    }
  }, [enabled, theme]) // eslint-disable-line

  /** Fire a win burst at the center of the viewport */
  const celebrate = useCallback((intensity = 1.0) => {
    const engine = engineRef.current
    if (!engine || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    engine.triggerCelebration(rect.width / 2, rect.height / 2, 80, intensity)
  }, []) // eslint-disable-line

  /** Fire a burst at specific canvas-relative coordinates */
  const celebrateAt = useCallback((x: number, y: number, count = 80, intensity = 1.0) => {
    engineRef.current?.triggerCelebration(x, y, count, intensity)
  }, [])

  /** Load custom images into the engine */
  const loadImages = useCallback((urls: string[]) => {
    engineRef.current?.loadCustomImages(urls)
  }, [])

  /** Switch particle theme at runtime */
  const setTheme = useCallback((themeId: string) => {
    engineRef.current?.setTheme(themeId)
  }, [])

  return { celebrate, celebrateAt, loadImages, setTheme, engineRef }
}
