# NeonBet Casino

A modern, provably fair crypto casino built with Next.js 15, Solana & Ethereum.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Styling | TailwindCSS + shadcn/ui |
| Animations | Framer Motion |
| Database | PostgreSQL + Prisma ORM |
| Real-time | Socket.io |
| Auth | JWT + wallet signatures |
| Solana | @solana/web3.js + Anchor |
| Ethereum | ethers.js v6 + RainbowKit |
| State | Zustand |
| Data fetching | TanStack Query |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment variables
cp .env.example .env.local

# 3. Push database schema
npm run db:push

# 4. Run the app
npm run dev

# 5. Run the Socket.io game server (separate terminal)
npm run socket:dev
```

## Project Structure

```
crypto-casino/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── games/              # Game pages (coinflip, crash, jackpot)
│   │   ├── admin/              # Admin dashboard
│   │   ├── leaderboard/        # Leaderboard page
│   │   ├── profile/            # User profile & referrals
│   │   └── api/                # REST API routes
│   ├── components/
│   │   ├── games/              # CoinFlip, CrashGame, JackpotGame
│   │   ├── wallet/             # WalletModal, DepositModal, WithdrawModal
│   │   ├── layout/             # Navbar, Sidebar, Footer
│   │   ├── shared/             # LiveFeed, AnimatedCounter
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── provably-fair.ts    # HMAC-SHA256 RNG system
│   │   ├── auth.ts             # JWT authentication
│   │   ├── db.ts               # Prisma client
│   │   └── socket-client.ts    # Socket.io client
│   ├── store/                  # Zustand stores (auth, wallet, game)
│   ├── hooks/                  # React hooks (useSocket, useAuth)
│   └── types/                  # TypeScript types
├── server/
│   └── socket.ts               # Socket.io server + game engines
├── contracts/
│   ├── ethereum/Casino.sol     # EVM casino contract
│   └── solana/casino.rs        # Anchor program
└── prisma/schema.prisma        # Database schema
```

## Games

### Coin Flip
- 50/50 chance, 1.94x payout (3% house edge)
- HMAC-SHA256 provably fair
- Client seed + server seed + nonce verification

### Crash
- Multiplier climbs until it crashes
- Real-time Socket.io ticks at 50ms
- Auto-cashout support
- Provably fair crash point generation

### Jackpot
- Proportional ticket system (more you bet = higher chance)
- 60-second rounds
- Animated wheel spin
- 95% payout to winner

## Provably Fair System

Every game uses HMAC-SHA256:

```
result = HMAC-SHA256(serverSeed, clientSeed:nonce)
```

1. Server commits to `sha256(serverSeed)` before the game
2. Player provides `clientSeed`
3. After game, server reveals `serverSeed`
4. Anyone can verify: `sha256(serverSeed) === serverSeedHash`

## Wallet Integration

### Solana
- Phantom, Solflare, Backpack wallets
- Message signing for authentication
- USDC + SOL deposits

### Ethereum
- MetaMask, Coinbase Wallet, WalletConnect
- EIP-191 message signing
- USDC + ETH deposits

## Smart Contracts

### Ethereum (`contracts/ethereum/Casino.sol`)
- ERC-20 USDC deposits/withdrawals
- On-chain game settlement with resolver signature
- House edge validation
- OpenZeppelin security (ReentrancyGuard, Ownable, Pausable)

### Solana (`contracts/solana/casino.rs`)
- Anchor framework
- PDA vault for USDC
- Authority-signed game settlement
- Account-based user balances

## Environment Variables

See `.env.example` for all required variables.

Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for JWT signing
- `NEXT_PUBLIC_SOLANA_RPC_URL` — Solana RPC endpoint
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect project ID
- `HOUSE_EDGE` — House edge (default 0.03 = 3%)

## Database

Run `npm run db:studio` to open Prisma Studio for visual database management.

Tables:
- `User` — Player accounts
- `Wallet` — Connected crypto wallets
- `CoinflipGame` — Coin flip game history
- `CrashRound` + `CrashBet` — Crash game rounds & bets
- `JackpotRound` + `JackpotEntry` — Jackpot rounds
- `Transaction` — Deposits, withdrawals, wins, losses
- `Referral` — Referral tracking
- `Session` — JWT sessions

## Production Checklist

- [ ] Replace mock wallet signatures with real cryptographic verification
- [ ] Configure actual blockchain RPC endpoints
- [ ] Deploy smart contracts and update addresses in `.env`
- [ ] Set up PostgreSQL with connection pooling (Supabase/Neon recommended)
- [ ] Configure `HOUSE_EDGE` appropriately
- [ ] Set `ADMIN_SECRET` and protect admin routes
- [ ] Enable rate limiting on API routes
- [ ] Set up SSL/HTTPS
- [ ] Configure CORS in socket server for your domain
- [ ] Add KYC/AML compliance if operating in regulated jurisdictions
