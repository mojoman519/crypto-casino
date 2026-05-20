import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed } from '@/lib/provably-fair'
import { validateBet, getIp } from '@/lib/bet-validator'
import { beginBet } from '@/lib/transaction-service'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const ip = getIp(req)

  try {
    const body = await req.json()
    const { autoCashout, mode = 'neon' } = body

    const { config, currency, betAmount } = await validateBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'CRASH',
      betAmount: body.betAmount,
      mode,
      ipAddress: ip,
    })

    // Check active crash round
    const round = await db.crashRound.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    })
    if (!round) {
      return NextResponse.json({ success: false, error: 'No active crash round' }, { status: 409 })
    }

    // One bet per round
    const existing = await db.crashBet.findFirst({
      where: { userId: payload.userId, crashRoundId: round.id, status: 'ACTIVE' },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Already bet this round' }, { status: 409 })
    }

    // Open ledger entry and deduct balance
    const serverSeed = generateServerSeed()
    const { txId, signature } = await beginBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'CRASH',
      currency,
      betAmount,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: round.serverSeed,
      nonce: 0,
      ipAddress: ip,
    })

    // Create the crash bet entry (resolved later by socket cashout/crash)
    const [bet, updatedUser] = await db.$transaction([
      db.crashBet.create({
        data: {
          userId: payload.userId,
          crashRoundId: round.id,
          betAmount,
          autoCashout: autoCashout ?? null,
          status: 'ACTIVE',
        },
      }),
      db.user.findUnique({ where: { id: payload.userId } }),
    ])

    void config // used for rate limit / fraud only (balance deducted above)

    return NextResponse.json({
      success: true,
      data: {
        bet,
        txId,
        signature,
        newBalance: updatedUser?.balance ?? 0,
        newNeonCoins: updatedUser?.neonCoins ?? 0,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = msg.includes('Rate limit') ? 429 : msg.includes('Insufficient') ? 400 : msg.includes('disabled') ? 503 : 500
    if (status === 500) console.error('[crash]', err)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
