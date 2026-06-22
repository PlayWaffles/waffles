# Waffles v2 → Celo migration — living gap-map

**Branch:** `waffles-v2-migration` (off `main`). `main` stays untouched until the whole migration is ready.

**Principle (set by the owner):** the **v2 prototype screens are canonical** — they come over as-is (markup + scoped `styles.css` + assets). Celo's existing player UI is discarded. The **backend conforms to the design**: wherever a ported screen needs data the schema/API/PartyKit/chain doesn't have yet, we *add it*. Same rule for every part of the app. UI is the spec.

**Decisions locked:**
- Port `waffles_v2/src/app/styles.css` as-is, scoped under `.waffles-v2`. Tailwind stays for admin/non-game.
- Full replacement of the player-facing `(app)/(game)` UI.
- New DB URL, baselined to current schema, then per-phase migrations. ✅ done — DB in `.env` (old DB commented). **Note:** Prisma 7 + `prisma.config.ts` does NOT auto-load `.env` under Node; run Prisma commands with `bunx --bun prisma …`, or prefix `DATABASE_URL` explicitly.
- Verify via: this ledger + `tsc`/`build`/`eslint` + `prisma migrate status` + the existing test suites + driving every screen on the dev server (`:3001`) + side-by-side parity with the prototype.

Source of truth for "what data a screen needs": `waffles_v2/src/app/state.tsx` (the in-memory `Proto` contract) + each screen file.

---

