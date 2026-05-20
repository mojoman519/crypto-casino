import { db } from './db'

export interface GameSettings {
  id: string
  gameType: string
  name: string
  isEnabled: boolean
  houseEdge: number
  minBetNC: number
  maxBetNC: number
  minBetSOL: number
  maxBetSOL: number
  maxBetsPerMin: number
  maxBetsPerHour: number
  updatedAt: Date
  updatedBy: string | null
}

const DEFAULTS: Record<string, Omit<GameSettings, 'id' | 'updatedAt' | 'updatedBy'>> = {
  COINFLIP: { gameType: 'COINFLIP', name: 'Coin Flip', isEnabled: true, houseEdge: 0.03, minBetNC: 10, maxBetNC: 1_000_000, minBetSOL: 0.001, maxBetSOL: 100, maxBetsPerMin: 20, maxBetsPerHour: 300 },
  CRASH:    { gameType: 'CRASH',    name: 'Crash',     isEnabled: true, houseEdge: 0.03, minBetNC: 10, maxBetNC: 500_000,   minBetSOL: 0.001, maxBetSOL: 50,  maxBetsPerMin: 5,  maxBetsPerHour: 100 },
  DICE:     { gameType: 'DICE',     name: 'Dice',      isEnabled: true, houseEdge: 0.04, minBetNC: 10, maxBetNC: 1_000_000, minBetSOL: 0.001, maxBetSOL: 100, maxBetsPerMin: 30, maxBetsPerHour: 500 },
  ROULETTE: { gameType: 'ROULETTE', name: 'Roulette',  isEnabled: true, houseEdge: 0.04, minBetNC: 10, maxBetNC: 500_000,   minBetSOL: 0.001, maxBetSOL: 50,  maxBetsPerMin: 20, maxBetsPerHour: 300 },
  JACKPOT:  { gameType: 'JACKPOT',  name: 'Jackpot',   isEnabled: true, houseEdge: 0.05, minBetNC: 10, maxBetNC: 100_000,   minBetSOL: 0.001, maxBetSOL: 10,  maxBetsPerMin: 5,  maxBetsPerHour: 50  },
}

// Per-instance cache (warm across requests in same serverless function)
const _cache = new Map<string, { cfg: GameSettings; at: number }>()
const TTL = 30_000 // 30s

export async function getGameConfig(gameType: string): Promise<GameSettings> {
  const hit = _cache.get(gameType)
  if (hit && Date.now() - hit.at < TTL) return hit.cfg

  let cfg = await db.gameConfig.findUnique({ where: { gameType } })

  if (!cfg) {
    const def = DEFAULTS[gameType]
    if (!def) throw new Error(`Unknown game type: ${gameType}`)
    cfg = await db.gameConfig.upsert({
      where: { gameType },
      create: def,
      update: {},
    })
  }

  _cache.set(gameType, { cfg: cfg as GameSettings, at: Date.now() })
  return cfg as GameSettings
}

export function invalidateGameConfig(gameType?: string) {
  if (gameType) _cache.delete(gameType)
  else _cache.clear()
}

export async function getAllGameConfigs(): Promise<GameSettings[]> {
  const configs = await db.gameConfig.findMany({ orderBy: { gameType: 'asc' } })

  // Seed any missing game types
  const existing = new Set(configs.map(c => c.gameType))
  const missing = Object.keys(DEFAULTS).filter(g => !existing.has(g))
  if (missing.length > 0) {
    await db.gameConfig.createMany({
      data: missing.map(g => DEFAULTS[g]),
      skipDuplicates: true,
    })
    return getAllGameConfigs()
  }

  return configs as GameSettings[]
}

export function getMinBet(cfg: GameSettings, currency: 'NC' | 'SOL'): number {
  return currency === 'NC' ? cfg.minBetNC : cfg.minBetSOL
}

export function getMaxBet(cfg: GameSettings, currency: 'NC' | 'SOL'): number {
  return currency === 'NC' ? cfg.maxBetNC : cfg.maxBetSOL
}
