import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/?verified=false', req.url))
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.redirect(new URL('/?verified=false&reason=expired', req.url))
    }

    await db.user.update({
      where: { id: session.userId },
      data: { isVerified: true },
    })

    await db.session.delete({ where: { token } })

    const authToken = signToken({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
    })

    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE_NAME, authToken, COOKIE_OPTIONS)

    return NextResponse.redirect(new URL('/?verified=true', req.url))
  } catch (err) {
    console.error('[verify-email]', err)
    return NextResponse.redirect(new URL('/?verified=false', req.url))
  }
}
