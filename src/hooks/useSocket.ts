'use client'

import { useEffect, useRef, useCallback } from 'react'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket-client'
import { useAuthStore } from '@/store/authStore'
import { useGameStore } from '@/store/gameStore'
import { useAuthStore as useAuth } from '@/store/authStore'
import type { LiveBetEvent } from '@/types'

export function useSocket() {
  const { user, token, updateBalance } = useAuthStore()
  const { addLiveBet, setCrashMultiplier, setCrashPhase, addCrashHistory } = useGameStore()
  const connected = useRef(false)

  const setupListeners = useCallback(() => {
    const socket = getSocket()

    socket.on('crash:tick', ({ multiplier }) => {
      setCrashMultiplier(multiplier)
    })

    socket.on('crash:started', () => {
      setCrashPhase('flying')
    })

    socket.on('crash:crashed', ({ crashPoint, id }) => {
      setCrashPhase('crashed')
      addCrashHistory({ crashPoint, id: id || `r_${Date.now()}` })
      setTimeout(() => setCrashPhase('waiting'), 3000)
    })

    socket.on('live:bet', (bet: LiveBetEvent) => {
      addLiveBet(bet)
    })

    socket.on('balance:updated', ({ balance }) => {
      updateBalance(balance)
    })

    socket.on('connect', () => {
      if (user && token) {
        socket.emit('user:join', { userId: user.id, token })
      }
    })

    socket.on('disconnect', () => {
      connected.current = false
    })
  }, [addCrashHistory, addLiveBet, setCrashMultiplier, setCrashPhase, token, updateBalance, user])

  useEffect(() => {
    if (!connected.current) {
      const socket = connectSocket(token ?? undefined)
      connected.current = true
      setupListeners()

      if (user && token && socket.connected) {
        socket.emit('user:join', { userId: user.id, token })
      }
    }

    return () => {
      const socket = getSocket()
      socket.off('crash:tick')
      socket.off('crash:started')
      socket.off('crash:crashed')
      socket.off('live:bet')
      socket.off('balance:updated')
    }
  }, [token, user, setupListeners])

  const emit = useCallback((event: string, data?: unknown) => {
    getSocket().emit(event, data)
  }, [])

  return { emit }
}
