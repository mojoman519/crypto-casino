import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { db } from '@/lib/db'

function adminAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

export async function GET(req: NextRequest) {
  if (!adminAuth(req)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisHour = new Date(now.getTime() - 3_600_000)
  const last24h = new Date(now.getTime() - 86_400_000)
  const last7d = new Date(now.getTime() - 7 * 86_400_000)

  const [
    totalUsers,
    newUsersToday,
    totalBetsToday,
    totalBets24h,
    revenueToday,
    revenue24h,
    revenue7d,
    fraudAlerts,
    rateLimitHits,
    betsPerGame,
    recentActivity,
    topPlayers,
    activeBetsNow,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: today } } }),
    db.gameTransaction.count({ where: { createdAt: { gte: today }, status: { not: 'ROLLED_BACK' } } }),
    db.gameTransaction.count({ where: { createdAt: { gte: last24h }, status: { not: 'ROLLED_BACK' } } }),
    // Revenue = total bet - total win (house profit)
    db.gameTransaction.aggregate({
      where: { createdAt: { gte: today }, status: { in: ['WON', 'LOST'] } },
      _sum: { netAmount: true },
    }),
    db.gameTransaction.aggregate({
      where: { createdAt: { gte: last24h }, status: { in: ['WON', 'LOST'] } },
      _sum: { netAmount: true },
    }),
    db.gameTransaction.aggregate({
      where: { createdAt: { gte: last7d }, status: { in: ['WON', 'LOST'] } },
      _sum: { netAmount: true },
    }),
    db.auditLog.count({ where: { action: 'FRAUD_DETECTED', createdAt: { gte: last24h } } }),
    db.auditLog.count({ where: { action: 'RATE_LIMITED', createdAt: { gte: last24h } } }),
    db.gameTransaction.groupBy({
      by: ['gameType'],
      where: { createdAt: { gte: last24h } },
      _count: { _all: true },
      _sum: { betAmount: true },
    }),
    db.gameTransaction.findMany({
      where: { createdAt: { gte: thisHour } },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.user.findMany({
      orderBy: { totalWagered: 'desc' },
      take: 10,
      select: { id: true, username: true, totalWagered: true, totalWon: true, gamesPlayed: true, neonCoins: true },
    }),
    db.gameTransaction.count({ where: { status: 'PENDING' } }),
  ])

  // House edge analysis per game
  const houseProfit = -(revenueToday._sum.netAmount ?? 0)

  return NextResponse.json({
    success: true,
    data: {
      overview: {
        totalUsers,
        newUsersToday,
        totalBetsToday,
        totalBets24h,
        houseProfit: { today: houseProfit, last24h: -(revenue24h._sum.netAmount ?? 0), last7d: -(revenue7d._sum.netAmount ?? 0) },
        fraudAlerts24h: fraudAlerts,
        rateLimitHits24h: rateLimitHits,
        activeBetsNow,
      },
      betsPerGame: betsPerGame.map(g => ({
        gameType: g.gameType,
        betCount: g._count._all,
        totalWagered: g._sum.betAmount ?? 0,
      })),
      recentActivity: recentActivity.map(t => ({
        id: t.id,
        username: t.user.username,
        gameType: t.gameType,
        betAmount: t.betAmount,
        winAmount: t.winAmount,
        status: t.status,
        currency: t.currency,
        createdAt: t.createdAt,
      })),
      topPlayers,
    },
  })
}
