# Waffles — Retention & Tournament Build Plan

Consolidated from the data analysis (Umami staging × app DB, June 2026). Insights
first, then a prioritized build list — each item notes the insight that justifies
it and how it's implemented in code.

---

## Insights we have

**Scale of the problem (15,368 MiniPay users):**
- **75.5%** of signups do *nothing* beyond signup day. **6.8%** ever return on a
  later day. **7.2%** ever play a tournament. **0.8%** play a second one.

**The funnel:**
- **Tournament purchase is broken.** 1,435 unique users started a ticket
  purchase, **~91% failed**, only 126 completed. 84% drop *before submitting the
  approval tx*. Demand is huge (post-level upsell accepted by ~94%); execution fails.
- Auth/wallet leak: `auth_started` 3,679 → fail 780 (~22%).
- Acquisition quality is **declining** week over week: tournament conversion
  halved W23 (11.8%) → W25 (5.7%); repeat collapsed 1.8% → 0.2%.

**What actually drives coming back + playing again (causally tested):**
1. **Winning.** First tournament WON → **38.9% re-enter** vs LOST → 8.6% (the win
   comes first, so it's directional). Top-3 first finish → ~2–3× repeat. But
   **88% finish 11th+ and never win** (30+ player fields, top-3-only payout).
2. **The daily / streak ritual.** Claimed daily ≥1× → **23.4% return vs 0.9%**.
   `cameBack ~ claim-days` r=0.53 (strongest return correlate). Functional but
   only 5.4% of users ever claim. Freezes were never applied (bug, now fixed).
3. **Depth — campaign + tournament together.** Campaign-only 5% return,
   tournament-only 9%, **BOTH 52% return / 22% repeat**. World Cup track is the
   active one (Standard is dead, 97% at level 1). XP≥200 → 65% play tournaments.

**Debunked (contrarian):**
- **League is not a driver** — it's a byproduct of play (points auto-accrue);
  "in a league" lift = "plays campaign". Barely viewed (1,026 views / 4,810 users).
- **Impulse acquisition doesn't retain** — 80% enter <1h of signup, repeat 10%.
- **Frustration ≠ churn** — users who lost ≥10 lives returned at 42.6% (engagement).

**Ops:** prod Umami site records 0 events (all tracking lands on the "staging"
site); the Umami instance is on default `admin`/`umami` creds.

---

## Build list

### 0. Daily-reward / streak fix ✅ (done this session, pending deploy + backfill)
**Insight:** Daily claim is the return ritual (23% vs 0.9%), but the streak was
login-driven (phantom resets) and freezes were never applied (`used_freeze` true
only 5× across all of Umami vs 652 purchases).

**In code (shipped):**
- `src/lib/player/dailyStreak.ts` — `resolveLoginStreak` → `resolveClaimStreak`
  (claim-driven, consumes freezes to bridge missed days) + read-only `displayStreak`.
- `src/lib/player/economy.ts:claimDailyReward` — resolves streak off the last
  `DailyRewardClaim`, decrements `streakFreezes`, sets `usedFreeze`.
- `src/lib/player/playerState.ts` + `auth.ts` — app-open paths read-only
  (`touchUserLastSeen` no longer mutates the streak).
- `src/player/screens/daily-reward.tsx` — fixed the off-by-one display.
- `scripts/backfill-streak-claims.ts` — grandfathers existing streaks.
  **Run order:** deploy → `bunx tsx scripts/backfill-streak-claims.ts --commit`.

### 1. Fix the tournament purchase flow — **#1 priority, gates everything**
**Insight:** 1,435 users started a purchase, ~91% failed, 126 succeeded; 84% drop
before even submitting the approval. (Latest local repro: a `switchChain` failure
on MiniPay — 11142220 → 42220 — is one concrete failure mode.)

**In code:**
- Instrument first: pull `ticket_purchase_failed` properties from Umami to bucket
  the `reason` per step (the started→approval cliff localizes it to chain-switch /
  USDC allowance / approval).
- Touchpoints: `src/hooks/waffleContractHooks.ts` (wagmi `approve` + `enterGame`),
  `src/player/useTournamentWallet.ts` (approve→deposit orchestration; the chain-
  switch step), server verify `enterTournament` in `tournamentGames.ts`.
- Fixes: handle/await `switchChain` robustly (it's throwing on MiniPay), single
  **infinite USDC approval** (skip re-approve when allowance covers entry), gas
  fallback + RPC retry, surface real revert reasons, and resume via
  `reconcilePendingPurchases` (cron) for tx-submitted-but-not-synced cases.

### 2. Rookie Cup — guaranteed first win against a real ghost field
**Insight:** First-win → 39% repeat vs 9% loss; 88% never win. A winnable first
game using **real past players' real scores** (ghosts) delivers the win to 100% of
first-timers, instantly — no scheduling/field problem. Framing must not claim the
opponents are *live now*; they're a real past "field" you beat.

**In code:**
- Schema: `kind GameKind @default(MAIN)` on `Game` (`enum GameKind { MAIN ROOKIE }`);
  rookie games have `onchainId = null` (off-chain), free entry, wide payout.
- `buildGhostField(theme, n)` in `tournamentGames.ts` — sample real prior
  `GameEntry` rows (`username`, `score`) of the same theme → `TournamentStanding[]`.
- `enterRookie(userId)` — first-timers (no prior paid `GameEntry`) route here;
  create a `GameEntry` with `purchaseSource: FREE`, no payment.
- `settleRookie(gameId, userId)` runs **synchronously on submit** (opponents are
  static) — ranks vs ghost scores, biasing the sampled field so the player lands ~top-3.
- Reward: `adjustTickets(userId, syrup, ROOKIE_REWARD)` + a free real-tournament
  seat (item 3). Client: reuse `question.tsx` + a rookie leaderboard (real
  names/scores) with the honest copy below.

### 3. Daily streak → tournament bridge (free seat)
**Insight:** Small daily rewards don't pull people to the thing that retains. Make
the Day-7 jackpot a tournament shot — and it bypasses the broken purchase flow.

**In code:**
- Schema: `freeTournamentEntries Int @default(0)` on `User`.
- `economy.ts` — add a `free_entry` reward type to `DAILY_SCHEDULE` (Day-7) and the
  rookie reward; granting increments `freeTournamentEntries`.
- `enterTournament` — if `freeTournamentEntries > 0`, create the `GameEntry` as
  `purchaseSource: FREE` and decrement (no on-chain purchase → dodges item 1).
- `daily-reward.tsx` — render Day-7 as "🎟️ Free tournament seat".

### 4. Manufacture wins in real games — widen the payout ✅ (done this session)
**Insight:** Top-3-of-30 means 88% never win; top-10 finishers repeat ~20% vs 9%.

**In code (shipped):**
- `prizeDistribution.ts` — `consolationSyrup(rank, fieldSize, hasCashPrize)` +
  `TOURNAMENT_CONSOLATION_SYRUP` (20). Pure/deterministic so settlement and the
  client results screen stay in sync.
- `lifecycle.ts:rankGame` — after the cash podium + winner bonus, grants the
  consolation Syrup (`adjustTickets … TOURNAMENT_REWARD`, note "top-half
  consolation") to every non-cash finisher in the top half. Cash stays
  **USDC-only to the podium** (merkle untouched). Fresh-ranking path → once per
  game; best-effort.
- Smaller fields: `TOURNAMENT_MAX_PLAYERS` (tournamentGames.ts) and
  `DEFAULT_MAX_PLAYERS` (auto-schedule.ts) 50 → 20.
- `results.tsx` — folds the consolation into the Syrup tile when settled (label
  flips to "TOP-HALF BONUS"), so a top-half finish reads as a win.

### 5. Campaign as tournament practice + skill-edge ✅ (done this session)
**Insight:** Doing both → 52% return; World Cup is the active track. Make the
campaign matter *to* the tournament.

**In code (shipped):**
- Migration `20260624040000_skill_edge_bonus_score` — `GameEntry.bonusScore`
  (SmallInt, default 0).
- `scoring.ts` — `tournamentSkillBonus(completedLevels)` = `min(levels*15, 200)`
  (pure, shared client+server; capped under one fast question so it tips close
  finishes, not steamrolls).
- `tournamentGames.ts` — `playerSkillBonus(userId)` reads `LevelProgress.WORLD_CUP`
  (level-1 = completed). `enterTournamentOnChain` folds it into the new entry
  (`bonusScore` + `score = bonusScore`, so the head start shows on the live
  board immediately). `submitTournamentAnswers` rebuilds `score = round +
  bonusScore`, so ranking/standings/index paths stay unchanged.
- `playerApi.getTournament` returns `skillBonus`; the Home entry sheet
  (`home.tsx`) shows "World Cup head start — you start +N from your campaign."
- Practice loop: settled `results.tsx` adds "Practice for next round — climb the
  World Cup" → routes into the WC campaign (`levelTrack: "world-cup"` → `levels`).

### 6. Wire the re-engagement notifications (exist, never fire)
**Insight:** `retention.comeback` + `retention.streakReminder` exist in
`templates.ts` but are referenced nowhere — dead code.

**In code:**
- `cron.ts` — daily job: streak-at-risk users (last `DailyRewardClaim.dayKey ==
  yesterday`, not claimed today) → `streakReminder`; inactive users → `comeback`.
- Channel gap: `send.ts` routes MiniPay → `deliverInAppNotifications` (in-app only,
  seen on next open). Real winback needs a Telegram adapter
  (`src/lib/notifications/adapters/telegram.ts`) + stored chat IDs. **Partly
  blocked on the Telegram opt-in channel.**

### 7. Analytics routing fix + rotate creds (ops)
**Insight:** Prod Umami site has 0 events (all on "staging"); default creds.

**In code:** point the prod build's Umami `website-id` (env
`NEXT_PUBLIC_UMAMI_WEBSITE_ID`, consumed in `src/lib/analytics.ts` `getUmami`) at the
prod site; rotate the Umami admin password.

### 8. Simplify the leaderboard to V1 (current game · all-time · previous games)
**Insight:** League is a byproduct, not a driver; the tier-swipe added this session
is complexity for a non-driver. V1's model is simpler and what people want.

**In code:**
- `src/player/screens/leaderboard.tsx` — remove the league-tier swipe (viewedKey,
  tier dots/chevrons, `loadLeague` ladder, `loadTierLeaderboard`). Three views:
  - **Current game** → `loadCurrentTournamentBoard` / `latestTournamentStandings`.
  - **All-time** → new `loadAllTimeLeaderboard(platform, limit)` in
    `tournamentGames.ts` (`gameEntry.groupBy` by userId, `_sum`/`_max` score).
  - **Previous games** → new `listPreviousGames(platform, limit)` + existing
    `tournamentStandings(gameId)` per selection.
- API: add the two to `playerApi.ts` → `[action]/route.ts` → `api.ts`. **Remove
  `loadTierLeaderboard`** (added this session) — this intentionally reverts the swipe.

### 9. Remove the Shop (temporarily — disable, don't delete)
**Insight:** Barely used (`shop_viewed` 1,121); cuts surface area. Temp-off
features get guarded over intact code, not deleted.

**In code:**
- `src/player/shared.tsx` — remove the `shop` bottom-nav item (`{ id: "shop", … }`).
- `src/player/page.tsx` — leave the lazy `shop` import unreachable / add a guard.
  Keep `screens/shop.tsx` + `economy.ts` (`getShopCatalog`/`purchase`) intact.
- Caveat: Shop is the main **Syrup sink** (power-ups, cosmetics, lives refill).
  Streak-freeze (daily sheet) still works; Syrup will accumulate unspent until
  another sink exists (rookie/free-seat reward partly absorbs it).

### 10. Remove the Season Pass (temporarily — disable, don't delete)
**Insight:** Extra progression surface, not a proven driver. Strip to focus.

**In code:**
- `src/player/screens/compete.tsx` — remove the Season Pass section (`pass` state,
  `loadSeasonPass()` effect, `SEASON_PASS_TIERS` render). Leave the rest of Compete.
- Keep `seasonPass.ts` + `seasonPassTiers.ts` + `claimSeasonReward`/`loadSeasonPass`
  untouched (disabled at UI only). League *seasons* (weekly cohort settlement) are
  separate and not touched here.

---

## Rookie Cup copy (honest framing — real names/scores, no "live now")
- Lobby: `🧇 ROOKIE CUP` · `Your first tournament. Beat the field to graduate.` ·
  field indicator `26 in the field` (not "26 playing now").
- In-game climb: `You're #19 of 26` → `#3 of 26 🔥` · `2 spots off the podium`.
- Win: `🏆 YOU PLACED #2 OF 26` · `You beat 23 rookies on your first try.` ·
  `+10 Syrup · 🎟️ 1 free tournament seat`.
- Graduation (this one *is* live, so "now" is true): `You're not a rookie anymore.
  A live tournament is running right now — your seat's already paid. Walk in.`

---

## Sequencing
1 (purchase fix) → 0 (deploy + streak backfill) → 8 (leaderboard V1, no migration) →
2 + 3 (rookie + free-seat bridge) → 4 (payout) → 5 (skill-edge) → 9 + 10 (disable
shop/season) → 6 (notifications) → 7 (ops).

Items 2/3 need a Prisma migration (`GameKind`, `freeTournamentEntries`), deployed
through the pipeline (not run against prod locally).
