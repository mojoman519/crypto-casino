import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value

    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    if (user.isBanned) return NextResponse.json({ success: false, error: 'Account suspended' }, { status: 403 })

    return NextResponse.json({ success: true, data: { user } })
  } catch (err) {
    console.error('[auth/me]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
