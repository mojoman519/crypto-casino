import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, signToken, AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { sendAdminOtp } from '@/lib/email'
import { cookies } from 'next/headers'
import crypto from 'crypto'

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999))
}

async function checkLoginRateLimit(ip: string, username: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60 * 1000) // 15 min window
  const failedAttempts = await db.auditLog.count({
    where: {
      action: 'LOGIN_FAILED',
      ipAddress: ip,
      createdAt: { gte: since },
    },
  })
  return failedAttempts >= 10
}

async function logLoginFailed(ip: string, username: string): Promise<void> {
  await db.auditLog.create({
    data: { action: 'LOGIN_FAILED', severity: 'WARN', ipAddress: ip, username },
  })
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400 })
    }

    if (await checkLoginRateLimit(ip, username)) {
      return NextResponse.json(
        { success: false, error: 'Too many failed attempts. Try again in 15 minutes.' },
        { status: 429 }
      )
    }

    const user = await db.user.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: { wallets: true },
    })

    if (!user || !user.passwordHash) {
      await logLoginFailed(ip, username)
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    if (user.isBanned) {
      return NextResponse.json({ success: false, error: 'Account suspended' }, { status: 403 })
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      await logLoginFailed(ip, username)
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    // Admin accounts require email OTP before a token is issued
    if (user.role === 'ADMIN') {
      const code = generateOtp()
      const codeHash = crypto.createHash('sha256').update(code).digest('hex')
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

      await db.adminOtp.upsert({
        where: { userId: user.id },
        create: { userId: user.id, codeHash, expiresAt, attempts: 0 },
        update: { codeHash, expiresAt, attempts: 0 },
      })

      const sent = await sendAdminOtp(code)
      if (!sent) {
        return NextResponse.json({ success: false, error: 'Failed to send verification code' }, { status: 500 })
      }

      return NextResponse.json({ success: true, requiresOtp: true, userId: user.id })
    }

    // Regular users — issue token immediately
    const token = signToken({ userId: user.id, username: user.username, role: user.role })
    await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } })

    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS)

    const { passwordHash: _, ...safeUser } = user
    return NextResponse.json({ success: true, data: { user: safeUser, token } })
  } catch (err) {
    console.error('[auth/login]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
