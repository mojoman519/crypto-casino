import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed, generateClientSeed, generateResult } from '@/lib/provably-fair'
import { validateBet, getIp } from '@/lib/bet-validator'
import { beginBet, resolveBet, rollbackBet } from '@/lib/transaction-service'

const BASE_PAYOUTS = { red: 2, black: 2, green: 24 } as const

function getOutcome(rand: number): 'red' | 'black' | 'green' {
  if (rand < 0.48) return 'red'
  if (rand < 0.96) return 'black'
  return 'green'
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
    const { choice, mode = 'neon' } = body

    if (!['red', 'black', 'green'].includes(choice)) {
      return NextResponse.json({ success: false, error: 'Choice must be red, black, or green' }, { status: 400 })
    }

    const { config, currency, betAmount } = await validateBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'ROULETTE',
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
      gameType: 'ROULETTE',
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
      const result = getOutcome(rand)
      const won = result === choice
      const payout = BASE_PAYOUTS[result]
      const winAmount = won ? betAmount * payout * (1 - config.houseEdge) : 0

      const { newBalance, newNeonCoins, txSignature } = await resolveBet({
        txId,
        userId: payload.userId,
        username: payload.username,
        currency,
        won,
        winAmount,
        outcome: { result, choice, payout },
        ipAddress: ip,
      })

      return NextResponse.json({
        success: true,
        data: {
          result, won, winAmount, betAmount, payout,
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
    if (status === 500) console.error('[roulette]', err)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
