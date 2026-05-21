import crypto from 'crypto'
import { getPlinkoMultiplier } from './multipliers'

// Compute deterministic ball path from seeds
// Each row: derive a byte from HMAC, use bit to decide left(0) or right(1)
export function computePlinkoPath(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number
): boolean[] {
  const path: boolean[] = []
  for (let row = 0; row < rows; row++) {
    const hmac = crypto
      .createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}:${row}`)
      .digest('hex')
    const byte = parseInt(hmac.slice(0, 8), 16)
    path.push((byte & 1) === 1) // true = right, false = left
  }
  return path
}

// Ball bucket = number of "right" decisions
export function pathToBucket(path: boolean[]): number {
  return path.filter(Boolean).length
}

export interface PlinkoResult {
  path: boolean[]
  bucket: number
  multiplier: number
  winAmount: number
}

export function computePlinkoResult(params: {
  serverSeed: string
  clientSeed: string
  nonce: number
  rows: number
  risk: string
  betAmount: number
}): PlinkoResult {
  const path = computePlinkoPath(params.serverSeed, params.clientSeed, params.nonce, params.rows)
  const bucket = pathToBucket(path)
  const multiplier = getPlinkoMultiplier(params.risk, params.rows, bucket)
  const winAmount = Math.round(params.betAmount * multiplier * 100) / 100
  return { path, bucket, multiplier, winAmount }
}
