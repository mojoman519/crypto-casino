'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  duration?: number
  decimals?: number
}

export function AnimatedCounter({ value, duration = 2000, decimals = 0 }: Props) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    startRef.current = display
    startTimeRef.current = null

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startRef.current + (value - startRef.current) * eased
      setDisplay(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(value)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value]) // eslint-disable-line

  const formatted = display >= 1_000_000
    ? `${(display / 1_000_000).toFixed(1)}M`
    : display >= 1_000
    ? `${(display / 1_000).toFixed(1)}K`
    : display.toFixed(decimals)

  return <span className="tabular-nums">{formatted}</span>
}
