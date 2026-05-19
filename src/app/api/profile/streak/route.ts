import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { processDailyStreak } from '@/lib/achievements'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const result = await processDailyStreak(payload.userId)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[profile/streak]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
