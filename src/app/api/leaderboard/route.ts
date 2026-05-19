import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') || 'wagered'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const orderBy = tab === 'won' ? { totalWon: 'desc' as const }
      : tab === 'games' ? { gamesPlayed: 'desc' as const }
      : { totalWagered: 'desc' as const }

    const users = await db.user.findMany({
      where: { isBanned: false },
      select: {
        id: true,
        username: true,
        avatar: true,
        totalWagered: true,
        totalWon: true,
        gamesPlayed: true,
        role: true,
      },
      orderBy,
      take: limit,
    })

    const leaders = users.map((u, i) => ({
      rank: i + 1,
      ...u,
      profitLoss: u.totalWon - u.totalWagered,
    }))

    return NextResponse.json({ success: true, data: leaders })
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
