import { db } from './db'
import { levelFromXp, XP_REWARDS } from './xp'

interface AchievementTriggerContext {
  userId: string
  gamesPlayed: number
  totalWon: number
  totalWagered: number
  streak: number
  biggestWin: number
}

export async function checkAndGrantAchievements(ctx: AchievementTriggerContext): Promise<number> {
  const achievements = await db.achievement.findMany({ where: { isActive: true } })
  const earned = await db.userAchievement.findMany({
    where: { userId: ctx.userId },
    select: { achievementId: true },
  })
  const earnedIds = new Set(earned.map(e => e.achievementId))

  let totalXpGained = 0
  const toGrant: string[] = []

  for (const ach of achievements) {
    if (earnedIds.has(ach.id)) continue

    const [triggerType, triggerValue] = ach.trigger.split(':')
    const value = parseFloat(triggerValue)

    let triggered = false
    switch (triggerType) {
      case 'games_played':   triggered = ctx.gamesPlayed >= value; break
      case 'total_won':      triggered = ctx.totalWon >= value; break
      case 'total_wagered':  triggered = ctx.totalWagered >= value; break
      case 'streak':         triggered = ctx.streak >= value; break
      case 'biggest_win':    triggered = ctx.biggestWin >= value; break
    }

    if (triggered) {
      toGrant.push(ach.id)
      totalXpGained += ach.xpReward
    }
  }

  if (toGrant.length > 0) {
    await db.$transaction([
      ...toGrant.map(achievementId =>
        db.userAchievement.create({ data: { userId: ctx.userId, achievementId } })
      ),
      db.userProfile.update({
        where: { userId: ctx.userId },
        data: { xp: { increment: totalXpGained } },
      }),
    ])
  }

  return totalXpGained
}

export async function awardXp(userId: string, xp: number): Promise<{ newXp: number; newLevel: number; leveledUp: boolean }> {
  const profile = await db.userProfile.upsert({
    where: { userId },
    create: { userId, xp, level: 1 },
    update: { xp: { increment: xp } },
  })

  const oldLevel = profile.level
  const newXp = profile.xp
  const newLevel = levelFromXp(newXp)

  if (newLevel !== oldLevel) {
    await db.userProfile.update({ where: { userId }, data: { level: newLevel } })
  }

  return { newXp, newLevel, leveledUp: newLevel > oldLevel }
}

export async function processDailyStreak(userId: string): Promise<{ xpGained: number; streak: number; isNew: boolean }> {
  const profile = await db.userProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastLogin = profile.lastLoginDate
    ? new Date(profile.lastLoginDate.getFullYear(), profile.lastLoginDate.getMonth(), profile.lastLoginDate.getDate())
    : null

  if (lastLogin && lastLogin.getTime() === today.getTime()) {
    return { xpGained: 0, streak: profile.streak, isNew: false }
  }

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isConsecutive = lastLogin?.getTime() === yesterday.getTime()

  const newStreak = isConsecutive ? profile.streak + 1 : 1
  const xpGained = XP_REWARDS.STREAK_DAY(newStreak)
  const longestStreak = Math.max(profile.longestStreak, newStreak)

  await db.userProfile.update({
    where: { userId },
    data: {
      streak: newStreak,
      longestStreak,
      lastLoginDate: now,
      xp: { increment: xpGained },
    },
  })

  return { xpGained, streak: newStreak, isNew: true }
}

// Seed default achievements
export async function seedDefaultAchievements() {
  const defaults = [
    { name: 'First Bet', description: 'Place your first bet', icon: '🎯', xpReward: 50, trigger: 'games_played:1' },
    { name: 'Getting Started', description: 'Play 10 games', icon: '🎮', xpReward: 100, trigger: 'games_played:10' },
    { name: 'Regular', description: 'Play 100 games', icon: '🃏', xpReward: 250, trigger: 'games_played:100' },
    { name: 'Veteran', description: 'Play 1,000 games', icon: '🏅', xpReward: 1000, trigger: 'games_played:1000' },
    { name: 'First Win', description: 'Win your first game', icon: '⭐', xpReward: 75, trigger: 'total_won:1' },
    { name: 'Big Winner', description: 'Win over $1,000 total', icon: '💰', xpReward: 300, trigger: 'total_won:1000' },
    { name: 'High Roller', description: 'Wager over $10,000 total', icon: '🎰', xpReward: 500, trigger: 'total_wagered:10000' },
    { name: 'Weekly Streak', description: 'Login 7 days in a row', icon: '🔥', xpReward: 200, trigger: 'streak:7' },
    { name: 'Monthly Streak', description: 'Login 30 days in a row', icon: '💎', xpReward: 1000, trigger: 'streak:30' },
    { name: 'Lucky Strike', description: 'Win over $500 in a single bet', icon: '⚡', xpReward: 350, trigger: 'biggest_win:500' },
  ]

  for (const ach of defaults) {
    await db.achievement.upsert({
      where: { id: `default_${ach.trigger}` },
      create: { id: `default_${ach.trigger}`, ...ach },
      update: {},
    })
  }
}
