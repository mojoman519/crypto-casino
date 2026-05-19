import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()

    const [totalUsers, totalTransactions, recentGames] = await Promise.all([
      db.user.count(),
      db.transaction.aggregate({ _sum: { amount: true }, where: { type: 'DEPOSIT', status: 'CONFIRMED' } }),
      db.coinflipGame.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { user: { select: { username: true } } } }),
    ])

    const houseProfit = await db.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'LOSS' },
    })

    const housePayouts = await db.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'WIN' },
    })

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        totalDeposited: totalTransactions._sum.amount ?? 0,
        houseProfit: (houseProfit._sum.amount ?? 0) - (housePayouts._sum.amount ?? 0),
        recentGames,
      },
    })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 })
    }
    console.error('[admin]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
    const { userId, action } = await req.json()

    if (action === 'ban') {
      await db.user.update({ where: { id: userId }, data: { isBanned: true } })
    } else if (action === 'unban') {
      await db.user.update({ where: { id: userId }, data: { isBanned: false } })
    } else if (action === 'giveBalance') {
      const { amount } = await req.json()
      await db.user.update({ where: { id: userId }, data: { balance: { increment: amount } } })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
