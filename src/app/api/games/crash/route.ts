import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { betAmount, autoCashout } = await req.json()

    if (typeof betAmount !== 'number' || betAmount <= 0 || betAmount > 50_000) {
      return NextResponse.json({ success: false, error: 'Invalid bet amount' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    if (user.balance < betAmount) return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 })

    // Get or create active crash round
    let round = await db.crashRound.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    })

    if (!round) {
      return NextResponse.json({ success: false, error: 'No active round' }, { status: 409 })
    }

    // Check if user already has an active bet in this round
    const existingBet = await db.crashBet.findFirst({
      where: { userId: user.id, crashRoundId: round.id, status: 'ACTIVE' },
    })

    if (existingBet) {
      return NextResponse.json({ success: false, error: 'Already placed a bet this round' }, { status: 409 })
    }

    const [bet, updatedUser] = await db.$transaction([
      db.crashBet.create({
        data: {
          userId: user.id,
          crashRoundId: round.id,
          betAmount,
          autoCashout: autoCashout ?? null,
          status: 'ACTIVE',
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
      data: { bet, newBalance: updatedUser.balance },
    })
  } catch (err) {
    console.error('[games/crash]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
