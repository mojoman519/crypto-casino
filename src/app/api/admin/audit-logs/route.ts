import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { db } from '@/lib/db'

function adminAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

export async function GET(req: NextRequest) {
  if (!adminAuth(req)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
  const skip = (page - 1) * limit
  const severity = searchParams.get('severity') || undefined
  const action = searchParams.get('action') || undefined
  const userId = searchParams.get('userId') || undefined

  const where = {
    ...(severity && { severity }),
    ...(action && { action }),
    ...(userId && { userId }),
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: logs,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  })
}
