import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed, generateClientSeed, generateResult } from '@/lib/provably-fair'
import { validateBet, getIp } from '@/lib/bet-validator'
import { beginBet, resolveBet, rollbackBet } from '@/lib/transaction-service'

function getPayout(target: number, direction: 'over' | 'under', houseEdge: number): number {
  const chance = direction === 'over' ? (99 - target) / 100 : (target - 1) / 100
  if (chance <= 0) return 0
  return (1 - houseEdge) / chance
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const ip = getIp(req)

  try {
    const body = await req.json()
    const { target, direction, mode = 'neon' } = body

    if (!['over', 'under'].includes(direction)) {
      return NextResponse.json({ success: false, error: 'Direction must be over or under' }, { status: 400 })
    }
    if (typeof target !== 'number' || target < 2 || target > 98) {
      return NextResponse.json({ success: false, error: 'Target must be 2–98' }, { status: 400 })
    }

    const { config, currency, betAmount } = await validateBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'DICE',
      betAmount: body.betAmount,
      mode,
      ipAddress: ip,
    })

    const serverSeed = generateServerSeed()
    const serverSeedHash = hashServerSeed(serverSeed)
    const clientSeed = generateClientSeed()
    const nonce = Math.floor(Math.random() * 1_000_000)

    const { txId } = await beginBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'DICE',
      currency,
      betAmount,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      ipAddress: ip,
    })

    try {
      const rand = generateResult(serverSeed, clientSeed, nonce)
      const result = Math.floor(rand * 100)
      const won = direction === 'over' ? result > target : result < target
      const payoutMultiplier = getPayout(target, direction as 'over' | 'under', config.houseEdge)
      const winAmount = won ? betAmount * payoutMultiplier : 0

      const { newBalance, newNeonCoins, txSignature } = await resolveBet({
        txId,
        userId: payload.userId,
        username: payload.username,
        currency,
        won,
        winAmount,
        outcome: { result, target, direction, payoutMultiplier },
        ipAddress: ip,
      })

      return NextResponse.json({
        success: true,
        data: {
          result, won, winAmount, betAmount, target, direction,
          payoutMultiplier: parseFloat(payoutMultiplier.toFixed(4)),
          newBalance, newNeonCoins,
          serverSeedHash, serverSeed, clientSeed, nonce,
          txId, signature: txSignature,
        },
      })
    } catch (gameErr) {
      await rollbackBet({ txId, userId: payload.userId, username: payload.username, currency, reason: String(gameErr), ipAddress: ip })
      throw gameErr
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = msg.includes('Rate limit') ? 429 : msg.includes('Insufficient') ? 400 : msg.includes('disabled') ? 503 : 500
    if (status === 500) console.error('[dice]', err)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
