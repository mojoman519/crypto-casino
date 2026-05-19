import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { seedDefaultAchievements } from '@/lib/achievements'

export async function GET() {
  let achievements = await db.achievement.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { userAchievements: true } } },
  })

  // Auto-seed on first access
  if (achievements.length === 0) {
    await seedDefaultAchievements()
    achievements = await db.achievement.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { userAchievements: true } } },
    })
  }

  return NextResponse.json({ success: true, data: achievements })
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()

    if (body.seed) {
      await seedDefaultAchievements()
      return NextResponse.json({ success: true, message: 'Default achievements seeded' })
    }

    const { name, description, icon, xpReward, trigger } = body
    if (!name || !trigger) {
      return NextResponse.json({ success: false, error: 'Name and trigger required' }, { status: 400 })
    }

    const ach = await db.achievement.create({
      data: { name, description: description ?? '', icon: icon ?? '🏆', xpReward: xpReward ?? 100, trigger },
    })
    return NextResponse.json({ success: true, data: ach }, { status: 201 })
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
    const { id, ...updates } = await req.json()
    const ach = await db.achievement.update({ where: { id }, data: updates })
    return NextResponse.json({ success: true, data: ach })
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
    await db.achievement.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
