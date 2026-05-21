import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const MAX_ATTEMPTS = 5

export async function POST(req: NextRequest) {
  try {
    const { userId, code } = await req.json()

    if (!userId || !code) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    const record = await db.adminOtp.findUnique({ where: { userId } })

    if (!record) {
      return NextResponse.json({ success: false, error: 'No pending verification' }, { status: 400 })
    }

    if (record.expiresAt < new Date()) {
      await db.adminOtp.delete({ where: { userId } })
      return NextResponse.json({ success: false, error: 'Code expired — please log in again' }, { status: 400 })
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await db.adminOtp.delete({ where: { userId } })
      return NextResponse.json({ success: false, error: 'Too many attempts — please log in again' }, { status: 429 })
    }

    const inputHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex')
    const inputBuf = Buffer.from(inputHash, 'hex')
    const storedBuf = Buffer.from(record.codeHash, 'hex')
    const codesMatch = inputBuf.length === storedBuf.length &&
      crypto.timingSafeEqual(inputBuf, storedBuf)

    if (!codesMatch) {
      await db.adminOtp.update({ where: { userId }, data: { attempts: { increment: 1 } } })
      const remaining = MAX_ATTEMPTS - record.attempts - 1
      return NextResponse.json({
        success: false,
        error: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      }, { status: 401 })
    }

    // OTP valid — clean up and issue token
    await db.adminOtp.delete({ where: { userId } })

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { wallets: true },
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    await db.user.update({ where: { id: userId }, data: { lastSeen: new Date() } })

    const token = signToken({ userId: user.id, username: user.username, role: user.role })

    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS)

    const { passwordHash: _, ...safeUser } = user
    return NextResponse.json({ success: true, data: { user: safeUser, token } })
  } catch (err) {
    console.error('[auth/admin-otp]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
