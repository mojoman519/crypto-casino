import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed, generateClientSeed } from '@/lib/provably-fair'
import { validateBet, getIp } from '@/lib/bet-validator'
import { beginBet } from '@/lib/transaction-service'
import { createMinesState } from '@/lib/game-engine/mines-engine'
import { db } from '@/lib/db'

// POST /api/games/mines — start a new game (place bet, generate mines)
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    ?? req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const ip = getIp(req)

  try {
    const body = await req.json()
    const { mineCount = 3, mode = 'neon' } = body

    if (typeof mineCount !== 'number' || mineCount < 1 || mineCount > 24) {
      return NextResponse.json({ success: false, error: 'Mine count must be 1–24' }, { status: 400 })
    }

    // Prevent starting a new game while one is active
    const activeGame = await db.gameTransaction.findFirst({
      where: { userId: payload.userId, gameType: 'MINES', status: 'PENDING' },
    })
    if (activeGame) {
      return NextResponse.json({
        success: false,
        error: 'Active mines game in progress. Cashout or the game will auto-resolve.',
      }, { status: 400 })
    }

    const { config, currency, betAmount } = await validateBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'MINES',
      betAmount: body.betAmount,
      mode,
      ipAddress: ip,
    })

    const serverSeed = generateServerSeed()
    const serverSeedHash = hashServerSeed(serverSeed)
    const clientSeed = generateClientSeed()
    const nonce = Math.floor(Math.random() * 1_000_000)

    const gameState = createMinesState(serverSeed, clientSeed, nonce, mineCount)

    const { txId } = await beginBet({
      userId: payload.userId,
      username: payload.username,
      gameType: 'MINES',
      currency,
      betAmount,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      ipAddress: ip,
    })

    // Store game state in the transaction outcome (mines hidden from client)
    await db.gameTransaction.update({
      where: { id: txId },
      data: { outcome: gameState as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.json({
      success: true,
      data: {
        txId,
        mineCount,
        betAmount,
        currency,
        serverSeedHash,
        clientSeed,
        nonce,
        currentMultiplier: 1,
        revealed: [],
        // Mines NOT sent to client
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = msg.includes('Rate limit') ? 429 : msg.includes('Insufficient') ? 400 : msg.includes('disabled') ? 503 : 500
    if (status === 500) console.error('[mines/start]', err)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
