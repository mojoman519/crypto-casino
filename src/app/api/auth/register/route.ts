import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, signToken, AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  try {
    const { username, password, email, referralCode, neonCoins } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400 })
    }
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ success: false, error: 'Username must be 3–20 characters' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ success: false, error: 'Username can only contain letters, numbers and underscores' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const existing = await db.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase().trim() },
          ...(email ? [{ email }] : []),
        ],
      },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Username or email already taken' }, { status: 409 })
    }

    let referredBy: string | null = null
    if (referralCode) {
      const referrer = await db.user.findUnique({ where: { referralCode } })
      if (referrer) referredBy = referrer.id
    }

    const startingNeonCoins = typeof neonCoins === 'number' && neonCoins >= 100
      ? Math.min(neonCoins, 10_000_000)
      : 10_000

    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: {
        username: username.toLowerCase().trim(),
        email: email || null,
        passwordHash,
        referralCode: nanoid(8),
        referredBy,
        neonCoins: startingNeonCoins,
        balance: 0,
        solBalance: 0,
      },
      include: { wallets: true },
    })

    if (referredBy) {
      await db.referral.create({
        data: { referrerId: referredBy, referredId: user.id },
      })
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role })
    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS)

    const { passwordHash: _, ...safeUser } = user
    return NextResponse.json({ success: true, data: { user: safeUser, token } }, { status: 201 })
  } catch (err) {
    console.error('[auth/register]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
