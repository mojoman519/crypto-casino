import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getGameConfig } from '@/lib/game-config'
import { resolveBet, rollbackBet } from '@/lib/transaction-service'
import { getIp } from '@/lib/bet-validator'
import type { TxCurrency } from '@/lib/transaction-service'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const ip = getIp(req)
    const { multiplier } = await req.json()

    if (typeof multiplier !== 'number' || multiplier < 1) {
      return NextResponse.json({ success: false, error: 'Invalid multiplier' }, { status: 400 })
    }

    // Find active crash bet
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

    if (multiplier > bet.crashRound.crashPoint) {
      return NextResponse.json({ success: false, error: 'Cannot cashout after crash' }, { status: 409 })
    }

    // Find the matching PENDING GameTransaction to get correct currency
    const gameTx = await db.gameTransaction.findFirst({
      where: { userId: payload.userId, gameType: 'CRASH', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })

    const config = await getGameConfig('CRASH')
    const winAmount = bet.betAmount * multiplier * (1 - config.houseEdge)
    const currency = (gameTx?.currency ?? 'NC') as TxCurrency

    // Update crash bet record
    await db.crashBet.update({
      where: { id: bet.id },
      data: { cashoutMultiplier: multiplier, winAmount, status: 'COMPLETED' },
    })

    // Resolve through transaction service (credits correct balance field)
    let newBalance = 0
    let newNeonCoins = 0

    if (gameTx) {
      const result = await resolveBet({
        txId: gameTx.id,
        userId: payload.userId,
        username: payload.username,
        currency,
        won: true,
        winAmount,
        outcome: { multiplier, crashPoint: bet.crashRound.crashPoint },
        ipAddress: ip,
      })
      newBalance = result.newBalance
      newNeonCoins = result.newNeonCoins
    } else {
      // Fallback: direct credit if no GameTransaction found (legacy bets)
      const updated = await db.user.update({
        where: { id: payload.userId },
        data: { balance: { increment: winAmount }, totalWon: { increment: winAmount } },
      })
      newBalance = updated.balance
      newNeonCoins = updated.neonCoins
    }

    return NextResponse.json({
      success: true,
      data: { cashoutMultiplier: multiplier, winAmount, newBalance, newNeonCoins },
    })
  } catch (err) {
    console.error('[crash/cashout]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
