// Plinko multiplier tables — indexed by [risk][rows][bucket]
// buckets = rows + 1, symmetric around center
export const PLINKO_MULTIPLIERS: Record<string, Record<number, number[]>> = {
  low: {
    8:  [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [33, 11, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11, 33],
    16: [16, 9, 2.0, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2.0, 9, 16],
  },
  medium: {
    8:  [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
    12: [170, 24, 8.1, 2.0, 0.7, 0.2, 0.2, 0.2, 0.7, 2.0, 8.1, 24, 170],
    16: [110, 41, 10, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10, 41, 110],
  },
  high: {
    8:  [29, 4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
    12: [1000, 130, 26, 9.0, 4.0, 2.0, 0.2, 2.0, 4.0, 9.0, 26, 130, 1000],
    16: [1000, 130, 26, 9.0, 4.0, 2.0, 0.2, 0.2, 0.2, 0.2, 2.0, 4.0, 9.0, 26, 130, 1000, 1000],
  },
}

export function getPlinkoMultiplier(risk: string, rows: number, bucket: number): number {
  return PLINKO_MULTIPLIERS[risk]?.[rows]?.[bucket] ?? 0
}

// Mines multiplier: probability-based with 3% house edge
// C(25, k) / C(25-n, k) * 0.97 where k=revealed, n=mines
function factorial(n: number): number {
  if (n <= 1) return 1
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function combinations(n: number, k: number): number {
  if (k > n || k < 0) return 0
  if (k === 0 || k === n) return 1
  // Use logarithms to avoid overflow for large numbers
  let result = 1
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1)
  }
  return result
}

export function getMinesMultiplier(mineCount: number, revealedCount: number): number {
  const total = 25
  const safe = total - mineCount
  if (revealedCount === 0) return 1
  if (revealedCount > safe) return 0
  const prob = combinations(safe, revealedCount) / combinations(total, revealedCount)
  return Math.round((1 / prob) * 0.97 * 100) / 100
}

export function getMinesMultiplierTable(mineCount: number): number[] {
  const safe = 25 - mineCount
  return Array.from({ length: safe + 1 }, (_, k) => getMinesMultiplier(mineCount, k))
}
