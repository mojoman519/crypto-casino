import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { verifyToken } from '@/lib/auth'
import { getIp } from '@/lib/bet-validator'
import { rollbackBet } from '@/lib/transaction-service'
import { revealTile, type MinesGameState } from '@/lib/game-engine/mines-engine'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/audit-logger'

// POST /api/games/mines/reveal — reveal a tile
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    ?? req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const ip = getIp(req)

  try {
    const { txId, position } = await req.json()

    if (typeof position !== 'number' || position < 0 || position > 24) {
      return NextResponse.json({ success: false, error: 'Position must be 0–24' }, { status: 400 })
    }

    const tx = await db.gameTransaction.findUnique({
      where: { id: txId },
      select: { userId: true, status: true, outcome: true, betAmount: true, currency: true },
    })

    if (!tx) return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 })
    if (tx.userId !== payload.userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    if (tx.status !== 'PENDING') return NextResponse.json({ success: false, error: 'Game is not active' }, { status: 400 })

    const state = tx.outcome as unknown as MinesGameState

    if (state.revealed.includes(position)) {
      return NextResponse.json({ success: false, error: 'Tile already revealed' }, { status: 400 })
    }

    const { isMine, newState, multiplier } = revealTile(state, position)

    if (isMine) {
      // Game over — rollback (player loses bet)
      await rollbackBet({
        txId,
        userId: payload.userId,
        username: payload.username,
        currency: tx.currency as 'NC' | 'SOL',
        reason: 'mines_hit',
        ipAddress: ip,
      })

      // Update transaction with final state (mines revealed)
      await db.gameTransaction.update({
        where: { id: txId },
        data: {
          outcome: { ...state, revealed: [...state.revealed, position], hitMine: position } as unknown as Prisma.InputJsonValue,
        },
      })

      auditLog({
        userId: payload.userId,
        username: payload.username,
        action: 'BET_LOST',
        severity: 'INFO',
        data: { txId, game: 'MINES', position, mines: state.mines },
        ipAddress: ip,
      })

      return NextResponse.json({
        success: true,
        data: {
          isMine: true,
          position,
          mines: state.mines, // now revealed
          revealed: [...state.revealed, position],
          multiplier: 0,
          gameOver: true,
        },
      })
    }

    // Safe tile — update stored state
    await db.gameTransaction.update({
      where: { id: txId },
      data: { outcome: newState as unknown as Prisma.InputJsonValue },
    })

    const safeTilesLeft = (25 - state.mineCount) - newState.revealed.length
    const autoWin = safeTilesLeft === 0

    return NextResponse.json({
      success: true,
      data: {
        isMine: false,
        position,
        multiplier,
        revealed: newState.revealed,
        gameOver: autoWin,
        autoWin,
        // Mines still hidden unless autoWin
        mines: autoWin ? state.mines : undefined,
      },
    })
  } catch (err) {
    console.error('[mines/reveal]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
