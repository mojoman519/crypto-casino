# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server with Turbopack (port 3000)
npm run build        # prisma generate + next build
npm run socket:dev   # Socket.io server (port 3001, separate process)

npm run db:push      # Push schema changes to Neon without migration history
npm run db:migrate   # Create a named migration (use for production changes)
npm run db:studio    # Prisma Studio GUI
npm run db:generate  # Regenerate Prisma client after schema edits
```

The socket server must run alongside the Next.js dev server for crash/jackpot real-time features. Vercel does not support long-running processes — the socket server needs a separate deployment (e.g. Railway) in production.

After editing `prisma/schema.prisma`, always run `npx prisma db push` locally AND redeploy on Vercel to regenerate the client.

## Architecture

### Authentication
JWT-based. Tokens are stored in Zustand under the `casino-auth` key (not `casino_token` in localStorage). Always retrieve them with `getAuthToken()` from `src/lib/token.ts`. API routes accept the token via `Authorization: Bearer <token>` header. The `requireAdmin()` function in `src/lib/auth.ts` reads from cookies only — the admin dashboard uses the Bearer header pattern via its own inline `adminAuth()` helper.

### Balance System
Two separate balance layers:
- **DB (source of truth):** `user.neonCoins` (NC), `user.balance` (SOL/real), `user.solBalance` (SOL on-chain)
- **Client store:** `useWalletStore` in `src/store/walletStore.ts` — optimistic updates with rollback

Currency mapping in `src/lib/transaction-service.ts`: `NC → neonCoins`, `SOL → balance`. Never trust the frontend balance for bet validation — always re-read from DB inside a `$transaction`.

### Game Transaction Pipeline
Every bet goes through this pipeline (in all 5 game API routes):
1. `validateBet()` — checks game config (min/max/enabled), rate limits, fraud patterns
2. `beginBet()` — atomically deducts balance + creates `GameTransaction(PENDING)`
3. Game logic runs (provably fair result)
4. `resolveBet()` — atomically credits winnings + marks `GameTransaction(WON/LOST)`
5. On error: `rollbackBet()` — refunds and marks `GameTransaction(ROLLED_BACK)`

All functions are in `src/lib/transaction-service.ts`. Crash is a special case: `beginBet` runs on bet placement, but `resolveBet` runs in the cashout route (`/api/games/crash/cashout`), not the bet route.

### Game Settings
Per-game settings (house edge, min/max bet, rate limits, enabled toggle) are stored in the `GameConfig` DB table. `getGameConfig(gameType)` in `src/lib/game-config.ts` reads from DB with a 30-second in-memory cache and auto-seeds defaults on first access. Admin changes invalidate the cache via `invalidateGameConfig()`.

### Provably Fair
All randomness uses HMAC-SHA256: `generateResult(serverSeed, clientSeed, nonce)` in `src/lib/provably-fair.ts`. The server seed is generated per-round and revealed after resolution. `serverSeedHash` is shared with the client before the game so the outcome can be verified later.

### Layout Architecture (Stake-style)
```
layout.tsx
├── <AmbientParticles />     fixed, z-index:0, pointer-events:none
├── <CelebrationOverlay />   fixed, z-index:9999, only fires on win events
└── <div relative z-10>      stacking context above particle canvas
    ├── <Navbar />            wallet/profile only — no game links
    ├── <div h-[calc(100vh-4rem)] flex overflow-hidden>
    │   ├── <Sidebar />       game nav, search, favorites, recently played
    │   ├── <main />          active page content
    │   └── <RightPanel />    live bets feed + chat
    └── <MobileNav />         fixed bottom, visible only on mobile (<lg)
```

Sidebar and RightPanel use `h-full` (not `sticky`) because the parent has a fixed height. `sticky` inside `overflow:hidden` does not work in CSS.

### Particle System
`ParticleEngine` class in `src/lib/particle-engine.ts` manages a pre-allocated pool of 180 particles (no GC pressure). Two canvas instances run in parallel:
- `AmbientParticles` — ambient floating orbs/diamonds, responds to mouse repulsion
- `CelebrationOverlay` — burst-only, `ambientCount: 0`, triggered via `fireWinCelebration(detail)` custom event

To trigger a win burst from any component: `fireWinCelebration({ amount: winAmount })` — imported from `src/components/effects/CelebrationOverlay.tsx`.

To add custom brand images: add URLs to `THEMES.customAssets.imageUrls` in `src/lib/particle-themes.ts`, then call `setTheme('customAssets')`.

### Admin
Admin account is created via `POST /api/admin/seed` using `ADMIN_SECRET` + `ADMIN_PASSWORD` env vars. The dashboard at `/admin` calls separate admin API routes under `/api/admin/*` that authenticate via Bearer token (not cookies).

### Key Environment Variables
- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET` — signs auth tokens AND HMAC-signs game transactions
- `NEXT_PUBLIC_HOUSE_WALLET_SOL` — Solana house wallet address
- `ADMIN_SECRET` — protects the seed endpoint (one-time use)
- `ADMIN_PASSWORD` — bcrypt-hashed and stored on seed; min 12 chars
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — avatar/banner storage
- `HELIUS_API_KEY` — optional, enables Solana NFT fetching for profile pictures

All env vars must be enabled for Production + Preview + Development in Vercel, and the project must be redeployed after any change.
