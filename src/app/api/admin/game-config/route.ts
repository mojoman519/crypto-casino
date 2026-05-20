import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getAllGameConfigs, invalidateGameConfig } from '@/lib/game-config'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/audit-logger'

function adminAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

export async function GET(req: NextRequest) {
  if (!adminAuth(req)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const configs = await getAllGameConfigs()
  return NextResponse.json({ success: true, data: configs })
}

export async function PATCH(req: NextRequest) {
  const admin = adminAuth(req)
  if (!admin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { gameType, ...updates } = body

  if (!gameType) return NextResponse.json({ success: false, error: 'gameType required' }, { status: 400 })

  // Whitelist updatable fields
  const allowed: Record<string, boolean> = {
    isEnabled: true, houseEdge: true,
    minBetNC: true, maxBetNC: true,
    minBetSOL: true, maxBetSOL: true,
    maxBetsPerMin: true, maxBetsPerHour: true,
  }
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed[k]))

  // Validate ranges
  if (safe.houseEdge !== undefined && (safe.houseEdge < 0 || safe.houseEdge > 0.5)) {
    return NextResponse.json({ success: false, error: 'House edge must be 0–50%' }, { status: 400 })
  }

  const updated = await db.gameConfig.upsert({
    where: { gameType },
    create: { gameType, name: gameType, ...safe, updatedBy: admin.userId },
    update: { ...safe, updatedBy: admin.userId },
  })

  invalidateGameConfig(gameType)

  auditLog({
    userId: admin.userId,
    username: admin.username,
    action: 'ADMIN_CONFIG_CHANGE',
    severity: 'WARN',
    data: { gameType, changes: safe },
  })

  return NextResponse.json({ success: true, data: updated })
}
