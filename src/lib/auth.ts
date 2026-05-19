import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const COOKIE_NAME = 'casino_token'

export interface JWTPayload {
  userId: string
  username: string
  role: string
  iat?: number
  exp?: number
}

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function getAuthUser(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<JWTPayload> {
  const user = await getAuthUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdmin(): Promise<JWTPayload> {
  const user = await requireAuth()
  if (user.role !== 'ADMIN') throw new Error('Forbidden')
  return user
}

export function setAuthCookie(token: string): void {
  // Called from API routes using Response headers
}

export async function getUserFromToken(token: string) {
  const payload = verifyToken(token)
  if (!payload) return null

  return db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      role: true,
      balance: true,
      totalWagered: true,
      totalWon: true,
      gamesPlayed: true,
      referralCode: true,
      isVerified: true,
      isBanned: true,
      wallets: true,
    },
  })
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
}

export const AUTH_COOKIE_NAME = COOKIE_NAME
