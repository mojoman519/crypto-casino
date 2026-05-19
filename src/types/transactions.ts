export type Currency = 'NC' | 'SOL' | 'ETH' | 'USDC'
export type TransactionType = 'BET' | 'WIN' | 'LOSS' | 'DEPOSIT' | 'WITHDRAWAL' | 'REFERRAL_BONUS' | 'BONUS' | 'TRANSFER'
export type GameType = 'COINFLIP' | 'CRASH' | 'JACKPOT'

export interface WalletTransaction {
  id: string
  type: TransactionType
  currency: Currency
  amount: number
  description: string
  timestamp: number
  gameType?: GameType
  balanceAfter: number
  status: 'pending' | 'confirmed' | 'failed' | 'rolled_back'
}

export interface BalanceSnapshot {
  NC: number
  SOL: number
  ETH: number
  USDC: number
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  NC: 'Neon Coins',
  SOL: 'Solana',
  ETH: 'Ethereum',
  USDC: 'USDC',
}

export const CURRENCY_ICONS: Record<Currency, string> = {
  NC: '🎮',
  SOL: '◎',
  ETH: 'Ξ',
  USDC: '$',
}

export const CURRENCY_COLORS: Record<Currency, string> = {
  NC: 'text-purple-300',
  SOL: 'text-emerald-300',
  ETH: 'text-blue-300',
  USDC: 'text-green-300',
}
