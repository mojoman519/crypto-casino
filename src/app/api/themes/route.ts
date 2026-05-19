import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, requireAdmin } from '@/lib/auth'

const DEFAULT_THEMES = [
  { name: 'Purple', slug: 'purple', primaryColor: '#7c3aed', secondaryColor: '#9333ea', accentColor: '#a855f7', isFree: true, priceSOL: 0 },
  { name: 'Cyan',   slug: 'cyan',   primaryColor: '#06b6d4', secondaryColor: '#0ea5e9', accentColor: '#22d3ee', isFree: true, priceSOL: 0 },
  { name: 'Green',  slug: 'green',  primaryColor: '#10b981', secondaryColor: '#14b8a6', accentColor: '#22c55e', isFree: true, priceSOL: 0 },
  { name: 'Gold',   slug: 'gold',   primaryColor: '#f59e0b', secondaryColor: '#f97316', accentColor: '#fbbf24', isFree: false, priceSOL: 0.01 },
  { name: 'Red',    slug: 'red',    primaryColor: '#ef4444', secondaryColor: '#e11d48', accentColor: '#f87171', isFree: false, priceSOL: 0.005 },
]

export async function GET() {
  let themes = await db.theme.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  // Auto-seed on first access
  if (themes.length === 0) {
    await db.theme.createMany({ data: DEFAULT_THEMES })
    themes = await db.theme.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
  }

  return NextResponse.json({ success: true, data: themes })
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { name, slug, primaryColor, secondaryColor, accentColor, isFree, priceSOL } = body

    if (!name || !slug || !primaryColor) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const theme = await db.theme.create({
      data: { name, slug, primaryColor, secondaryColor: secondaryColor ?? primaryColor, accentColor: accentColor ?? primaryColor, isFree: isFree ?? true, priceSOL: priceSOL ?? 0 },
    })
    return NextResponse.json({ success: true, data: theme }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { id, ...updates } = body

    const theme = await db.theme.update({ where: { id }, data: { ...updates, updatedAt: new Date() } })
    return NextResponse.json({ success: true, data: theme })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const { id } = await req.json()
    await db.theme.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
