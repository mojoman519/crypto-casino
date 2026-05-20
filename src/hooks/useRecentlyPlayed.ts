'use client'

import { useState, useEffect } from 'react'

const KEY = 'neonbet-recently-played'
const MAX = 5

export function useRecentlyPlayed() {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored) setRecent(JSON.parse(stored))
    } catch {}
  }, [])

  const add = (gameId: string) => {
    setRecent(prev => {
      const next = [gameId, ...prev.filter(id => id !== gameId)].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  return { recent, add }
}
