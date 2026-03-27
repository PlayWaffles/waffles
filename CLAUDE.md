# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Waffles is a real-time multiplayer trivia platform. Players buy tickets (USDC on Celo Sepolia), compete in timed quiz games, and winners split a prize pool. The app runs on two platforms:
- **Farcaster** (MiniKit frame) — auth via Farcaster Quick Auth (JWT bearer tokens)
- **MiniPay** (Celo wallet) — auth via wallet signature (nonce + cookie sessions)

## Commands

```bash
pnpm dev              # Start Next.js dev server (port 3000)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm prisma migrate dev --name <name>  # Create a new migration
pnpm prisma generate  # Regenerate Prisma client (also runs on postinstall)
pnpm prisma studio    # Database GUI
```

PartyKit (real-time server) is proxied through Next.js rewrites in dev (`/parties/*` → `localhost:1999`). For production, set `NEXT_PUBLIC_PARTYKIT_HOST`.

## Architecture

### Dual-platform auth (`src/lib/auth.ts`)
`getAuthFromRequest()` checks for a Bearer token (Farcaster) first, then falls back to a `waffles_session` cookie (MiniPay wallet). The `withAuth` / `withOptionalAuth` higher-order functions wrap API route handlers. Platform is also resolved at runtime via cookie/header (`src/lib/platform/`).

### Real-time layer (PartyKit)
- `party/main.ts` — `GameServer` class handling WebSocket connections, HTTP API, and alarm-based game lifecycle (countdown phases → start → end)
- `shared/protocol.ts` — Single source of truth for all WebSocket message types, shared between server and client
- Handlers split into `party/handlers/` (http, websocket, alarms)

### Game lifecycle
Game phase is derived from time, not a stored status enum — see `getGamePhase()` in `src/lib/types.ts`. A game is `SCHEDULED` → `LIVE` → `ENDED` based on `startsAt`/`endsAt` timestamps.

### Data layer
- Prisma v7 with `@prisma/adapter-pg` (PostgreSQL). Config in `prisma.config.ts`, schema in `prisma/schema.prisma`
- Generated client lives in `prisma/generated/` (committed to repo)
- Import Prisma types from `@prisma` (path alias), e.g. `import { UserPlatform } from "@prisma"`

### On-chain
- Chain: Celo Sepolia (`src/lib/chain/config.ts`)
- Smart contract interactions via wagmi hooks (`src/hooks/waffleContractHooks.ts`)
- Payment token is USDC (6 decimals)
- Two operator keys: `OPERATOR_PRIVATE_KEY` (game operations) and `SETTLER_PRIVATE_KEY` (prize settlement)

### Route structure
- `src/app/(app)/(game)/` — Player-facing pages (game lobby, live play, results, leaderboard, profile)
- `src/app/admin/` — Admin dashboard (game management, invite codes, question bank)
- `src/app/api/v1/` — REST API routes
- `src/app/api/v1/internal/` — Server-to-server routes (e.g. PartyKit → Next.js notifications)

### Key patterns
- Server Actions in `src/actions/` for mutations from client components
- Environment validation via Zod schema in `src/lib/env.ts` — all env vars accessed through the `env` object
- Notifications: Farcaster webhook-based notifications with batching (`src/lib/notifications/`)
- State management: Zustand stores, React Query for server state, SWR in some hooks
