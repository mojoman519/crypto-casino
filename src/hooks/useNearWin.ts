'use client'

import { useRef, useCallback } from 'react'

/**
 * Near-win animation system.
 *
 * The SERVER already knows the outcome before the animation starts.
 * This hook generates a suspenseful animation path that leads to the
 * TRUE outcome — slowing dramatically near the threshold to build tension.
 * It NEVER shows a false result; only controls the pacing of the reveal.
 */

export interface DiceNearWinConfig {
  /** Actual result from server (0–99) */
  result: number
  /** Player's target number */
  target: number
  /** 'over' | 'under' */
  direction: 'over' | 'under'
  /** Did the player win? */
  won: boolean
  /** Callback called each frame with current display value */
  onTick: (value: number) => void
  /** Called when animation ends with final value */
  onComplete: (value: number) => void
}

export interface RouletteNearWinConfig {
  /** Final outcome: 'red' | 'black' | 'green' */
  result: 'red' | 'black' | 'green'
  /** Player's choice */
  choice: 'red' | 'black' | 'green'
  /** Did the player win? */
  won: boolean
  /** Returns current spin angle 0-360 */
  onAngleUpdate: (angle: number) => void
  /** Returns ball bounce phase info */
  onBallUpdate: (bounces: number, nearChoice: boolean) => void
  /** Called when spin ends */
  onComplete: () => void
}

// ─── Easing functions ─────────────────────────────────────────────────────────

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNearWin() {
  const rafRef = useRef<number>(0)

  const cancel = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  /**
   * Dice near-win animation.
   * Rolls a counter from a random start → slows near target → lands on result.
   * Near-miss: if loss and result is within 5 of threshold, extra slow-down.
   */
  const animateDice = useCallback((config: DiceNearWinConfig) => {
    cancel()
    const { result, target, direction, won, onTick, onComplete } = config

    const isNearMiss = !won && Math.abs(result - target) <= 5
    const totalDuration = isNearMiss ? 2400 : won && Math.abs(result - target) <= 3 ? 2200 : 1800

    // Starting value — pick a start point on the opposite side for drama
    const startValue = direction === 'over'
      ? Math.max(0, target - 30 - Math.floor(Math.random() * 20))
      : Math.min(99, target + 30 + Math.floor(Math.random() * 20))

    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const raw = Math.min(elapsed / totalDuration, 1)

      // Custom easing: fast start, dramatic slow-down near threshold
      let t: number
      const threshold = isNearMiss ? 0.65 : won ? 0.7 : 0.6

      if (raw < threshold) {
        t = easeInOutQuart(raw / threshold) * threshold
      } else {
        // Near-threshold zone: very slow
        const localT = (raw - threshold) / (1 - threshold)
        t = threshold + easeOutExpo(localT) * (1 - threshold)
      }

      const current = Math.round(startValue + (result - startValue) * t)
      onTick(Math.max(0, Math.min(99, current)))

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        onTick(result)
        onComplete(result)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [cancel])

  /**
   * Roulette near-win spin animation.
   * Wheel does 4–6 full rotations then slows to land on result.
   * If near-miss: ball passes through player's color zone before landing on result.
   */
  const animateRoulette = useCallback((config: RouletteNearWinConfig) => {
    cancel()
    const { result, choice, won, onAngleUpdate, onBallUpdate, onComplete } = config

    // Map result to wheel angle (0–360)
    const resultAngles: Record<string, number[]> = {
      red:   [10, 50, 100, 150, 200, 250, 300],
      black: [30, 80, 130, 180, 230, 280, 330],
      green: [0, 180],
    }

    const choiceAngles = resultAngles[choice]
    const resultAngleBase = resultAngles[result]
    const finalAngle = resultAngleBase[Math.floor(Math.random() * resultAngleBase.length)]

    const rotations = 4 + Math.floor(Math.random() * 3) // 4–6 full spins
    const totalAngle = rotations * 360 + finalAngle
    const totalDuration = won ? 3500 : 3200

    // Near-miss: ball will pass close to player's color before landing
    const isNearMiss = !won && Math.random() < 0.4
    let nearMissFired = false

    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const raw = Math.min(elapsed / totalDuration, 1)

      // Ease: fast start, very slow end (realistic wheel deceleration)
      const t = raw < 0.8
        ? easeInOutQuart(raw / 0.8) * 0.85
        : 0.85 + easeOutExpo((raw - 0.8) / 0.2) * 0.15

      const currentAngle = (totalAngle * t) % 360

      // Check if we're near player's choice zone during deceleration
      if (isNearMiss && raw > 0.75 && !nearMissFired) {
        const nearChoice = choiceAngles.some(a => Math.abs(currentAngle - a) < 15)
        if (nearChoice) {
          nearMissFired = true
          onBallUpdate(1, true) // ball near player's choice
        }
      }

      onAngleUpdate(currentAngle)

      const bounces = Math.floor(raw * 8)
      onBallUpdate(bounces, false)

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        onAngleUpdate(finalAngle)
        onComplete()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [cancel])

  /**
   * Jackpot near-win: enhances the existing wheel slowdown.
   * Returns a multiplier (0–1) to apply to wheel speed.
   * Slows dramatically when near player's segment.
   */
  const getJackpotSpeedMultiplier = useCallback((
    currentProgress: number,
    playerTicketStart: number,
    playerTicketEnd: number,
    totalTickets: number,
    winningTicket: number,
  ): number => {
    if (currentProgress < 0.6) return 1.0 // full speed early on

    // Map winning ticket to wheel angle
    const winAngle = (winningTicket / totalTickets) * 360
    const playerStart = (playerTicketStart / totalTickets) * 360
    const playerEnd = (playerTicketEnd / totalTickets) * 360

    // How close is the winning position to player's segment?
    const distToPlayer = Math.min(
      Math.abs(winAngle - playerStart),
      Math.abs(winAngle - playerEnd),
    )
    const isNearPlayer = distToPlayer < 30

    const baseDeccel = easeOutExpo((currentProgress - 0.6) / 0.4)

    // Extra slowdown if near player's segment (builds tension)
    if (isNearPlayer && currentProgress > 0.7) {
      return 1.0 - baseDeccel * 0.95 // almost stops
    }

    return 1.0 - baseDeccel * 0.85
  }, [])

  return { animateDice, animateRoulette, getJackpotSpeedMultiplier, cancel }
}
