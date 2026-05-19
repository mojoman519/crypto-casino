import type { Currency } from '@/types/transactions'

export function formatBalance(amount: number, currency: Currency): string {
  switch (currency) {
    case 'NC':
      if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M NC`
      if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K NC`
      return `${Math.floor(amount).toLocaleString()} NC`
    case 'SOL':
      return `${amount.toFixed(4)} SOL`
    case 'ETH':
      return `${amount.toFixed(6)} ETH`
    case 'USDC':
      return `$${amount.toFixed(2)}`
    default:
      return `${amount}`
  }
}

export function formatBalanceShort(amount: number, currency: Currency): string {
  switch (currency) {
    case 'NC':
      if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
      if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
      return Math.floor(amount).toLocaleString()
    case 'SOL':
      return amount.toFixed(4)
    case 'ETH':
      return amount.toFixed(5)
    case 'USDC':
      return `$${amount.toFixed(2)}`
    default:
      return `${amount}`
  }
}

export function parseBetAmount(value: string, currency: Currency): number {
  const n = parseFloat(value)
  if (isNaN(n) || n <= 0) return 0
  if (currency === 'NC') return Math.floor(n)
  return Math.max(0, n)
}

export function getMinBet(currency: Currency): number {
  switch (currency) {
    case 'NC': return 10
    case 'SOL': return 0.001
    case 'ETH': return 0.0001
    case 'USDC': return 0.01
  }
}

export function getMaxBet(currency: Currency): number {
  switch (currency) {
    case 'NC': return 10_000_000
    case 'SOL': return 100
    case 'ETH': return 10
    case 'USDC': return 10_000
  }
}
