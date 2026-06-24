# Onboarding + Leaderboard revamp

Changes to the v2 player app (`src/player/`) focused on **paying-user conversion**
and a **simplified, leaderboard-centric IA**. Grouped by feature; each lists the
rationale, the files touched, and any follow-ups.

---

## 1. Onboarding: port v1's conversion DNA into the v2 shell

**Why.** The pre-migration v1 onboarding converted browsers into *paying* players
better than v2's free-play orientation, because it planted the paid mental model
immediately and let people *play* before committing. v2's flow led with levels /
streaks / XP (all free mechanics) and never mentioned money, so users finished
onboarding thinking "free trivia app" and paying was an unsupported later leap.

**What.** Rewrote the onboarding to a **3-slide, money-first flow** (v1-lean,
including the username slide):

1. **Pitch (money-forward)** — "Answer fast. Win the pot.", real USDT, prize pool,
   "buy in for a few cents", plus one combined social-proof/live cue and a
   prize-chest hero.
2. **Demo question (interactive)** — a real question via the existing
   `getDemoQuestion()` action, styled exactly like the live quiz (cream tile +
   frame border, leaf = correct / red = wrong), with branching feedback. Builds
   investment before the account ask. Degrades to a 2-slide flow if the demo
   template is missing (as v1 did).
3. **Account (username slide)** — headline branches on the demo result; username
   picker + wallet sign-in. On success a money-forward welcome card funnels into
   the **live paid tournament** instead of a free level.

**Paid funnel ("land buy-primed").** The welcome card sets a one-shot
`pendingTournamentJoin` flag instead of `startLevel()`. Home consumes it once the
live round details load and auto-opens the existing `JoinConfirmSheet` (prize +
$0.05 first-entry + graceful MiniPay "Add Cash" for unfunded wallets). While the
intent is pending, the first-visit World Cup / daily-reward takeovers are
suppressed so nothing covers the buy moment. Onboarding-origin entries are tagged
with a new `"onboarding"` `TournamentEntrySource` for conversion measurement.

**Files**
- `src/player/screens/onboarding.tsx` — full rewrite (3-slide money flow, demo, branching payoff).
- `src/player/state.tsx` — `pendingTournamentJoin` flag (state + initial).
- `src/player/screens/home.tsx` — consume the flag → auto-open the buy sheet; thread the onboarding entry source.
- `src/player/page.tsx` — suppress first-visit takeovers while the join intent is pending.
- `src/lib/player/tournamentGames.ts` — add `"onboarding"` to `TournamentEntrySource`.

**Follow-ups**
- Confirm the demo-question template (`cmkct276…`) still exists in the DB, else the demo step silently drops to 2 slides.
- Walk the new-wallet funnel: buy-sheet auto-open timing on first paint + the Add-Cash path for an unfunded wallet.
- Visual pass on the pitch slide + welcome card.

---

## 2. `sample/v1` — hosted preview of the original onboarding

**Why.** Restore the deleted v1 onboarding for side-by-side comparison.

**What.** Recovered `OnboardingOverlay.tsx` from git history and hosted it at
`/sample/v1` (mock demo question, loops on completion), following the existing
`src/app/sample/` preview convention. Removed its dependency on `canvas-confetti`
(dropped from the repo since) — the package was missing, which both failed the
type build and dead-ended the final CTA (`onComplete` was gated behind the failing
confetti import).

**Files**
- `src/components/OnboardingOverlay.tsx` — restored; confetti dependency removed.
- `src/app/sample/v1/page.tsx` — new preview route.

---

## 3. Leaderboard is now the primary "compete" destination

**Why.** The bottom-nav tab opened the league/season-pass screen; the global
leaderboard was buried behind "See ranking" buttons.

**What.** Repointed the tab to the leaderboard and **renamed it "Leaderboard"**
(kept the trophy icon). `LeaderboardScreen` already rendered the bottom tab bar, so
it slotted in as a primary tab; dropped its now-pointless "Back to Compete" button.

**Files**
- `src/player/shared.tsx` — nav tab → `leaderboard`, label "Leaderboard".
- `src/player/screens/leaderboard.tsx` — removed the back button; `TabBar active="leaderboard"`.

---

## 4. Winnings in USDT + Tournament/Levels leaderboards

**Why.** Surface real winnings, and add a progression board alongside the paid one.

**What.** A **Tournament / Levels** toggle on the leaderboard:

- **Tournament** — three sub-tabs:
  - *This game* — live standings (score; winnings chip once settled).
  - *Top earners* (was "All-time") — now ranked by **total winnings (USDT)**, not score.
  - *Past games* — per-game settled standings.
  - Every row shows the player's **winnings in USDT** (`$X.XX` chip) when `prize > 0`.
- **Levels** — new board ranking everyone by **total XP** (`User.xp`); rows show `Lv N` + XP. Level derived from XP using the same 500-XP rollover as the Home bar.

**Files**
- `src/lib/player/levelsLeaderboard.ts` — **new**: XP-ranked board (platform-scoped, derives level, resolves the caller's true rank outside the top 50).
- `src/lib/player/tournamentGames.ts` — `allTimeLeaderboard` now sums `prize` and ranks by winnings (tiebreak: score); per-row `prize` populated.
- `src/lib/player/playerApi.ts` — `loadLevelsLeaderboard` server wrapper.
- `src/app/api/v1/player/[action]/route.ts` — registered the new action.
- `src/player/api.ts` — client wrapper + `LevelBoard` type import.
- `src/player/screens/leaderboard.tsx` — mode toggle, winnings column, XP rows, per-mode headings/empty-states/info copy.

**Behavioral notes**
- The old "All-time scores" tab is now **"Top earners" ranked by USDT won**; players with no winnings sort to the bottom.
- The Levels board only includes players with `xp > 0`.

---

## 5. Leagues removed from the player UI

**Why.** With the leaderboard as the compete destination, the league /
season-pass screens were orphaned.

**What.** Removed the league screens; **missions was preserved** (still opened from
Home) and rehomed (back button → Home, nav highlight → Home).

**Files**
- Deleted `src/player/screens/compete.tsx`, `src/player/screens/leagues.tsx`.
- `src/player/state.tsx` — removed `pass` / `leagues` from `ScreenName` + `SCREEN_ORDER`.
- `src/player/page.tsx` — removed from screen registry + preloaders.
- `src/player/coachmarks.tsx` — removed `pass` / `leagues` tours; tidied leaderboard copy.
- `src/player/screens/missions.tsx` — back button → Home; nav highlight → Home.

**Left intact (dormant) — pending decision**
- `src/player/screens/league-result.tsx` — the seasonal promotion/demotion takeover still fires from `page.tsx` (now orphaned UX).
- Server-side league code: `accrueLeaguePoints` still runs during tournament scoring; `loadLeague` / `loadSeasonPass` / partner-offer endpoints + their now-unused client wrappers remain.

---

## Verification status

- **Lint/typecheck:** all changed files pass ESLint (0 errors) and `tsc --noEmit` (clean).
- **Not yet verified live:** onboarding pitch slide + welcome card, the new leaderboard (winnings / Levels), and the new-wallet onboarding→buy-sheet funnel.
- **Uncommitted:** all changes are in the working tree.
