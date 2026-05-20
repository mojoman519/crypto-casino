import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed, generateClientSeed, generateNonce, generateCoinflipResult } from '@/lib/provably-fair'
import { validateBet, getIp } from '@/lib/bet-validator'
import { beginBet, resolveBet, rollbackBet } from '@/lib/transaction-service'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const ip = getIp(req)

  try {
    const body = await req.json()
    const { choice, mode = 'neon' } = body

    if (!['heads', 'tails'].includes(choice)) {
      return NextResponse.json({ success: false, error: 'Choice must be heads or tails' }, { status: 400 })
    }

    // Validate bet against DB config (min/max/rate limit/fraud)
    const { config, currency, betAmount } = await validateBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'COINFLIP',
      betAmount: body.betAmount,
      mode,
      ipAddress: ip,
    })

    // Generate provably fair seeds
    const serverSeed = generateServerSeed()
    const serverSeedHash = hashServerSeed(serverSeed)
    const clientSeed = generateClientSeed()
    const nonce = generateNonce()

    // Atomically deduct balance and open ledger entry
    const { txId, signature } = await beginBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'COINFLIP',
      currency,
      betAmount,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      ipAddress: ip,
    })

    try {
      const result = generateCoinflipResult(serverSeed, clientSeed, nonce)
      const won = result === choice
      const winAmount = won ? betAmount * 2 * (1 - config.houseEdge) : 0

      const { newBalance, newNeonCoins, txSignature } = await resolveBet({
        txId,
        userId: payload.userId,
        username: payload.username,
        currency,
        won,
        winAmount,
        outcome: { result, choice, multiplier: 2 * (1 - config.houseEdge) },
        ipAddress: ip,
      })

      return NextResponse.json({
        success: true,
        data: {
          result, won, winAmount, betAmount, mode,
          newBalance,
          newNeonCoins,
          serverSeedHash, clientSeed, nonce, serverSeed,
          txId,
          signature: txSignature,
        },
      })
    } catch (gameErr) {
      await rollbackBet({ txId, userId: payload.userId, username: payload.username, currency, reason: String(gameErr), ipAddress: ip })
      throw gameErr
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = msg.includes('Rate limit') ? 429 : msg.includes('Insufficient') ? 400 : msg.includes('disabled') ? 503 : 500
    if (status === 500) console.error('[coinflip]', err)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const limit = Math.min(parseInt(new URL(req.url).searchParams.get('limit') || '20'), 100)

  const games = await db.coinflipGame.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ success: true, data: games })
}
