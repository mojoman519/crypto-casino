import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed, generateClientSeed, generateResult } from '@/lib/provably-fair'

const HOUSE_EDGE = 0.04
const PAYOUTS = { red: 2, black: 2, green: 24 }

function getOutcome(rand: number): 'red' | 'black' | 'green' {
  // 0-0.47: red (48%), 0.48-0.95: black (48%), 0.96-0.99: green (4%)
  if (rand < 0.48) return 'red'
  if (rand < 0.96) return 'black'
  return 'green'
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { betAmount, choice, mode = 'neon' } = await req.json()

    if (!['red', 'black', 'green'].includes(choice)) {
      return NextResponse.json({ success: false, error: 'Invalid choice' }, { status: 400 })
    }
    if (typeof betAmount !== 'number' || betAmount <= 0 || betAmount > 100_000) {
      return NextResponse.json({ success: false, error: 'Invalid bet amount' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    if (user.isBanned) return NextResponse.json({ success: false, error: 'Account suspended' }, { status: 403 })

    const isNeon = mode === 'neon'
    const currentBalance = isNeon ? user.neonCoins : user.balance
    if (currentBalance < betAmount) {
      return NextResponse.json({ success: false, error: isNeon ? 'Not enough Neon Coins' : 'Insufficient balance' }, { status: 400 })
    }

    const serverSeed = generateServerSeed()
    const clientSeed = generateClientSeed()
    const nonce = Math.floor(Math.random() * 1_000_000)
    const rand = generateResult(serverSeed, clientSeed, nonce)
    const result = getOutcome(rand)
    const won = result === choice
    const payout = PAYOUTS[result as keyof typeof PAYOUTS]
    const winAmount = won ? betAmount * payout * (1 - HOUSE_EDGE) : 0
    const delta = won ? winAmount - betAmount : -betAmount
    const balanceUpdate = isNeon
      ? { neonCoins: user.neonCoins + delta }
      : { balance: user.balance + delta }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { ...balanceUpdate, totalWagered: { increment: betAmount }, gamesPlayed: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      data: {
        result, won, winAmount, betAmount, payout,
        serverSeedHash: hashServerSeed(serverSeed),
        serverSeed, clientSeed, nonce,
        newBalance: updatedUser.balance,
        newNeonCoins: updatedUser.neonCoins,
      },
    })
  } catch (err) {
    console.error('[games/roulette]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
