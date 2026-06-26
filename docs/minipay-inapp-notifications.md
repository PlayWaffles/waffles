# MiniPay in-app notifications — porting the Farcaster push templates

MiniPay has **no push channel**, so every Farcaster push template in
`src/lib/notifications/templates.ts` is invisible to MiniPay users. This maps each
one to an in-app equivalent: the **copy** plus **which announcement type** to use.

## The governing principle

An in-app notification only lands **when the user opens the app**. That changes
everything:

- **Countdowns are useless in-app.** "5 minutes left", "3 hours to go", "tickets
  in 5" assume a push interrupts you at that moment. In-app, the only thing that
  matters is what's true *right now*. So all 11 countdown/open variants collapse
  into **one state-driven card** that reflects the live round's current clock,
  spots, and pot.
- **"You missed it" has no place in-app.** Don't tell someone who just opened the
  app that they're too late — point them at the next round.
- **Per-moment social/live events** (friend joined, you got passed) only matter if
  the user is in-app *at that instant* → realtime toast, or a persisted inbox card.

## The five delivery types

| Type | Mechanism | Best for |
|---|---|---|
| **Auto-triggered card** | `computeTriggeredAnnouncements` (server, per-user, on load) | State/condition-driven re-engagement that should auto-appear and auto-resolve |
| **Realtime toast** | PartyKit → `AnnouncementToast` | Live, in-the-moment events while the user is in-app |
| **Authored** | admin `Announcement` row | One-off editorial/global news |
| **Targeted notification** | `AnnouncementRecipient` (`kind:"notification"`) | Persisted, per-user messages |
| **Modal** | `MODAL_ANNOUNCEMENTS` registry | Big one-time moments (welcome, season launch) |

## The mapping

### 1. The live round — ONE card replaces 11 templates
Collapses: `preGame.gameOpen`, `ticketOpen.nowOpen`, all `preGame.countdown24h/12h/3h/1h/5min`, all `ticketOpen.countdown3h/1h/30m/15m/5m`, `preGame.almostSoldOut`.

- **Type:** Auto-triggered card (banner), dynamic by clock + spots + pot.
- **Copy** (one card, three states):
  - Default: *"A round is live now — {pot} pot. Answer 6, outscore the room, split the pot."*
  - Low spots: *"Only {n} spots left in the live round — {pot} pot. Grab one before it fills."*
  - Closing soon: *"Live round closes in {m}m — {n} spots, {pot} pot. Last call."*
- **Why:** in-app, a single card reflecting the live state beats a stream of
  time-anchored pushes the user will never see at the right moment.
- **Resolves when:** the user has entered, or no round is live.

### 2. Pot boosted — `preGame.prizePoolBoost`
- **Type:** Realtime toast (fires live if the user is in-app) — and the pot already
  surfaces in the live-round card above, so no separate persistent card needed.
- **Copy:** *"The pot just jumped to {pot} — same {entry} entry."*

### 3. Sold out — `preGame.soldOut`
- **Type:** Reframe into the live-round card's "next round" state. Do **not** ship a
  standalone "you missed it" in-app.
- **Copy:** *"This round's full — the next one opens {time}. Be first in."*

### 4. Friend bought in — `preGame.friendJoined`
- **Type:** Realtime toast (live) or targeted notification (persists in the inbox).
- **Copy:** *"{friend} just bought into the live round. You in?"*
- **Note:** needs a friend graph; defer until that exists.

### 5. Passed on the leaderboard — `liveGame.flipped`, `liveGame.rivalryAlert`
- **Type:** Realtime toast — only meaningful while the user is in the live
  quiz/standings.
- **Copy:** *"{name} just passed you. Get back in there."* / *"{n} players just passed you — fight back."*

### 6. You won / top 3 — `postGame.winner`, `postGame.topFinish`
- **Type:** Auto-triggered card (already covered by the result return-modal +
  the unclaimed-prize card).
- **Copy:** *"#{rank} 🥇 You won {prize}. Tap to claim from your Prize Wallet."*

### 7. Results / round-wrap FOMO — `postGame.results`, `postGame.roundWrap`
- **Type:** Auto-triggered card. The near-miss card exists; add a FOMO recap for
  players who **skipped** the round.
- **Copy:** *"{prize} just went to the top 15 in {game}. The next round's live — don't sit this one out."*

### 8. Unclaimed prize — `postGame.unclaimed`
- **Type:** Auto-triggered card — **already implemented** (💰 `prize-unclaimed`).

### 9. Prize claimed — `postGame.claimed`
- **Type:** Inline confirmation / toast at claim time (not a feed card).
- **Copy:** *"{prize} sent to your wallet. See you next round."*

### 10. Ticket secured / recovered — `transactional.ticketSecured/ticketRecovered`
- **Type:** Inline confirmation / toast at the moment of purchase (not a feed card).
- **Copy:** *"You're in. The round's live — jump into the quiz."* / *"We restored a failed purchase — your ticket's back."*

### 11. Comeback (inactive) — `retention.comeback`
- **Type:** Auto-triggered card, computed from inactivity (approximate via last
  `GameEntry` / login until a `lastActiveAt` exists).
- **Copy:** *"Been a while — a round's live right now. Your seat won't save itself."*

### 12. Streak reminder — `retention.streakReminder`
- **Type:** Auto-triggered card, computed from streak + "hasn't played today".
- **Copy:** *"Your {n}-day streak is on the line. Play a level today to keep it."*

### 13. New quest — `growth.newQuest`
- **Type:** Auto-triggered card, or lean on the existing Missions unread badge.
- **Copy:** *"New mission: {title}. {desc}"*

### 14. Welcome — `onboarding.welcome`
- **Type:** Modal — onboarding already handles the welcome moment.
- **⚠ Stale copy:** the current template says *"Guess movie scenes…"* — that's v1.
  v2 isn't movie-themed; this line is wrong wherever it's still used.

## Implementation priority (the code gap)

The authored / targeted / modal types need no code (existing admin tooling +
registry). The **auto-triggered cards** are the gap. In value order:

1. **Live round card** (#1) — the flagship; replaces the entire countdown family.
2. **Streak reminder** (#12) and **Comeback** (#11) — cheap, high-retention.
3. **Round-wrap FOMO** (#7) for skippers.
4. **Realtime toasts** (#2, #4, #5) — need server emit points.

All triggered cards live in `computeTriggeredAnnouncements`
(`src/lib/player/announcements.ts`), exactly where `prize-unclaimed` and the
near-miss card already are.
