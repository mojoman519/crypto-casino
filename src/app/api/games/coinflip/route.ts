import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import {
  generateServerSeed, hashServerSeed, generateClientSeed,
  generateNonce, generateCoinflipResult,
} from '@/lib/provably-fair'

const HOUSE_EDGE = parseFloat(process.env.HOUSE_EDGE || '0.03')
const MIN_BET = 0.01
const MAX_BET = 10_000

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value

    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { betAmount, choice, mode = 'real' } = await req.json()

    if (!['heads', 'tails'].includes(choice)) {
      return NextResponse.json({ success: false, error: 'Invalid choice' }, { status: 400 })
    }

    if (typeof betAmount !== 'number' || betAmount < MIN_BET || betAmount > MAX_BET) {
      return NextResponse.json({ success: false, error: `Bet must be between $${MIN_BET} and $${MAX_BET}` }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    if (user.isBanned) return NextResponse.json({ success: false, error: 'Account suspended' }, { status: 403 })

    const isNeonMode = mode === 'neon'
    const currentBalance = isNeonMode ? user.neonCoins : user.balance
    if (currentBalance < betAmount) {
      return NextResponse.json({
        success: false,
        error: isNeonMode ? 'Not enough Neon Coins' : 'Insufficient balance'
      }, { status: 400 })
    }

    // Generate provably fair result
    const serverSeed = generateServerSeed()
    const serverSeedHash = hashServerSeed(serverSeed)
    const clientSeed = generateClientSeed()
    const nonce = generateNonce()
    const result = generateCoinflipResult(serverSeed, clientSeed, nonce)

    const won = result === choice
    const winAmount = won ? betAmount * 2 * (1 - HOUSE_EDGE) : 0
    const balanceDelta = won ? winAmount - betAmount : -betAmount

    const balanceUpdate = isNeonMode
      ? { neonCoins: user.neonCoins + balanceDelta }
      : { balance: user.balance + balanceDelta }

    const [game, updatedUser] = await db.$transaction([
      db.coinflipGame.create({
        data: {
          userId: user.id,
          betAmount,
          choice,
          result,
          winAmount,
          multiplier: 2 * (1 - HOUSE_EDGE),
          serverSeed,
          clientSeed,
          nonce,
          hashResult: serverSeedHash,
          status: 'COMPLETED',
        },
      }),
      db.user.update({
        where: { id: user.id },
        data: {
          ...balanceUpdate,
          totalWagered: { increment: betAmount },
          totalWon: won ? { increment: winAmount } : undefined,
          totalLost: won ? undefined : { increment: betAmount },
          gamesPlayed: { increment: 1 },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        gameId: game.id,
        result,
        won,
        winAmount,
        betAmount,
        mode,
        newBalance: updatedUser.balance,
        newNeonCoins: updatedUser.neonCoins,
        serverSeedHash,
        clientSeed,
        nonce,
        serverSeed,
      },
    })
  } catch (err) {
    console.error('[games/coinflip]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

  const games = await db.coinflipGame.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ success: true, data: games })
}
