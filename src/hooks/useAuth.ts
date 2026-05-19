'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, token, login, logout, setLoading, isLoading } = useAuthStore()

  useEffect(() => {
    if (!token || user) return

    setLoading(true)
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Invalid session')
        return r.json()
      })
      .then(({ data }) => {
        login(data.user, token)
      })
      .catch(() => {
        logout()
      })
      .finally(() => setLoading(false))
  }, [token]) // eslint-disable-line

  return { user, token, isLoading, isAuthenticated: !!user }
}