## Architecture & derived decisions
- **Mount:** the prototype is ported verbatim into `src/app/v2/_app/` (private, non-routed module) and mounted at `src/app/v2/` (`layout.tsx` = v2 Google fonts + scoped `styles.css`; `page.tsx` re-exports the app). Final cutover repoints `(app)/(game)` at this; the `/v2` route is the staging/parity surface until then.
- **Data seam (the key to "screens are canonical"):** every screen consumes the `Proto` interface from `_app/state.tsx`. Phase 4 = reimplement `ProtoProvider`'s internals against **real data** (server actions / API + Prisma, wagmi for chain) **without editing screen code**. `Proto` is the contract; the schema grows to satisfy it.
- **Economy (derived from the prototype's own copy — "Tickets are the in-app currency… Prizes are paid in USDT, claimed from the Prize Wallet"):**
  - `tickets` = **off-chain soft currency** → DB wallet + ledger. Reversible; not real funds.
  - `winnings`/prizes = **real USDT on-chain** → reuse celo's existing merkle-claim path. `claim` = on-chain claim; `convert` = credit off-chain tickets.
  - Ticket **bundles** (buy tickets for money) = the on-ramp; payment rail still an open question, stub the credit until decided.
- **Hourly rounds:** start by reusing celo's time-derived `Game` lifecycle (presented as rounds); add a dedicated round entity only if the UI needs sub-game cadence the `Game` model can't express. _(Revisit in Phase 3.)_

## ⚠️ Verification lesson
A bare `HTTP 200` on `/play` was **misleading** — it was celo's `AppInitializer`
onboarding/auth gate (the "Guess the scene / Try a question" overlay), not the v2
app. The v2 app is client-rendered, so SSR/200 checks can't confirm it. **Verify
the real render with headless Chrome** (client hydration):
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --disable-gpu --dump-dom --virtual-time-budget=9000 http://localhost:3002/play
```
Confirmed: DOM contains `waffles-v2-stage`/`waffles-v2-onb-in`, no celo gate.
Fix: `AppInitializer` now bypasses the legacy gates for `/play` (commit 10cc882).

## Status legend
⬜ not started · 🟡 in progress · 🔵 wired, needs verify · ✅ verified on dev server

## Phase tracker
| # | Phase | Status |
|---|-------|--------|
| 0 | Branch + new DB baselined | ✅ branch cut; 53 migrations applied to new DB |
| 1 | Gap map complete (this doc) | 🔵 covers screens + mechanics; refine per-screen during wiring |
| 2 | Design-system port (`styles.css`, fonts, assets, `.waffles-v2` shell) | 🔵 v2 app ported verbatim to `src/app/v2/`, renders at `/v2`, scoped, 0 type errors. Needs visual parity check (Phase 6) |
| 3 | Schema + migrations for new models | ✅ migration `20260614223726_v2_progression_economy` applied (17 models, 8 enums, User + Question format fields); DB in sync, 0 type errors |
| 4 | Screen-by-screen wiring to real data (replace mock `ProtoProvider`) | ✅ all screens wired; **services verified 19/19** vs live DB; authed `/play` mount |
| 5 | Realtime / chain / API wiring | ✅ settlement cron built + verified; claim records on-chain USDT payout units (transfer fulfilled by settler infra) |
| 6 | Full verify pass + parity | 🟡 cutover LIVE (`/`→`/play`, 307); remaining = runtime UI parity eyeball + delete old `(game)`/chat code + schedule cron |

### Phase 4 progress
**Done — service layer VERIFIED 13/13 end-to-end against the live DB** (`scripts/verify-v2-services.ts`), plus typechecks + `/v2` renders, 0 errors:
- `src/lib/v2/playerState.ts` — player-state service: load, ticket ledger, level advance + milestone award, lives lose/refill/regen, winning resolve claim/convert, announcements, username.
- `src/lib/v2/rounds.ts` — tournament rounds: entry (one paid entry/round, no double charge), provisional score, **server-authoritative settlement** (real ranks among entrants → Prize Wallet).
- `src/lib/v2/economy.ts` — daily-reward weighted roll (mirrors `REWARD_POOL`, streak boost, freeze-save, idempotent/day), shop purchase (tickets), inventory grants (power-ups/cosmetics/boosts).
- `src/actions/v2.ts` — server actions (load, advance, lives, winnings, announcements, username, round enter/score, daily claim, purchase); no-op/null when unauthenticated so `/v2` still demos.
- `_app/state.tsx` (provider, not screen code) — hydrates real state on mount; persists safe mutations.
- **Content:** `scripts/seed-v2-questions.ts` seeded **505 `QuestionTemplate`s** into the new DB.

**Also done since:**
- Provider wiring: tournament **entry charge** (`v2EnterRound`) + **score submit** (`v2SubmitRoundScore`) now persist server-side (optimistic local kept).
- **Authed mount**: `src/app/(app)/play/` renders the v2 app under `<Providers>` (real auth) — compiles, serves 200. This is the cutover target.
- **Shop catalog seeded** (`scripts/seed-v2-shop.ts`, 11 items); purchase + inventory + fiat-only-bundle paths verified in `verify-v2-services.ts` (**16/16**).
- **Phase 5 settlement**: `settleClosedRounds()` + `POST /api/cron/settle-rounds` (Bearer-gated) built and endpoint-verified (401 unauthed, runs authed). Needs adding to the external cron scheduler alongside `roundup-games`.

**Now wired (typecheck-clean; UI behavior needs a runtime session to confirm):**
- **Daily claim** — `daily-reward.tsx` → `v2ClaimDaily` (server-authoritative roll + credit; local roll only as preview fallback).
- **Shop purchase** — `shop.tsx` → `v2Purchase`: power-ups persist at *final commit* (after the 4s undo window, so no refund path needed), cosmetics/featured persist immediately, bundles stay fiat-stubbed.
- **Cutover** — `/`,`/game`,`/leaderboard`,`/profile` → `/play` (307, LIVE on the running server).

**Now built + verified (19/19 in `verify-v2-services.ts`):**
- **Missions** — `src/lib/v2/missions.ts` (Quest-backed load + progress accrual + completion/XP award). Seeded 5 daily missions; `missions.tsx` loads real progress (static fallback in preview); accrual fired from tournament finish.
- **Leagues** — `src/lib/v2/leagues.ts` (11-tier ladder, XP→tier assignment, seasonal `LeagueMember`). Seeded 11 `League` rows; `leagues.tsx` highlights the player's real current tier.
- **On-chain payout** — `v2ResolveWinning('claim')` records the USDT payout amount (ticket value × 0.1 peg, 6-decimal units) on `Winning.merkleAmount` + marks CLAIMED; the settler infra fulfils the transfer + fills `claimTxHash`.

**Real competitive data wired + verified (20/20):**
- `rounds.roundStandings()` — real entrants, live rank by score or final rank once settled, + field size + your row.
- Leaderboard → real latest-round standings (mock fallback in preview); Results → real field size + your real rank (settled `finalRank` when available); Home → real current-round entrant count. (Compete shows no field count.)

**Now finished (verified 24/24):**
- **Streak-freeze purchase** persists (`buyStreakFreeze` → `v2BuyStreakFreeze`, wired in daily-reward).
- **Bundle top-up** credits tickets server-side (`buyBundle` → `v2BuyBundle`, wired in shop) — *payment still simulated; see payment rail below*.
- **Badge unlocks** persist to `UserBadge` (`recordBadge` → `v2RecordBadge`, wired in the badge watcher).
- **Announcements** seeded (`scripts/seed-v2-content.ts`, ids match client) — **fixes a latent FK bug**: read/dismiss `AnnouncementState` would have thrown without `Announcement` rows.
- **Multi-format questions** seeded to `QuestionTemplate` (multi/order/spatial parity).
- **Cron**: `local-cron.sh` now ticks `settle-rounds` too; `setAvatar`/`v2SetAvatar` available for a future avatar picker.

**Old experience retired (DONE):** root `/`→`/play`; deleted the old `(game)` `game/leaderboard/profile/layout` routes + `RealtimeProvider`/`useLiveGame`/`useTicketPurchase` (~70k lines); relocated the 3 still-reused quiz components to `src/components/quiz/`. `/game`→307→`/play`; source tsc 0; services 24/24.

**Genuinely remaining (cannot complete here — environment / decision / out-of-scope):**
- **Runtime UI parity eyeball** — drive every screen in a real Farcaster/MiniPay session. *Only your wallet/auth runtime can do it; not a code task.*
- **Real bundle payment rail** — *your product decision*. Off-chain credit is wired; `buyBundle` accepts a `txHash` for the on-chain path once you pick the rail.
- **Register `settle-rounds` in your prod scheduler** — same Bearer-POST as `roundup-games`; I have no access to your scheduler.
- **Power-up *consumption* / avatar *picker*** — the prototype has neither ("coming soon"/decorative); building them invents new UI and **violates the "screens are canonical" rule** — out of scope by design.

> **Verification boundary:** Phases 5–6 (PartyKit round settlement, on-chain USDT claim, end-to-end parity) require the live miniapp runtime (wallets, Farcaster/MiniPay context, PartyKit server) — buildable here, but final verification happens in that runtime.

---

## Screen inventory
Every v2 screen, its target celo route, the real data it consumes, and status.

| v2 screen (file) | Target celo route | Real data it needs | New backend work | Status |
|---|---|---|---|---|
| `home.tsx` | `(app)/(game)/` (home) | tickets balance, streak, lives, XP, active round/entry, last rank, result notifs, announcements banner, daily-reward state | ticket-wallet, lives, xp, hourly-round, result-notif, announcements | ⬜ |
| `onboarding.tsx` | first-run gate | username set, access | maps to `User.username` / `onboardingCompletedAt` ✓ | ⬜ |
| `levels.tsx` | `(app)/(game)/levels` (new) | per-track level reached, lives, milestone ticket rewards | `LevelProgress` model, lives | ⬜ |
| `level-intro.tsx` | part of levels flow | current level, question pack for track | level question draw | ⬜ |
| `level-result.tsx` (win/fail) | part of levels flow | hearts, xp gained, lives lost, milestone unlock | lives, xp | ⬜ |
| `question.tsx` | live play (level + tournament) | question (4 formats), timer, scoring | `Question.kind/correctSet/correctOrder/flags` | ⬜ |
| `lobby.tsx` | tournament countdown | round countdown, field size | hourly-round model | ⬜ |
| `compete.tsx` (`pass`) | `(app)/(game)/compete` | tournament entry, prize ladder, field, bonus | hourly-round, prize ladder | ⬜ |
| `results.tsx` | game result | score, provisional rank, settlement | hourly-round settle | ⬜ |
| `leaderboard.tsx` | `(app)/(game)/leaderboard` | ranked standings (round/league/global) | leaderboard queries (round-scoped) | ⬜ |
| `leagues.tsx` | `(app)/(game)/leagues` (new) | league tier, promotion/relegation, members | `League` models | ⬜ |
| `missions.tsx` | `(app)/(game)/missions` | mission list, progress, claim | maps to `Quest`/`CompletedQuest` (extend) | ⬜ |
| `shop.tsx` | `(app)/(game)/shop` (new) | catalog, ticket/soft-currency balance, purchase | `ShopItem`/`Purchase`, ticket-wallet | ⬜ |
| `profile.tsx` | `(app)/(game)/profile` | username, pfp, xp, streak, badges, stats, prize wallet (winnings claim/convert) | badges, winnings/prize-wallet | ⬜ |
| `daily-reward.tsx` | overlay sheet | daily streak reward day/claim | `DailyReward` claim ledger | ⬜ |
| `world-cup-takeover.tsx` + `world-cup/` | seasonal takeover | season config, WC question pack/formats | season model, WC formats | ⬜ |
| `announcements.tsx` | bell/inbox + home banner | announcement list, read/dismissed | `Announcement` + per-user read state | ⬜ |
| `badge-unlock.tsx` / `data/badges.ts` | global watcher | badge definitions + earned state | `Badge`/`UserBadge` | ⬜ |
| `coachmarks.tsx` | global tips | client-only (localStorage) | none (stays client) | ⬜ |

---

## Data-model gap (v2 concept → celo today → action)
| v2 concept | Celo schema today | Action |
|---|---|---|
| `tickets` (soft currency, pegged 1 = 0.1 USDT) | only real USDC `GameEntry.paidAmount`; no balance | **NEW** ticket/soft-currency wallet + ledger |
| `levelByTrack` (solo campaign, standard + world-cup) | none | **NEW** `LevelProgress(userId, track, level)` |
| `lives` / `nextLifeAt` (regen) | none | **NEW** lives fields/model + regen logic |
| `xp` | none (has quest `points`, streaks) | **NEW** xp field; reconcile with points |
| `streak` | `User.currentStreak/bestStreak/lastLoginAt` | ✅ reuse |
| hourly tournament `entry`/round | scheduled `Game` + `GameEntry` (time-derived phase) | **RECONCILE** — model hourly rounds (recurring Game) or new `Round` |
| `winnings` (prize wallet, claim **or convert→tickets**) | `GameEntry.prize/claimedAt/merkleProof` (onchain claim) | extend: add **convert-to-tickets** path + wallet view |
| `resultNotifs` (in-app result feed) | push only (`NotificationToken/Log`) | **NEW** in-app result/notif feed |
| `announcements` + read/dismissed | none | **NEW** `Announcement` + per-user state |
| `missions` | `Quest`/`CompletedQuest` ✅ | reuse + extend to match mission UI (progress/claim) |
| `leagues` | none | **NEW** `League`/`LeagueMember`/season |
| `shop` catalog | none | **NEW** `ShopItem`/`Purchase` |
| `badges` | none | **NEW** `Badge`/`UserBadge` |
| daily reward | none (has streak) | **NEW** `DailyRewardClaim` ledger |
| question formats: `multi`/`order`/`spatial`/`minefield` | `Question` is single-select (`correctIndex`) | extend `Question`/`QuestionTemplate`: `kind`, `correctSet`, `pick`, `correctOrder`, `flags`, `minefield`, `kicker`, `clues` |
| question bank | `QuestionTemplate` ✅ | reuse; add format fields above |
| World Cup season/theme | `GameTheme.FOOTBALL`, themed games | extend into a season concept |
| username / pfp | `User.username/pfpUrl` ✅ | reuse |
| auth (Farcaster/MiniPay) | `src/lib/auth.ts` ✅ | reuse; screens consume current user |
| **power-ups** (50/50, +5s, skip, shield) | none | **NEW** power-up inventory + consumption in play |
| **cosmetics** (avatar frame, name color, emote) | none | **NEW** cosmetic ownership + equipped state |
| **avatar selection** (set of animal avatars) | only `User.pfpUrl` | add `avatarId` (or reuse pfp) + selectable set |
| **ticket bundles** (buy tickets for real $) | none | **NEW** fiat/crypto on-ramp → wallet credit (payment rail TBD) |
| **boosts** (Double XP, time-limited, N-charges) | none | **NEW** active-boost model (expiry / remaining charges) |
| **streak freeze** (bought w/ tickets, saves streak) | none | **NEW** freeze inventory; consumed on missed day |
| **boss levels** (level-path boss encounters) | none | **NEW** boss config on the level campaign |
| **medal / tier ranks** (apprentice→silver→…→genius) | none | **NEW** tier derivation + display (overlaps badges) |
| sound/audio (`sound.ts` + 13 wavs) | none | client-only — Phase 2 asset port, no DB |
| invite / refer UI | `InviteCode`/`referrals`/`ReferralReward` ✅ | reuse existing referral system |
| chat | full `Chat` model + `GameChat` ✅ | **DROP** — v2 has no chat. Remove chat UI/components; leave `Chat` model + persisted data untouched (don't migrate away on this branch) |

---

## New functionality needing schema + migration (Phase 3 candidates)
1. **Ticket/soft-currency wallet** — balance + ledger (earn from levels/tournaments/shop; spend on entries/lives/shop). Backs `tickets` everywhere.
2. **Solo level campaign** — `LevelProgress` per track; milestone ticket rewards; lives system.
3. **Hourly tournament rounds** — recurring round model + provisional→settled lifecycle + per-round leaderboard (reconcile with existing `Game`).
4. **Prize wallet** — winnings with claim (onchain) **or** convert-to-tickets.
5. **Leagues** — tiered ladder, promotion/relegation, seasons.
6. **Shop** — catalog + purchases against the wallet.
7. **Badges** — definitions + earned state + unlock events.
8. **Announcements** — content + per-user read/dismiss.
9. **Daily reward** — claim ledger keyed by calendar day/streak.
10. **Multi-format questions** — extend question schema for multi/order/spatial/minefield.
11. **In-app result feed** — settlement notifications surfaced in-app.
12. **Power-up inventory** — owned counts + consumption hooks in live play.
13. **Cosmetics + avatar** — owned/equipped cosmetics; selectable avatar set.
14. **Boosts** — active time-limited/charge-based multipliers (e.g. Double XP).
15. **Streak freeze** — inventory consumed to protect a broken streak.
16. **Boss levels** — boss encounter config on the level campaign.
17. **Ticket bundles on-ramp** — purchase tickets with fiat/crypto (payment rail TBD).
18. **Daily reward roll** — store the weighted-random rolled prize + per-day claim + freeze count.

### Frontend-only (no DB) — Phase 2
- Sound system (`sound.ts` + `/public/sounds/*.wav`).
- Multi-theme skinning (`theme.ts` — more than just World Cup).
- Coachmarks (localStorage).
- Format Lab `/world-cup` playground (12+ formats; formats already graduate into live play — standalone page migrates only if owner wants it).

> Schema changes are derived from what the **screens actually consume** (typecheck-driven). Owner confirms before each migration touches the DB.

---

## Open questions for the owner
- **Soft-currency `tickets`** is the biggest new primitive. Is it a real on-chain balance, an off-chain ledger, or display-only initially? (Pegged 1 ticket = 0.1 USDT in v2.) Drives whether wallet work is DB-only or also chain.
- **Hourly rounds vs scheduled games:** keep celo's scheduled `Game` model and present it as "rounds," or add a true recurring round entity?
- **Missions vs Quests:** fold v2 missions into the existing `Quest` system, or separate?
- **Ticket bundles on-ramp:** what payment rail backs buying tickets for money — on-chain USDC, an existing PSP, or stubbed until later?
- Which features are **launch-blocking** vs can ship dark behind the new UI first?

---

## Mock → DB wiring pass (2026-06-15)
Removed the remaining static/mock data so screens read real DB state (mock now
only seeds the logged-out preview before `loadV2State` resolves).

- **initialState seed** cleaned: Forest level 23→1, xp 340→0, streak 12→0, seeded
  winnings → [], startingTickets 3→0. (`state.tsx`)
- **Results leaderboard** rows now come from `board.standings` (real top-3 + your
  row + the entrant behind you); hardcoded `@quizking/@trivia.eth/...` kept only as
  preview fallback. (`results.tsx`)
- **Home missions card** reads `v2LoadMissions` (top 3). (`home.tsx`)
- **Compete** wired to `v2LoadLeague` (ladder, current tier, points, season end)
  + `v2LoadSeasonPass` (level/progress/claims) + mission/offer counts. Free-track
  reward claims persist via `v2ClaimSeasonReward`. (`compete.tsx`)
- **Missions → Partners** reads `v2LoadPartnerOffers`; CTA claims via
  `v2ClaimPartnerOffer` (one-time, credits tickets, shows ✓ Claimed). (`missions.tsx`)
- **Leagues** reward chests now DB-backed via `loadLeague().tiers`. (`leagues.tsx`)
- **Shop** cosmetic name-plate preview uses the real username. (`shop.tsx`)

New schema (migration `20260615061321_v2_partner_offers_season_pass`): `PartnerOffer`,
`PartnerOfferClaim`, `SeasonPassClaim` + ledger reasons `PARTNER_OFFER`, `SEASON_PASS`.
New services: `partnerOffers.ts`, `seasonPass.ts` (+ pure `seasonPassTiers.ts`),
`leagues.ts` extended (reward ladder + `seasonEndsAt`). Seed: `seed-v2-partner-offers.ts`;
league rewards re-seeded. Verified: `tsc` 0 errors, `verify-v2-services.ts` 39/39
(12 new checks), `/play` compiles + boots clean.

---

---

## Server-authoritative round scoring (2026-06-17)
Closed a real-money hole: tournament scores were **client-trusted** —
`submitRoundScore(roundId, score)` wrote whatever integer the client posted, and
settlement paid USDT prizes by ranking on it. Tournament questions were also
drawn entirely client-side, so the server had no answer key to check against.

Now server-authoritative:
- **`src/lib/v2/roundQuestions.ts`** — the server issues each round's question
  set, deterministic by `roundId` (seeded mulberry32 shuffle over
  `QuestionTemplate`), same for every entrant. `getRoundClientQuestions` (client
  shape, keys included for instant feedback) + `getRoundScorableSet` (with the
  answer key, server-only).
- **`src/lib/v2/scoring.ts`** — pure re-scorer mirroring the client formula
  exactly (`base = round(100 + remainingSec*20)`; single/spatial, minefield
  ±, multi/order partial accuracy). Clamps response time to the window, ignores
  answers whose id wasn't issued, dedups replays, floors at 0, **caps at the
  round's theoretical max**.
- **`submitRoundAnswers`** replaces `submitRoundScore` — client posts per-question
  answers `[{id, selection, responseMs}]`, server recomputes + records the score
  (only unsettled entries; never moves backward). Actions: `v2GetRoundQuestions`,
  `v2SubmitRoundAnswers` (both replace `v2SubmitRoundScore`).
- **Client** (`_app/state.tsx`) — tournament entry fetches the server set (swaps
  in during the lobby countdown), accumulates `roundAnswers` as you play, submits
  them at finish. Local `score` kept for instant XP/UI only.

**All questions now server-sourced (2026-06-17, follow-up):** solo levels also
draw from the DB, not the phone bank. `getLevelClientQuestions(track, level)` +
action `v2GetLevelQuestions` select by the track's theme (`world-cup` → FOOTBALL,
`standard` → everything else) and the level's difficulty ramp (mirrors the client
`levelDifficulties`). The client prefetches the set on the level-intro screen
(`enterLevel`) and `beginLevelQuiz` uses it. The local `QUESTION_BANK` /
`pickLevelQuestions` / `pickTournamentQuestions` remain **fallback-only** (offline
/ fetch failure) so the game never hard-breaks. Note: level *scoring* is still
client-side (XP + milestone tickets via `v2AdvanceLevel`) — soft currency, not
real money; server-validating it is a separate follow-up. Verified `tsc`/`eslint`
0; level checks added to `verify-v2-services.ts` (run where the DB is reachable).

Verified: `tsc` 0, `eslint` 0, pure-scorer unit suite 16/16 (incl. forged-id,
replay, cap, spam, negative-floor). DB-dependent `verify-v2-services.ts` updated
with the new round path (perfect-score == cap, forged < cap) but **not run here —
remote DB unreachable from this sandbox**; run it where the DB is reachable.

**Residual (accepted for this pass):** a hand-crafted client can still report
*optimal* picks (the answer keys are sent for instant feedback). Closing that
needs commit-reveal (withhold keys, per-question server validation) — a larger
follow-up. Also: if the server question fetch fails at entry, the round plays on
the local set (no ids) and scores 0 — transient-failure degradation to harden later.

---

---

## On-chain tournament rounds — reuse v1's money lifecycle (2026-06-17)
Decision (owner): a tournament round **is a v1 `Game`**. Entry is a real on-chain
USDC deposit that funds the on-chain pool (exactly like v1) — no treasury
funding, no new contract. Maximal reuse of the existing chain stack.

**Built — server bridge** (`src/lib/v2/tournamentGames.ts` + actions in `v2.ts`):
- `currentTournamentGame(platform)` / `v2GetTournament` — the platform's live
  on-chain `Game` as the round, plus its own questions (client shape).
- `enterTournamentOnChain` / `v2EnterTournament` — verifies the player's on-chain
  `buyTicket` via **reused `verifyTicketPurchase`**, creates a `GameEntry`, funds
  `prizePool`/`playerCount`. Idempotent (unique `txHash` + `(game,user)`).
- `submitTournamentAnswers` / `v2SubmitTournamentAnswers` — server-authoritative
  scoring against the **game's own `Question` rows** (reuses `scoreRound` + caps),
  writes `GameEntry.score` + the v1 `answers` JSON.

**Reused as-is, no new code:**
- **Scheduling/creation** — `createAutoScheduledGame` → `createGameOnChain` (the
  existing auto-scheduler creates the hourly on-chain games).
- **Settlement** — `rankGame` + `publishResults` (merkle root on-chain via
  `submitResults`). The `roundup-games` cron already sweeps any ended game, so v2
  tournament games settle automatically.
- **Claim** — the v1 claim route (`verifyClaim` + on-chain `claimPrize`), keyed by
  `gameId`; works for these entries unchanged.

Verified `tsc`/`eslint` 0. Additive — the off-chain `RoundEntry` path still exists
(to be reconciled in the deferred off-chain-tickets discussion).

**Client wallet wiring — DONE (2026-06-17).** The v2 app mounts only at `/play`
(the `/v2` preview was deleted), which has wagmi, so no preview constraint.
- `src/app/v2/_app/useTournamentWallet.ts` — promise-based `enter(platform,
  onchainId, fee)` (approve + `buyTicket` + confirm) and `claim(platform,
  onchainId, amount, proof)` (`claimPrize` + confirm), reusing `waffleGameAbi`,
  the payment token, `withBuilderCodeDataSuffix`, `ERC20_ABI` verbatim.
- Provider (`state.tsx`) actions: `enterTournamentOnChain()` (wallet deposit →
  `v2EnterTournament` server-verify → start round on the server's questions) and
  `claimTournamentPrize(gameId)` (`v2GetTournamentClaim` → wallet `claimPrize` →
  `v2ConfirmTournamentClaim`). Finish-submit routes to `v2SubmitTournamentAnswers`
  when `tournamentGameId` is set. New server pieces: `getTournamentClaim` +
  `confirmTournamentClaim` (reuses `verifyClaim`). `tsc`/`eslint` 0.

**Screen hookup — DONE (2026-06-17).**
- Wallet hook reuses v1's robustness: **chain-switching** (`useSwitchChain`, mirrors
  `useCorrectChain`) + v1-style **error mapping** (user-rejected, insufficient,
  MiniPay low-balance message). The old v1 entry/claim UI (`useTicketPurchase`,
  `PurchaseView`) was deleted in `90b0812` and coupled to the removed
  `RealtimeProvider`, so the *orchestration* was reused, not the dead components.
- **Entry:** Home `JoinConfirmSheet` + level-result → `enterTournamentOnChain()`
  with pending/error states; the sheet now frames it as a wallet-paid entry (not a
  ticket). `openJoin` always opens confirm (wallet reports balance).
- **Claim:** new `v2LoadTournamentClaims` + `loadTournamentClaims`; the profile
  Prize Wallet lists claimable on-chain prizes with a Claim button →
  `claimTournamentPrize(gameId)` (claiming/error states).
- `tsc`/`eslint` 0. Wallet flow still **unverified in this sandbox** (no chain).

**Remaining:**
- **Orphaned ticket UI** — the shortfall sheet / first-ticket-offer / ticket copy
  are now bypassed; clean them up as part of the parked off-chain-ticket reconcile.
- **Hourly cadence — DONE.** Confirmed the v1 auto-scheduler is NOT hourly
  (Mon/Wed/Fri 14:00 UTC, 24h games). Added `ensureHourlyTournamentGame(platform)`
  (reuses `createAutoScheduledGame` → on-chain create + question assign, hourly
  window, idempotent) + cron `POST /api/cron/ensure-tournament-rounds` (Bearer-
  gated). **Register it hourly** alongside `settle-rounds` (same secret).
- **On-chain interactions unverifiable in this sandbox** (no chain access).
- **Reconcile the off-chain `RoundEntry` path** — deferred to the off-chain-tickets
  discussion.
- **Season pass** — deferred by owner. The Season Pass block in `compete.tsx` now
  renders under a `ComingSoonVeil` (dimmed + non-interactive "🔒 Coming soon",
  design preserved, matching the Shop teaser). Service (`seasonPass.ts`) stays
  as-is; remove the veil to re-enable.

---

_Last updated: 2026-06-17 — on-chain tournament rounds (v1 reuse). Update statuses as rows are wired + verified._
