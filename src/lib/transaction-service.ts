import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { db } from './db'
import { auditLog } from './audit-logger'

const SIGN_KEY = process.env.JWT_SECRET ?? 'dev-signing-key'

export type TxCurrency = 'NC' | 'SOL'

function getBalanceField(currency: TxCurrency): 'neonCoins' | 'solBalance' {
  return currency === 'NC' ? 'neonCoins' : 'solBalance'
}

function signPayload(data: object): string {
  return crypto
    .createHmac('sha256', SIGN_KEY)
    .update(JSON.stringify(data))
    .digest('hex')
}

export interface BeginBetResult {
  txId: string
  signature: string
}

export interface ResolveBetResult {
  newBalance: number
  newNeonCoins: number
  txSignature: string
}

// Step 1 — atomically lock balance and open a PENDING ledger entry
export async function beginBet(params: {
  userId: string
  username: string
  gameType: string
  currency: TxCurrency
  betAmount: number
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
  ipAddress?: string
}): Promise<BeginBetResult> {
  const field = getBalanceField(params.currency)

  const signature = signPayload({
    userId: params.userId,
    gameType: params.gameType,
    betAmount: params.betAmount,
    currency: params.currency,
    serverSeedHash: params.serverSeedHash,
    ts: Date.now(),
  })

  const gameTx = await db.$transaction(async (tx) => {
    // Re-read balance inside transaction to prevent race conditions
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { neonCoins: true, balance: true, solBalance: true, isBanned: true },
    })

    if (!user) throw new Error('User not found')
    if (user.isBanned) throw new Error('Account suspended')

    const currentBalance = user[field] as number
    if (currentBalance < params.betAmount) throw new Error('Insufficient balance')

    // Deduct balance and create ledger entry atomically
    const [entry] = await Promise.all([
      tx.gameTransaction.create({
        data: {
          userId: params.userId,
          gameType: params.gameType,
          currency: params.currency,
          betAmount: params.betAmount,
          status: 'PENDING',
          signature,
          serverSeed: params.serverSeed,
          serverSeedHash: params.serverSeedHash,
          clientSeed: params.clientSeed,
          nonce: params.nonce,
          ipAddress: params.ipAddress ?? null,
        },
      }),
      tx.user.update({
        where: { id: params.userId },
        data: { [field]: { decrement: params.betAmount } },
      }),
    ])

    return entry
  })

  auditLog({
    userId: params.userId,
    username: params.username,
    action: 'BET_PLACED',
    severity: 'INFO',
    data: { txId: gameTx.id, gameType: params.gameType, betAmount: params.betAmount, currency: params.currency },
    ipAddress: params.ipAddress,
  })

  return { txId: gameTx.id, signature }
}

// Step 2 — atomically credit winnings and close the ledger entry
export async function resolveBet(params: {
  txId: string
  userId: string
  username: string
  currency: TxCurrency
  won: boolean
  winAmount: number
  outcome: Record<string, unknown>
  ipAddress?: string
}): Promise<ResolveBetResult> {
  const field = getBalanceField(params.currency)

  // Fetch the pending transaction to get betAmount
  const pending = await db.gameTransaction.findUnique({
    where: { id: params.txId },
    select: { betAmount: true, status: true },
  })

  if (!pending) throw new Error('Transaction not found')
  if (pending.status !== 'PENDING') throw new Error('Transaction already resolved')

  const netAmount = params.won ? params.winAmount - pending.betAmount : -pending.betAmount

  const txSignature = signPayload({
    txId: params.txId,
    won: params.won,
    winAmount: params.winAmount,
    netAmount,
    ts: Date.now(),
  })

  const updatedUser = await db.$transaction(async (tx) => {
    const [user] = await Promise.all([
      tx.user.update({
        where: { id: params.userId },
        data: {
          ...(params.won
            ? { [field]: { increment: params.winAmount }, totalWon: { increment: params.winAmount }, totalLost: undefined }
            : { totalLost: { increment: pending.betAmount } }
          ),
          totalWagered: { increment: pending.betAmount },
          gamesPlayed: { increment: 1 },
        },
      }),
      tx.gameTransaction.update({
        where: { id: params.txId },
        data: {
          status: params.won ? 'WON' : 'LOST',
          winAmount: params.winAmount,
          netAmount,
          outcome: params.outcome as Prisma.InputJsonValue,
          resolvedAt: new Date(),
        },
      }),
    ])
    return user
  })

  auditLog({
    userId: params.userId,
    username: params.username,
    action: params.won ? 'BET_WON' : 'BET_LOST',
    severity: 'INFO',
    data: { txId: params.txId, winAmount: params.winAmount, netAmount },
    ipAddress: params.ipAddress,
  })

  return {
    newBalance: updatedUser.solBalance,
    newNeonCoins: updatedUser.neonCoins,
    txSignature,
  }
}

// Rollback — refund bet on server error
export async function rollbackBet(params: {
  txId: string
  userId: string
  username: string
  currency: TxCurrency
  reason: string
  ipAddress?: string
}): Promise<void> {
  const field = getBalanceField(params.currency)

  const pending = await db.gameTransaction.findUnique({
    where: { id: params.txId },
    select: { betAmount: true, status: true },
  })

  if (!pending || pending.status !== 'PENDING') return

  await db.$transaction([
    db.user.update({
      where: { id: params.userId },
      data: { [field]: { increment: pending.betAmount } },
    }),
    db.gameTransaction.update({
      where: { id: params.txId },
      data: { status: 'ROLLED_BACK', rollbackReason: params.reason, resolvedAt: new Date() },
    }),
  ])

  auditLog({
    userId: params.userId,
    username: params.username,
    action: 'BET_ROLLBACK',
    severity: 'WARN',
    data: { txId: params.txId, reason: params.reason, refunded: pending.betAmount },
    ipAddress: params.ipAddress,
  })
}
