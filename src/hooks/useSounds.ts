'use client'

import { useRef, useCallback } from 'react'

export function useSounds() {
  const ctxRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(true)

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      } catch {
        return null
      }
    }
    return ctxRef.current
  }, [])

  const tone = useCallback((freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.08) => {
    if (!enabledRef.current) return
    const ctx = getCtx()
    if (!ctx) return
    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch {}
  }, [getCtx])

  const playBet = useCallback(() => {
    tone(220, 0.1, 'square', 0.05)
  }, [tone])

  const playWin = useCallback(() => {
    tone(523, 0.1, 'sine')
    setTimeout(() => tone(659, 0.1, 'sine'), 100)
    setTimeout(() => tone(784, 0.25, 'sine'), 200)
  }, [tone])

  const playLose = useCallback(() => {
    tone(220, 0.15, 'sawtooth', 0.06)
    setTimeout(() => tone(185, 0.3, 'sawtooth', 0.04), 150)
  }, [tone])

  const playCoinFlip = useCallback(() => {
    let i = 0
    const flip = () => {
      tone(300 + i * 20, 0.05, 'square', 0.04)
      i++
      if (i < 12) setTimeout(flip, 80 + i * 8)
    }
    flip()
  }, [tone])

  const playCrashTick = useCallback((multiplier: number) => {
    const freq = Math.min(200 + multiplier * 30, 800)
    tone(freq, 0.04, 'sine', 0.03)
  }, [tone])

  const playCrashBoom = useCallback(() => {
    tone(80, 0.6, 'sawtooth', 0.15)
    setTimeout(() => tone(60, 0.4, 'sawtooth', 0.08), 100)
  }, [tone])

  const playCashout = useCallback(() => {
    tone(600, 0.08, 'sine')
    setTimeout(() => tone(750, 0.08, 'sine'), 80)
    setTimeout(() => tone(900, 0.2, 'sine'), 160)
  }, [tone])

  const playRouletteSpin = useCallback(() => {
    let speed = 60
    let i = 0
    const tick = () => {
      tone(400 + Math.sin(i) * 50, 0.03, 'square', 0.03)
      i++
      speed = Math.min(speed + 5, 300)
      if (i < 30) setTimeout(tick, Math.max(300 / speed, 30))
    }
    tick()
  }, [tone])

  const playDiceRoll = useCallback(() => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => tone(100 + Math.random() * 200, 0.08, 'square', 0.05), i * 60)
    }
  }, [tone])

  const toggle = useCallback(() => {
    enabledRef.current = !enabledRef.current
  }, [])

  return {
    playBet, playWin, playLose, playCoinFlip,
    playCrashTick, playCrashBoom, playCashout,
    playRouletteSpin, playDiceRoll, toggle,
  }
}
