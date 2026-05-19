import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, decimals = 2): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`
  return amount.toFixed(decimals)
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`
}

export function formatDate(date: string | Date): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function randomColor(): string {
  const colors = [
    '#7c3aed', '#9333ea', '#a855f7',
    '#ec4899', '#f43f5e', '#e11d48',
    '#06b6d4', '#0ea5e9', '#3b82f6',
    '#10b981', '#14b8a6', '#22c55e',
    '#f59e0b', '#f97316', '#ef4444',
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}

export function calculateHouseEdge(amount: number, edge = 0.03): number {
  return amount * (1 - edge)
}

export function getCrashProbability(target: number): number {
  const houseEdge = 0.03
  return (1 - houseEdge) / target
}

export function getJackpotWinChance(userTickets: number, totalTickets: number): number {
  if (totalTickets === 0) return 0
  return (userTickets / totalTickets) * 100
}
