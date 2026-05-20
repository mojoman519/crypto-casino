import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Server-authoritative balance — always reflects DB state
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    ?? req.cookies.get('casino_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { neonCoins: true, balance: true, solBalance: true },
  })

  if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    success: true,
    data: { NC: user.neonCoins, SOL: user.solBalance, USDC: user.balance },
  })
}
