import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../src/lib/auth'
import {
  generateServerSeed, hashServerSeed, generateClientSeed,
  generateCrashPoint, generateJackpotWinner,
} from '../src/lib/provably-fair'

const db = new PrismaClient()
const httpServer = createServer()

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// ─── Crash Engine ────────────────────────────────────────────────────────────

interface CrashBet {
  userId: string
  username: string
  betAmount: number
  autoCashout?: number
  cashedOut: boolean
  cashoutMultiplier?: number
}

interface CrashState {
  roundId: string | null
  serverSeed: string
  serverSeedHash: string
  crashPoint: number
  phase: 'waiting' | 'flying' | 'crashed'
  multiplier: number
  bets: Map<string, CrashBet>
  startTime: number
  intervalId: ReturnType<typeof setInterval> | null
}

const crashState: CrashState = {
  roundId: null,
  serverSeed: '',
  serverSeedHash: '',
  crashPoint: 0,
  phase: 'waiting',
  multiplier: 1.0,
  bets: new Map(),
  startTime: 0,
  intervalId: null,
}

async function startNewCrashRound() {
  if (crashState.intervalId) clearInterval(crashState.intervalId)

  const serverSeed = generateServerSeed()
  const serverSeedHash = hashServerSeed(serverSeed)
  const crashPoint = generateCrashPoint(serverSeed)

  crashState.serverSeed = serverSeed
  crashState.serverSeedHash = serverSeedHash
  crashState.crashPoint = crashPoint
  crashState.phase = 'waiting'
  crashState.multiplier = 1.0
  crashState.bets.clear()

  const round = await db.crashRound.create({
    data: { serverSeed, serverSeedHash, crashPoint, status: 'ACTIVE' },
  })
  crashState.roundId = round.id

  io.emit('crash:started', {
    id: round.id,
    serverSeedHash,
    status: 'ACTIVE',
    startedAt: round.startedAt,
  })

  // Wait 5s for bets, then fly
  setTimeout(() => flyRocket(), 5000)
}

function flyRocket() {
  crashState.phase = 'flying'
  crashState.startTime = Date.now()

  io.emit('crash:phase', { phase: 'flying' })

  crashState.intervalId = setInterval(() => {
    const elapsed = (Date.now() - crashState.startTime) / 1000
    const mult = parseFloat(Math.pow(Math.E, 0.12 * elapsed).toFixed(2))
    crashState.multiplier = mult

    io.emit('crash:tick', { multiplier: mult, elapsed })

    // Auto cashouts
    crashState.bets.forEach((bet, userId) => {
      if (!bet.cashedOut && bet.autoCashout && mult >= bet.autoCashout) {
        processCashout(userId, mult)
      }
    })

    // Crash
    if (mult >= crashState.crashPoint) {
      endCrashRound()
    }
  }, 50)
}

async function processCashout(userId: string, multiplier: number) {
  const bet = crashState.bets.get(userId)
  if (!bet || bet.cashedOut) return
  bet.cashedOut = true
  bet.cashoutMultiplier = multiplier

  const winAmount = bet.betAmount * multiplier * 0.97

  await db.$transaction([
    db.crashBet.updateMany({
      where: { userId, crashRoundId: crashState.roundId!, status: 'ACTIVE' },
      data: { cashoutMultiplier: multiplier, winAmount, status: 'COMPLETED' },
    }),
    db.user.update({
      where: { id: userId },
      data: { balance: { increment: winAmount }, totalWon: { increment: winAmount } },
    }),
  ])

  const userSocket = userSockets.get(userId)
  if (userSocket) {
    userSocket.emit('crash:cashout:success', { userId, multiplier, winAmount })
    userSocket.emit('balance:updated', {
      balance: (await db.user.findUnique({ where: { id: userId }, select: { balance: true } }))?.balance,
    })
  }

  io.emit('crash:bet:placed', { userId, username: bet.username, cashoutMultiplier: multiplier, winAmount })
}

