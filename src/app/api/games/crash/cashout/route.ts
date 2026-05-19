import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

const HOUSE_EDGE = parseFloat(process.env.HOUSE_EDGE || '0.03')

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { multiplier } = await req.json()

    if (typeof multiplier !== 'number' || multiplier < 1) {
      return NextResponse.json({ success: false, error: 'Invalid multiplier' }, { status: 400 })
    }

    // Find active bet
    const bet = await db.crashBet.findFirst({
      where: { userId: payload.userId, status: 'ACTIVE' },
      include: { crashRound: true },
    })

    if (!bet) {
      return NextResponse.json({ success: false, error: 'No active bet found' }, { status: 404 })
    }

    if (bet.crashRound.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, error: 'Round already ended' }, { status: 409 })
    }

    // Verify multiplier is valid (hasn't crashed yet)
    const crashPoint = bet.crashRound.crashPoint
    if (multiplier > crashPoint) {
      return NextResponse.json({ success: false, error: 'Cannot cashout after crash' }, { status: 409 })
    }

    const winAmount = bet.betAmount * multiplier * (1 - HOUSE_EDGE)

    const [updatedBet, updatedUser] = await db.$transaction([
      db.crashBet.update({
        where: { id: bet.id },
        data: {
          cashoutMultiplier: multiplier,
          winAmount,
          status: 'COMPLETED',
        },
      }),
      db.user.update({
        where: { id: payload.userId },
        data: {
          balance: { increment: winAmount },
          totalWon: { increment: winAmount },
        },
      }),
      db.transaction.create({
        data: {
          userId: payload.userId,
          type: 'WIN',
          amount: winAmount,
          status: 'CONFIRMED',
          note: `Crash cashout at ${multiplier.toFixed(2)}x`,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        cashoutMultiplier: multiplier,
        winAmount,
        newBalance: updatedUser.balance,
      },
    })
  } catch (err) {
    console.error('[games/crash/cashout]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
