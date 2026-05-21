import crypto from 'crypto'
import { getMinesMultiplier } from './multipliers'

// Generate mine positions from seed — returns sorted array of tile indices (0-24)
export function generateMinePositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mineCount: number
): number[] {
  const tiles = Array.from({ length: 25 }, (_, i) => i)
  const mines: number[] = []
  let attempt = 0

  while (mines.length < mineCount) {
    const hmac = crypto
      .createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}:mine:${attempt}`)
      .digest('hex')
    const value = parseInt(hmac.slice(0, 8), 16)
    const remaining = tiles.filter(t => !mines.includes(t))
    const idx = value % remaining.length
    mines.push(remaining[idx])
    attempt++
  }

  return mines.sort((a, b) => a - b)
}

export interface MinesGameState {
  mines: number[]
  revealed: number[]
  mineCount: number
  currentMultiplier: number
  serverSeed: string
  clientSeed: string
  nonce: number
}

export function createMinesState(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mineCount: number
): MinesGameState {
  const mines = generateMinePositions(serverSeed, clientSeed, nonce, mineCount)
  return {
    mines,
    revealed: [],
    mineCount,
    currentMultiplier: 1,
    serverSeed,
    clientSeed,
    nonce,
  }
}

export function revealTile(state: MinesGameState, position: number): {
  isMine: boolean
  newState: MinesGameState
  multiplier: number
} {
  const isMine = state.mines.includes(position)

  if (isMine) {
    return { isMine: true, newState: state, multiplier: 0 }
  }

  const revealed = [...state.revealed, position]
  const multiplier = getMinesMultiplier(state.mineCount, revealed.length)

  return {
    isMine: false,
    newState: { ...state, revealed, currentMultiplier: multiplier },
    multiplier,
  }
}
