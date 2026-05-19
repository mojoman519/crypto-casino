import crypto from 'crypto'

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex')
}

export function generateClientSeed(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function generateNonce(): number {
  return Math.floor(Math.random() * 1_000_000)
}

/**
 * Core HMAC-SHA256 provably fair RNG
 * Returns a float in [0, 1)
 */
export function generateResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): number {
  const message = `${clientSeed}:${nonce}`
  const hmac = crypto.createHmac('sha256', serverSeed).update(message).digest('hex')

  let result = 0
  for (let i = 0; i < 4; i++) {
    result = (result * 256 + parseInt(hmac.slice(i * 2, i * 2 + 2), 16)) / 256
  }
  return result / 256 + parseInt(hmac.slice(0, 8), 16) / 0xffffffff
}

/**
 * Coin flip: returns "heads" or "tails"
 */
export function generateCoinflipResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): 'heads' | 'tails' {
  const rand = generateResult(serverSeed, clientSeed, nonce)
  return rand < 0.5 ? 'heads' : 'tails'
}

/**
 * Crash game: returns crash point multiplier
 * Minimum 1.00x, house edge applied
 */
export function generateCrashPoint(serverSeed: string): number {
  const hmac = crypto.createHmac('sha256', serverSeed).update('crash').digest('hex')
  const h = parseInt(hmac.slice(0, 8), 16)

  const houseEdge = 0.03
  const e = 2 ** 32
  const result = (e - h) / (e - h * houseEdge)

  return Math.max(1.0, Math.floor(result * 100) / 100)
}

/**
 * Jackpot: picks winner from ticket range [0, totalTickets)
 */
export function generateJackpotWinner(
  serverSeed: string,
  clientSeed: string,
  totalTickets: number
): number {
  const rand = generateResult(serverSeed, clientSeed, 0)
  return Math.floor(rand * totalTickets)
}

/**
 * Verify a coinflip result
 */
export function verifyCoinflip(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: number,
  claimedResult: 'heads' | 'tails'
): boolean {
  const computedHash = hashServerSeed(serverSeed)
  if (computedHash !== serverSeedHash) return false

  const actualResult = generateCoinflipResult(serverSeed, clientSeed, nonce)
  return actualResult === claimedResult
}

/**
 * Verify a crash round
 */
export function verifyCrash(
  serverSeed: string,
  serverSeedHash: string,
  claimedCrashPoint: number
): boolean {
  const computedHash = hashServerSeed(serverSeed)
  if (computedHash !== serverSeedHash) return false

  const actualCrashPoint = generateCrashPoint(serverSeed)
  return Math.abs(actualCrashPoint - claimedCrashPoint) < 0.01
}
