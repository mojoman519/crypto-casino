import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { levelFromXp, levelProgress, getRank, xpToNextLevel } from '@/lib/xp'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const [user, profile, achievements, themes] = await Promise.all([
      db.user.findUnique({
        where: { id: payload.userId },
        include: { wallets: true },
      }),
      db.userProfile.upsert({
        where: { userId: payload.userId },
        create: { userId: payload.userId },
        update: {},
      }),
      db.userAchievement.findMany({
        where: { userId: payload.userId },
        include: { achievement: true },
        orderBy: { earnedAt: 'desc' },
      }),
      db.userTheme.findMany({
        where: { userId: payload.userId },
        include: { theme: true },
      }),
    ])

    if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const level = levelFromXp(profile.xp)
    const progress = levelProgress(profile.xp)
    const rank = getRank(level)
    const xpNeeded = xpToNextLevel(profile.xp)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          totalWagered: user.totalWagered,
          totalWon: user.totalWon,
          gamesPlayed: user.gamesPlayed,
          createdAt: user.createdAt,
          wallets: user.wallets,
        },
        profile: {
          ...profile,
          level,
          progress,
          rank,
          xpNeeded,
        },
        achievements: achievements.map(a => ({
          id: a.achievement.id,
          name: a.achievement.name,
          description: a.achievement.description,
          icon: a.achievement.icon,
          xpReward: a.achievement.xpReward,
          earnedAt: a.earnedAt,
        })),
        unlockedThemeIds: themes.map(t => t.themeId),
      },
    })
  } catch (err) {
    console.error('[profile GET]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const body = await req.json()
    const { bio, website, twitter, discord, themeId, avatarUrl, bannerUrl, username } = body

    const updates: Record<string, unknown> = {}

    if (username !== undefined) {
      if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return NextResponse.json({ success: false, error: 'Invalid username format' }, { status: 400 })
      }
      const existing = await db.user.findFirst({
        where: { username: username.toLowerCase(), NOT: { id: payload.userId } },
      })
      if (existing) return NextResponse.json({ success: false, error: 'Username taken' }, { status: 409 })
      await db.user.update({ where: { id: payload.userId }, data: { username: username.toLowerCase() } })
    }

    if (bio !== undefined) updates.bio = bio.slice(0, 300)
    if (website !== undefined) updates.website = website
    if (twitter !== undefined) updates.twitter = twitter
    if (discord !== undefined) updates.discord = discord
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl
    if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl

    if (themeId !== undefined) {
      const theme = await db.theme.findUnique({ where: { slug: themeId } })
      if (!theme) return NextResponse.json({ success: false, error: 'Theme not found' }, { status: 404 })
      if (!theme.isFree) {
        const owned = await db.userTheme.findFirst({ where: { userId: payload.userId, themeId: theme.id } })
        if (!owned) return NextResponse.json({ success: false, error: 'Theme not purchased' }, { status: 403 })
      }
      updates.themeId = themeId
    }

    const profile = await db.userProfile.upsert({
      where: { userId: payload.userId },
      create: { userId: payload.userId, ...updates },
      update: updates,
    })

    return NextResponse.json({ success: true, data: profile })
  } catch (err) {
    console.error('[profile PATCH]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