async function endCrashRound() {
  if (crashState.intervalId) clearInterval(crashState.intervalId)
  crashState.phase = 'crashed'

  await db.crashRound.update({
    where: { id: crashState.roundId! },
    data: { multiplier: crashState.crashPoint, status: 'COMPLETED', endedAt: new Date() },
  })

  // Mark uncashed bets as lost
  await db.crashBet.updateMany({
    where: { crashRoundId: crashState.roundId!, status: 'ACTIVE' },
    data: { status: 'COMPLETED' },
  })

  io.emit('crash:crashed', {
    crashPoint: crashState.crashPoint,
    serverSeed: crashState.serverSeed,
    serverSeedHash: crashState.serverSeedHash,
  })

  // Start next round after 3s
  setTimeout(() => startNewCrashRound(), 3000)
}

// ─── Jackpot Engine ──────────────────────────────────────────────────────────

async function checkJackpotRound() {
  const round = await db.jackpotRound.findFirst({
    where: { status: 'ACTIVE' },
    include: { entries: { include: { user: { select: { username: true } } } } },
    orderBy: { startedAt: 'asc' },
  })

  if (!round || round.entries.length < 2) return

  const timeSinceStart = Date.now() - round.startedAt.getTime()
  if (timeSinceStart < 60_000) return // 60s round duration

  // Pick winner
  const clientSeed = generateClientSeed()
  const winningTicket = generateJackpotWinner(round.serverSeed, clientSeed, round.ticketTotal)

  let winner = round.entries[0]
  for (const entry of round.entries) {
    if (winningTicket >= entry.ticketStart && winningTicket < entry.ticketEnd) {
      winner = entry
      break
    }
  }

  const prizePool = round.poolAmount * 0.95

  await db.$transaction([
    db.jackpotRound.update({
      where: { id: round.id },
      data: { status: 'COMPLETED', winnerId: winner.userId, endedAt: new Date() },
    }),
    db.user.update({
      where: { id: winner.userId },
      data: { balance: { increment: prizePool }, totalWon: { increment: prizePool } },
    }),
  ])

  io.emit('jackpot:winner', {
    winner: { username: winner.user.username, userId: winner.userId },
    winAmount: prizePool,
    serverSeed: round.serverSeed,
    clientSeed,
    winningTicket,
  })

  const winnerSocket = userSockets.get(winner.userId)
  winnerSocket?.emit('balance:updated', {
    balance: (await db.user.findUnique({ where: { id: winner.userId }, select: { balance: true } }))?.balance,
  })
}

// ─── Socket Connection ───────────────────────────────────────────────────────

const userSockets = new Map<string, Socket>()

io.on('connection', (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`)

  socket.on('user:join', async ({ userId, token }) => {
    const payload = verifyToken(token)
    if (!payload || payload.userId !== userId) {
      socket.emit('error', { message: 'Invalid auth token' })
      return
    }

    userSockets.set(userId, socket)
    socket.data.userId = userId
    socket.join(`user:${userId}`)
    console.log(`[socket] User ${payload.username} authenticated`)

    // Send current crash state
    socket.emit('crash:state', {
      phase: crashState.phase,
      multiplier: crashState.multiplier,
      serverSeedHash: crashState.serverSeedHash,
    })
  })

  socket.on('crash:cashout', async () => {
    const userId = socket.data.userId
    if (!userId || crashState.phase !== 'flying') return
    await processCashout(userId, crashState.multiplier)
  })

  socket.on('disconnect', () => {
    const userId = socket.data.userId
    if (userId) userSockets.delete(userId)
    console.log(`[socket] Client disconnected: ${socket.id}`)
  })
})

// ─── Engine startup ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.SOCKET_PORT || '3001')
httpServer.listen(PORT, () => {
  console.log(`[socket.io] Server running on port ${PORT}`)
  startNewCrashRound()
  setInterval(checkJackpotRound, 10_000)
})
