import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { verifyToken } from '@/lib/auth'
import { getIp } from '@/lib/bet-validator'
import { resolveBet } from '@/lib/transaction-service'
import { getMinesMultiplier } from '@/lib/game-engine/multipliers'
import type { MinesGameState } from '@/lib/game-engine/mines-engine'
import { db } from '@/lib/db'

// POST /api/games/mines/cashout — cash out at current multiplier
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    ?? req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const ip = getIp(req)

  try {
    const { txId } = await req.json()

    const tx = await db.gameTransaction.findUnique({
      where: { id: txId },
      select: { userId: true, status: true, outcome: true, betAmount: true, currency: true },
    })

    if (!tx) return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 })
    if (tx.userId !== payload.userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    if (tx.status !== 'PENDING') return NextResponse.json({ success: false, error: 'Game is not active' }, { status: 400 })

    const state = tx.outcome as unknown as MinesGameState

    if (state.revealed.length === 0) {
      return NextResponse.json({ success: false, error: 'Reveal at least one tile before cashing out' }, { status: 400 })
    }

    const multiplier = getMinesMultiplier(state.mineCount, state.revealed.length)
    const winAmount = Math.round(tx.betAmount * multiplier * 100) / 100

    const { newBalance, newNeonCoins } = await resolveBet({
      txId,
      userId: payload.userId,
      username: payload.username,
      currency: tx.currency as 'NC' | 'SOL',
      won: true,
      winAmount,
      outcome: {
        ...state,
        cashedOut: true,
        finalMultiplier: multiplier,
        winAmount,
      },
      ipAddress: ip,
    })

    return NextResponse.json({
      success: true,
      data: {
        multiplier,
        winAmount,
        betAmount: tx.betAmount,
        revealed: state.revealed,
        mines: state.mines, // reveal mines on cashout
        newBalance,
        newNeonCoins,
        serverSeed: state.serverSeed,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      },
    })
  } catch (err) {
    console.error('[mines/cashout]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
