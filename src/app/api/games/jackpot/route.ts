import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { randomColor } from '@/lib/utils'

const MIN_BET = 1
const MAX_BET = 10_000

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { betAmount } = await req.json()

    if (typeof betAmount !== 'number' || betAmount < MIN_BET || betAmount > MAX_BET) {
      return NextResponse.json({ success: false, error: `Bet must be $${MIN_BET}–$${MAX_BET}` }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    if (user.balance < betAmount) return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 })

    // Get or create active jackpot round
    let round = await db.jackpotRound.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    })

    if (!round) {
      const { generateServerSeed, hashServerSeed } = await import('@/lib/provably-fair')
      const serverSeed = generateServerSeed()
      round = await db.jackpotRound.create({
        data: {
          serverSeed,
          serverSeedHash: hashServerSeed(serverSeed),
          status: 'ACTIVE',
        },
      })
    }

    const ticketStart = round.ticketTotal
    const ticketEnd = ticketStart + betAmount

    const [entry, updatedRound, updatedUser] = await db.$transaction([
      db.jackpotEntry.create({
        data: {
          userId: user.id,
          jackpotRoundId: round.id,
          betAmount,
          ticketStart,
          ticketEnd,
          color: randomColor(),
        },
      }),
      db.jackpotRound.update({
        where: { id: round.id },
        data: {
          poolAmount: { increment: betAmount },
          ticketTotal: { increment: betAmount },
        },
      }),
      db.user.update({
        where: { id: user.id },
        data: {
          balance: { decrement: betAmount },
          totalWagered: { increment: betAmount },
          gamesPlayed: { increment: 1 },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        entryId: entry.id,
        ticketStart,
        ticketEnd,
        poolAmount: updatedRound.poolAmount,
        newBalance: updatedUser.balance,
      },
    })
  } catch (err) {
    console.error('[games/jackpot]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
