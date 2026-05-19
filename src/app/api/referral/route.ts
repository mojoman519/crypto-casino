import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const referrals = await db.referral.findMany({
      where: { referrerId: user.id },
      include: {
        referred: {
          select: { username: true, totalWagered: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalEarnings = referrals.reduce((sum, r) => sum + r.earnings, 0)
    const referralLink = `${process.env.NEXT_PUBLIC_APP_URL}/?ref=${user.referralCode}`

    return NextResponse.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralLink,
        totalReferrals: referrals.length,
        totalEarnings,
        referrals: referrals.map((r) => ({
          username: r.referred.username,
          wagered: r.referred.totalWagered,
          yourEarnings: r.earnings,
          joinedAt: r.createdAt,
        })),
      },
    })
  } catch (err) {
    console.error('[referral]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
