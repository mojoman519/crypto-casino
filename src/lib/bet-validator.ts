import { db } from './db'
import { getGameConfig, getMinBet, getMaxBet, type GameSettings } from './game-config'
import { auditLog } from './audit-logger'
import type { TxCurrency } from './transaction-service'

export interface ValidatedBet {
  config: GameSettings
  currency: TxCurrency
  betAmount: number
}

interface ValidateParams {
  userId: string
  username: string
  gameType: string
  betAmount: number
  mode: string          // 'neon' | 'real'
  ipAddress?: string
}

// Rate limit: check bets in the last 60s and 60min from GameTransaction ledger
async function checkRateLimit(
  userId: string,
  username: string,
  gameType: string,
  config: GameSettings,
  ipAddress?: string
): Promise<void> {
  const now = new Date()
  const oneMinAgo = new Date(now.getTime() - 60_000)
  const oneHourAgo = new Date(now.getTime() - 3_600_000)

  const [perMin, perHour] = await Promise.all([
    db.gameTransaction.count({
      where: { userId, gameType, createdAt: { gte: oneMinAgo }, status: { not: 'ROLLED_BACK' } },
    }),
    db.gameTransaction.count({
      where: { userId, gameType, createdAt: { gte: oneHourAgo }, status: { not: 'ROLLED_BACK' } },
    }),
  ])

  if (perMin >= config.maxBetsPerMin) {
    auditLog({ userId, username, action: 'RATE_LIMITED', severity: 'WARN',
      data: { gameType, perMin, limit: config.maxBetsPerMin }, ipAddress })
    throw new Error(`Rate limit: max ${config.maxBetsPerMin} bets/min on ${config.name}`)
  }
  if (perHour >= config.maxBetsPerHour) {
    auditLog({ userId, username, action: 'RATE_LIMITED', severity: 'WARN',
      data: { gameType, perHour, limit: config.maxBetsPerHour }, ipAddress })
    throw new Error(`Rate limit: max ${config.maxBetsPerHour} bets/hour on ${config.name}`)
  }
}

// Fraud detection: flag anomalous win rates and rapid high-value betting
async function checkFraud(
  userId: string,
  username: string,
  gameType: string,
  betAmount: number,
  currency: TxCurrency,
  ipAddress?: string
): Promise<void> {
  const tenMinAgo = new Date(Date.now() - 600_000)

  const recent = await db.gameTransaction.findMany({
    where: { userId, gameType, createdAt: { gte: tenMinAgo }, status: { in: ['WON', 'LOST'] } },
    select: { status: true, betAmount: true, winAmount: true },
  })

  if (recent.length >= 10) {
    const wins = recent.filter(t => t.status === 'WON').length
    const winRate = wins / recent.length

    // Flag if win rate > 80% over last 10+ bets (statistically near-impossible for fair games)
    if (winRate > 0.8) {
      auditLog({ userId, username, action: 'FRAUD_DETECTED', severity: 'ALERT',
        data: { gameType, winRate: winRate.toFixed(2), sampleSize: recent.length, betAmount, currency },
        ipAddress })
    }
  }

  // Flag large bets from users with no prior history
  const totalBets = await db.gameTransaction.count({ where: { userId } })
  const isHighBet = (currency === 'NC' && betAmount > 100_000) || (currency === 'SOL' && betAmount > 1)

  if (totalBets < 5 && isHighBet) {
    auditLog({ userId, username, action: 'FRAUD_FLAGGED', severity: 'WARN',
      data: { reason: 'large_bet_new_user', betAmount, currency, totalBets }, ipAddress })
  }
}

// Main validator — call this before beginBet()
export async function validateBet(params: ValidateParams): Promise<ValidatedBet> {
  const config = await getGameConfig(params.gameType)

  if (!config.isEnabled) {
    throw new Error(`${config.name} is currently disabled`)
  }

  const currency: TxCurrency = params.mode === 'neon' ? 'NC' : 'SOL'
  const minBet = getMinBet(config, currency)
  const maxBet = getMaxBet(config, currency)

  if (typeof params.betAmount !== 'number' || isNaN(params.betAmount) || params.betAmount <= 0) {
    throw new Error('Invalid bet amount')
  }
  if (params.betAmount < minBet) {
    throw new Error(`Minimum bet is ${minBet} ${currency}`)
  }
  if (params.betAmount > maxBet) {
    throw new Error(`Maximum bet is ${maxBet} ${currency}`)
  }

  await checkRateLimit(params.userId, params.username, params.gameType, config, params.ipAddress)
  await checkFraud(params.userId, params.username, params.gameType, params.betAmount, currency, params.ipAddress)

  return { config, currency, betAmount: params.betAmount }
}

// Helper: get IP from Next.js request headers
export function getIp(req: { headers: { get: (k: string) => string | null } }): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? undefined
}
