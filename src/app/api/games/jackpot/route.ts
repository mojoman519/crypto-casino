import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed } from '@/lib/provably-fair'
import { randomColor } from '@/lib/utils'
import { validateBet, getIp } from '@/lib/bet-validator'
import { beginBet, rollbackBet } from '@/lib/transaction-service'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const ip = getIp(req)

  try {
    const body = await req.json()
    const mode = 'neon' // Jackpot is NC only for now

    const { currency, betAmount } = await validateBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'JACKPOT',
      betAmount: body.betAmount,
      mode,
      ipAddress: ip,
    })

    // Get or create active jackpot round
    let round = await db.jackpotRound.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    })
    if (!round) {
      const serverSeed = generateServerSeed()
      round = await db.jackpotRound.create({
        data: { serverSeed, serverSeedHash: hashServerSeed(serverSeed), status: 'ACTIVE' },
      })
    }

    const serverSeed = generateServerSeed()
    const { txId, signature } = await beginBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'JACKPOT',
      currency,
      betAmount,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: round.serverSeed,
      nonce: 0,
      ipAddress: ip,
    })

    try {
      const ticketStart = round.ticketTotal
      const ticketEnd = ticketStart + betAmount

      const [entry, updatedRound, updatedUser] = await db.$transaction([
        db.jackpotEntry.create({
          data: {
            userId: payload.userId,
            jackpotRoundId: round.id,
            betAmount,
            ticketStart,
            ticketEnd,
            color: randomColor(),
          },
        }),
        db.jackpotRound.update({
          where: { id: round.id },
          data: { poolAmount: { increment: betAmount }, ticketTotal: { increment: betAmount } },
        }),
        db.user.findUnique({ where: { id: payload.userId } }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          entryId: entry.id,
          ticketStart,
          ticketEnd,
          poolAmount: updatedRound.poolAmount,
          newBalance: updatedUser?.balance ?? 0,
          newNeonCoins: updatedUser?.neonCoins ?? 0,
          txId,
          signature,
        },
      })
    } catch (gameErr) {
      await rollbackBet({ txId, userId: payload.userId, username: payload.username, currency, reason: String(gameErr), ipAddress: ip })
      throw gameErr
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = msg.includes('Rate limit') ? 429 : msg.includes('Insufficient') ? 400 : msg.includes('disabled') ? 503 : 500
    if (status === 500) console.error('[jackpot]', err)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
