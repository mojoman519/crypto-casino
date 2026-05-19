// XP required to reach a given level
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.8))
}

// Current level from total XP
export function levelFromXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

// Progress toward next level (0-1)
export function levelProgress(xp: number): number {
  const level = levelFromXp(xp)
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  return (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)
}

// XP needed for next level
export function xpToNextLevel(xp: number): number {
  const level = levelFromXp(xp)
  return xpForLevel(level + 1) - xp
}

// XP rewards
export const XP_REWARDS = {
  GAME_PLAYED: 5,
  WIN: 20,
  FIRST_WIN: 100,
  STREAK_DAY: (day: number) => Math.min(day * 15, 500),
  ACHIEVEMENT: (reward: number) => reward,
} as const

export const RANK_LABELS: Record<number, string> = {
  1: 'Rookie',
  5: 'Gambler',
  10: 'Hustler',
  20: 'Shark',
  35: 'High Roller',
  50: 'Whale',
  75: 'Legend',
  100: 'Immortal',
}

export function getRank(level: number): string {
  const ranks = Object.entries(RANK_LABELS)
    .map(([l, r]) => ({ level: parseInt(l), rank: r }))
    .sort((a, b) => b.level - a.level)
  return ranks.find(r => level >= r.level)?.rank ?? 'Rookie'
}
