import { useAuthStore } from '@/store/authStore'

export function getAuthToken(): string {
  return useAuthStore.getState().token ?? ''
}

export function authHeader(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
