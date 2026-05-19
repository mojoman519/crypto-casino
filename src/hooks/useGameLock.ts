'use client'

import { useRef, useCallback, useState } from 'react'

export function useGameLock() {
  const lockRef = useRef(false)
  const [isLocked, setIsLocked] = useState(false)

  const lock = useCallback(() => {
    if (lockRef.current) return false
    lockRef.current = true
    setIsLocked(true)
    return true
  }, [])

  const unlock = useCallback(() => {
    lockRef.current = false
    setIsLocked(false)
  }, [])

  const withLock = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    if (!lock()) return null
    try {
      return await fn()
    } finally {
      unlock()
    }
  }, [lock, unlock])

  return { isLocked, lock, unlock, withLock }
}
