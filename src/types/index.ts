export type Role = 'USER' | 'VIP' | 'ADMIN'
export type Chain = 'SOLANA' | 'ETHEREUM'
export type GameType = 'COINFLIP' | 'CRASH' | 'JACKPOT'
export type GameStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface User {
  id: string
  email?: string
  username: string
  avatar?: string
  role: Role
  balance: number
  totalWagered: number
  totalWon: number
  gamesPlayed: number
  referralCode: string
  isVerified: boolean
  createdAt: string
  wallets?: Wallet[]
}

export interface Wallet {
  id: string
  chain: Chain
  address: string
  isDefault: boolean
}

export interface Transaction {
  id: string
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'WIN' | 'LOSS' | 'REFERRAL_BONUS'
  amount: number
  currency: string
  chain?: Chain
  txHash?: string
  status: 'PENDING' | 'CONFIRMED' | 'FAILED'
  createdAt: string
}

export interface CoinflipGame {
  id: string
  userId: string
  betAmount: number
  choice: 'heads' | 'tails'
  result: 'heads' | 'tails'
  winAmount: number
  multiplier: number
  serverSeedHash: string
  clientSeed: string
  nonce: number
  status: GameStatus
  createdAt: string
  user?: Pick<User, 'username' | 'avatar'>
}

export interface CrashRound {
  id: string
  multiplier?: number
  serverSeedHash: string
  crashPoint: number
  status: GameStatus
  startedAt: string
  bets?: CrashBet[]
}

export interface CrashBet {
  id: string
  userId: string
  betAmount: number
  cashoutMultiplier?: number
  winAmount: number
  autoCashout?: number
  status: GameStatus
  user?: Pick<User, 'username' | 'avatar'>
}

export interface JackpotRound {
  id: string
  poolAmount: number
  winnerId?: string
  serverSeedHash: string
  ticketTotal: number
  status: GameStatus
  startedAt: string
  entries?: JackpotEntry[]
}

export interface JackpotEntry {
  id: string
  userId: string
  betAmount: number
  ticketStart: number
  ticketEnd: number
  color: string
  user?: Pick<User, 'username' | 'avatar'>
}

export interface LiveBetEvent {
  id: string
  username: string
  avatar?: string
  game: GameType
  betAmount: number
  winAmount?: number
  multiplier?: number
  result: 'win' | 'loss'
  timestamp: number
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  avatar?: string
  totalWagered: number
  totalWon: number
  gamesPlayed: number
  profitLoss: number
}

export interface ProvablyFairResult {
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
  result: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type WalletProvider = 'phantom' | 'solflare' | 'metamask' | 'coinbase' | 'walletconnect'

export interface ConnectWalletPayload {
  chain: Chain
  address: string
  signature: string
  message: string
}

export interface SocketEvents {
  // Client → Server
  'crash:bet': (data: { betAmount: number; autoCashout?: number }) => void
  'crash:cashout': () => void
  'jackpot:enter': (data: { betAmount: number }) => void
  'coinflip:play': (data: { betAmount: number; choice: 'heads' | 'tails' }) => void
  'user:join': (data: { userId: string; token: string }) => void

  // Server → Client
  'crash:tick': (data: { multiplier: number; elapsed: number }) => void
  'crash:started': (data: CrashRound) => void
  'crash:crashed': (data: { crashPoint: number; serverSeed: string }) => void
  'crash:bet:placed': (data: CrashBet & { username: string }) => void
  'crash:cashout:success': (data: { userId: string; multiplier: number; winAmount: number }) => void
  'jackpot:updated': (data: JackpotRound) => void
  'jackpot:winner': (data: { winner: User; winAmount: number; serverSeed: string }) => void
  'live:bet': (data: LiveBetEvent) => void
  'balance:updated': (data: { balance: number }) => void
  'error': (data: { message: string }) => void
}
