import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { generateServerSeed, hashServerSeed, generateClientSeed, generateResult } from '@/lib/provably-fair'

const HOUSE_EDGE = 0.04

function getPayout(target: number, direction: 'over' | 'under'): number {
  const chance = direction === 'over' ? (99 - target) / 100 : (target - 1) / 100
  if (chance <= 0) return 0
  return (1 - HOUSE_EDGE) / chance
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { betAmount, target, direction, mode = 'neon' } = await req.json()

    if (!['over', 'under'].includes(direction)) {
      return NextResponse.json({ success: false, error: 'Invalid direction' }, { status: 400 })
    }
    if (typeof target !== 'number' || target < 2 || target > 98) {
      return NextResponse.json({ success: false, error: 'Target must be 2–98' }, { status: 400 })
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
    const result = Math.floor(rand * 100) // 0-99
    const won = direction === 'over' ? result > target : result < target
    const payoutMultiplier = getPayout(target, direction as 'over' | 'under')
    const winAmount = won ? betAmount * payoutMultiplier : 0
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
        result, won, winAmount, betAmount, target, direction,
        payoutMultiplier: parseFloat(payoutMultiplier.toFixed(4)),
        serverSeedHash: hashServerSeed(serverSeed),
        serverSeed, clientSeed, nonce,
        newBalance: updatedUser.balance,
        newNeonCoins: updatedUser.neonCoins,
      },
    })
  } catch (err) {
    console.error('[games/dice]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
