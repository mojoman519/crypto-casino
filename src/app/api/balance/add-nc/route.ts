import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

const AMOUNTS = [1_000, 10_000, 100_000, 1_000_000]
const DAILY_LIMIT = 1_100_000  // max NC per day (covers all presets once)

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
      ?? req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { amount } = await req.json()
    if (!AMOUNTS.includes(amount)) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    // Daily limit check — sum NC added via this route in last 24h
    const since = new Date(Date.now() - 86_400_000)
    const recentAdditions = await db.auditLog.aggregate({
      where: {
        userId: payload.userId,
        action: 'BALANCE_ADJUSTED',
        createdAt: { gte: since },
      },
      _sum: { data: true } as never,
    })

    // Count recent additions another way — check audit logs with the NC amount
    const recentLogs = await db.auditLog.findMany({
      where: { userId: payload.userId, action: 'BALANCE_ADJUSTED', createdAt: { gte: since } },
      select: { data: true },
    })

    const totalAdded = recentLogs.reduce((sum, log) => {
      const data = log.data as Record<string, unknown> | null
      return sum + ((data?.amount as number) ?? 0)
    }, 0)

    if (totalAdded + amount > DAILY_LIMIT) {
      return NextResponse.json({
        success: false,
        error: `Daily limit reached. You can add up to ${DAILY_LIMIT.toLocaleString()} NC per day.`,
      }, { status: 429 })
    }

    // Add NC atomically
    const updated = await db.user.update({
      where: { id: payload.userId },
      data: { neonCoins: { increment: amount } },
      select: { neonCoins: true },
    })

    // Log the addition
    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'BALANCE_ADJUSTED',
        severity: 'INFO',
        data: { amount, newBalance: updated.neonCoins, source: 'funding_modal' },
      },
    })

    return NextResponse.json({
      success: true,
      data: { newNeonCoins: updated.neonCoins },
    })
  } catch (err) {
    console.error('[balance/add-nc]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
