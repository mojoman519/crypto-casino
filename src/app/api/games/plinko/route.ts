import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed, generateClientSeed } from '@/lib/provably-fair'
import { validateBet, getIp } from '@/lib/bet-validator'
import { beginBet, resolveBet, rollbackBet } from '@/lib/transaction-service'
import { computePlinkoResult } from '@/lib/game-engine/plinko-physics'

const VALID_ROWS = [8, 12, 16]
const VALID_RISKS = ['low', 'medium', 'high']

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    ?? req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const ip = getIp(req)

  try {
    const body = await req.json()
    const { rows = 16, risk = 'medium', mode = 'neon' } = body

    if (!VALID_ROWS.includes(rows)) {
      return NextResponse.json({ success: false, error: 'Rows must be 8, 12, or 16' }, { status: 400 })
    }
    if (!VALID_RISKS.includes(risk)) {
      return NextResponse.json({ success: false, error: 'Risk must be low, medium, or high' }, { status: 400 })
    }

    const { config, currency, betAmount } = await validateBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'PLINKO',
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
      gameType: 'PLINKO',
      currency,
      betAmount,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      ipAddress: ip,
    })

    try {
      const { path, bucket, multiplier, winAmount } = computePlinkoResult({
        serverSeed,
        clientSeed,
        nonce,
        rows,
        risk,
        betAmount,
      })

      const won = winAmount > 0

      const { newBalance, newNeonCoins, txSignature } = await resolveBet({
        txId,
        userId: payload.userId,
        username: payload.username,
        currency,
        won,
        winAmount: won ? winAmount : 0,
        outcome: { path, bucket, multiplier, rows, risk },
        ipAddress: ip,
      })

      return NextResponse.json({
        success: true,
        data: {
          path, bucket, multiplier, winAmount, betAmount, rows, risk,
          won, newBalance, newNeonCoins,
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
    if (status === 500) console.error('[plinko]', err)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
