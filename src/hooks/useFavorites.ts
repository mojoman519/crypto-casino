'use client'

import { useState, useEffect } from 'react'

const KEY = 'neonbet-favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored) setFavorites(JSON.parse(stored))
    } catch {}
  }, [])

  const toggle = (gameId: string) => {
    setFavorites(prev => {
      const next = prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const isFavorite = (gameId: string) => favorites.includes(gameId)

  return { favorites, toggle, isFavorite }
}
