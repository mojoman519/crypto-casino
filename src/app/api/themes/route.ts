import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, requireAdmin } from '@/lib/auth'

export async function GET() {
  const themes = await db.theme.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })
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
