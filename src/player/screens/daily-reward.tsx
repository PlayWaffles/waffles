"use client";

import { useEffect, useState } from "react";
import { syrupLabel, useProto } from "../state";
import { ASSETS, FlameIcon, PixelImg, Sheet, SyrupIcon } from "../shared";
import { playSound } from "../sound";
import { buyStreakFreeze, claimDaily } from "@/actions/player";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";

// Daily reward + streak. The single biggest retention lever for a no-push app
// is loss-aversion around a streak (returning users with a 7+ day streak are
// 2–3× more likely to keep coming back). This sheet:
//   • grants an escalating reward once per calendar day (expires at midnight),
//   • tracks a consecutive-day streak, broken by a missed day…
//   • …unless the player spends a Streak Freeze (bought with tickets),
//   • and points to the Telegram group for the daily reminder (no push needed).
//
// State persists in localStorage so it survives reloads; grants flow through
// the shared proto state so tickets/XP/streak stay in sync with the rest of
// the app.

// TODO: replace with the real Waffles Telegram group invite link.
export const TELEGRAM_GROUP_URL = "https://t.me/playwaffles";

const STORAGE_KEY = "waffles.v2.daily";
const STREAK_FREEZE_COST = 2;

type Roll = { type: "ticket" | "xp"; amount: number; rarity: "common" | "rare" | "jackpot" };

// Fixed 7-day reward calendar. The reward for a day is deterministic by its
// position in the repeating 7-day cycle, so the calendar a player sees is
// exactly what gets credited (the server mirrors this in economy.ts). Day 7 is
// the jackpot — the loss-aversion payoff for not missing a day all week.
const DAILY_SCHEDULE: Roll[] = [
  { type: "ticket", amount: 1, rarity: "common" },   // Day 1
  { type: "ticket", amount: 2, rarity: "common" },   // Day 2
  { type: "xp", amount: 25, rarity: "common" },      // Day 3
  { type: "ticket", amount: 3, rarity: "rare" },     // Day 4
  { type: "xp", amount: 50, rarity: "rare" },        // Day 5
  { type: "ticket", amount: 5, rarity: "rare" },     // Day 6
  { type: "ticket", amount: 10, rarity: "jackpot" }, // Day 7
];

/** The reward for the given (1-based) streak day — repeats every 7 days. */
const rewardForStreak = (streak: number): Roll =>
  DAILY_SCHEDULE[(Math.max(1, streak) - 1) % DAILY_SCHEDULE.length];

type DailyState = { lastClaim: string | null; streak: number; freezes: number };

const EMPTY: DailyState = { lastClaim: null, streak: 0, freezes: 0 };

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = (): string => dateKey(new Date());
const yesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

const readDaily = (): DailyState => {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<DailyState>) };
  } catch {
    /* storage disabled — treat as fresh */
  }
  return EMPTY;
};
const writeDaily = (s: DailyState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage disabled — fine, just won't persist */
  }
};

// Normalize for "today": if days were missed, a freeze saves the streak,
// otherwise it resets. Returns the resolved state + whether a reward is
// claimable right now.
const resolveToday = (s: DailyState): { state: DailyState; claimable: boolean } => {
  if (s.lastClaim === todayKey()) return { state: s, claimable: false };
  if (s.lastClaim === null || s.lastClaim === yesterdayKey()) return { state: s, claimable: true };
  if (s.freezes > 0) return { state: { ...s, freezes: s.freezes - 1 }, claimable: true };
  return { state: { ...s, streak: 0 }, claimable: true };
};

/** True if the player still has a daily reward to claim today. */
export const hasUnclaimedDailyReward = (): boolean => readDaily().lastClaim !== todayKey();

const RewardGlyph = ({ reward, size = 22 }: { reward: { type: "ticket" | "xp" }; size?: number }) =>
  reward.type === "ticket" ? <SyrupIcon size={size} /> : <PixelImg src={ASSETS.xpGem} size={size} alt="" />;

export const DailyRewardSheet = ({ onClose }: { onClose: () => void }) => {
  const proto = useProto();
  // Resolve once on open and capture the baseline so the calendar/claim cell
  // stay stable even after the streak increments on claim.
  const [resolved] = useState(() => resolveToday(readDaily()));
  const [freezes, setFreezes] = useState(resolved.state.freezes);
  const [claimed, setClaimed] = useState(!resolved.claimable);
  const [reward, setReward] = useState<Roll | null>(null);

  const baseStreak = resolved.state.streak;

  // Persist the normalized state (records a streak reset / freeze spend even if
  // the player closes without claiming) and reflect the streak app-wide.
  useEffect(() => {
    writeDaily(resolved.state);
    proto.update({ streak: resolved.state.streak });
    trackClientEvent(AnalyticsEvent.DailyRewardViewed, {
      screen: "daily_reward",
      streak_days: resolved.state.streak,
      claimable: resolved.claimable,
      freezes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClaim = async () => {
    if (claimed) {
      trackClientEvent(AnalyticsEvent.DailyRewardAlreadyClaimed, {
        screen: "daily_reward",
        streak_days: displayStreak,
      });
      return;
    }
    trackClientEvent(AnalyticsEvent.DailyRewardClaimStarted, {
      screen: "daily_reward",
      streak_days: baseStreak,
      freezes,
    });
    playSound("purchase");
    // Server is authoritative: it rolls + credits, so we display ITS roll (a
    // separate local roll would mismatch the credited reward). Falls back to a
    // local roll only in the preview / unauthenticated context.
    let server: Awaited<ReturnType<typeof claimDaily>>;
    try {
      server = await claimDaily();
    } catch (error) {
      trackClientEvent(AnalyticsEvent.DailyRewardClaimFailed, {
        screen: "daily_reward",
        reason: error instanceof Error ? error.message : "claim_failed",
      });
      return;
    }
    if (server) {
      if (server.claimed) {
        proto.update({ tickets: server.tickets, xp: server.xp, streak: server.streak });
        writeDaily({ lastClaim: todayKey(), streak: server.streak, freezes });
        setReward(server.roll);
        trackClientEvent(AnalyticsEvent.DailyRewardClaimSucceeded, {
          screen: "daily_reward",
          reward_type: server.roll.type,
          reward_amount: server.roll.amount,
          rarity: server.roll.rarity,
          streak_days: server.streak,
          used_freeze: server.usedFreeze,
          tickets_after: server.tickets,
          xp_after: server.xp,
        });
      } else {
        // already claimed today server-side — sync local + reflect claimed.
        writeDaily({ lastClaim: todayKey(), streak: baseStreak, freezes });
        trackClientEvent(AnalyticsEvent.DailyRewardAlreadyClaimed, {
          screen: "daily_reward",
          reason: server.reason,
          streak_days: baseStreak,
        });
      }
      setClaimed(true);
      return;
    }
    // Preview fallback (no auth): grant the next day's scheduled reward locally.
    const r = rewardForStreak(baseStreak + 1);
    if (r.type === "ticket") proto.update((s) => ({ tickets: s.tickets + r.amount }));
    else proto.update((s) => ({ xp: s.xp + r.amount }));
    const next: DailyState = { lastClaim: todayKey(), streak: baseStreak + 1, freezes };
    writeDaily(next);
    proto.update({ streak: next.streak });
    setReward(r);
    setClaimed(true);
    trackClientEvent(AnalyticsEvent.DailyRewardClaimSucceeded, {
      screen: "daily_reward",
      reward_type: r.type,
      reward_amount: r.amount,
      rarity: r.rarity,
      streak_days: next.streak,
      preview_mode: true,
    });
  };

  const buyFreeze = () => {
    if (proto.tickets < STREAK_FREEZE_COST) {
      trackClientEvent(AnalyticsEvent.StreakFreezePurchaseBlocked, {
        screen: "daily_reward",
        reason: "insufficient_tickets",
        tickets_balance: proto.tickets,
        price_tickets: STREAK_FREEZE_COST,
      });
      onClose();
      proto.goto("shop");
      return;
    }
    trackClientEvent(AnalyticsEvent.StreakFreezePurchaseStarted, {
      screen: "daily_reward",
      tickets_before: proto.tickets,
      price_tickets: STREAK_FREEZE_COST,
    });
    proto.update((s) => ({ tickets: s.tickets - STREAK_FREEZE_COST }));
    void buyStreakFreeze()
      .then((result) => {
        trackClientEvent(AnalyticsEvent.StreakFreezePurchaseSucceeded, {
          screen: "daily_reward",
          tickets_after: result?.tickets ?? proto.tickets - STREAK_FREEZE_COST,
          freezes_after: result?.freezes ?? freezes + 1,
          price_tickets: STREAK_FREEZE_COST,
        });
      })
      .catch((error) => {
        trackClientEvent(AnalyticsEvent.DailyRewardClaimFailed, {
          screen: "daily_reward",
          reason: error instanceof Error ? error.message : "streak_freeze_failed",
        });
      }); // persist the spend + freeze server-side
    const updated = freezes + 1;
    setFreezes(updated);
    writeDaily({ lastClaim: claimed ? todayKey() : readDaily().lastClaim, streak: claimed ? baseStreak + 1 : baseStreak, freezes: updated });
  };

  const displayStreak = claimed ? baseStreak + 1 : baseStreak;
  // 0-based position of TODAY's claim within the repeating 7-day cycle. Today's
  // claim makes the streak baseStreak+1, i.e. cycle day ((baseStreak+1)-1) % 7.
  const todayIdx = baseStreak % 7;

  return (
    <Sheet onClose={onClose} ariaLabel="Daily reward" zIndex={60}>
      {(close) => (
      <>
        {/* Header: streak */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
          <FlameIcon size={26} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: "var(--ink)" }}>
            {displayStreak}-day streak
          </span>
        </div>
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 16 }}>
          {claimed ? "Come back tomorrow to keep it going" : "Claim every day — Day 7 is the jackpot"}
        </div>

        {/* 7-day reward calendar — each day's reward is fixed; today is claimable,
            past days in this cycle are claimed, future days are locked. */}
        <div style={{ display: "flex", gap: 5, marginBottom: reward ? 10 : 16 }}>
          {DAILY_SCHEDULE.map((r, i) => {
            const isClaimed = i < todayIdx || (i === todayIdx && claimed);
            const isToday = i === todayIdx && !claimed;
            const isLocked = i > todayIdx;
            const isJackpot = r.rarity === "jackpot";
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: 0,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "8px 1px 7px",
                  borderRadius: 10,
                  background: isToday ? "var(--surface-2)" : "rgba(253,251,246,0.03)",
                  border: isToday
                    ? "2px solid var(--maple-500)"
                    : isJackpot && !isLocked
                      ? "1.5px solid rgba(255,201,49,.45)"
                      : "1.5px solid rgba(253,251,246,0.06)",
                  boxShadow: isToday
                    ? "0 0 16px rgba(255,201,49,.42)"
                    : isJackpot && !isLocked
                      ? "0 0 12px rgba(255,201,49,.28)"
                      : "none",
                  opacity: isLocked ? 0.5 : 1,
                  ...(isToday ? { animation: "waffles-v2-lvl-pop .4s cubic-bezier(0.34,1.56,0.64,1) both" } : {}),
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: 0.2,
                    textTransform: "uppercase",
                    color: isToday ? "var(--maple-500)" : isJackpot ? "var(--maple-500)" : "var(--ink-faint)",
                  }}
                >
                  {isJackpot ? `D7★` : `D${i + 1}`}
                </div>
                <RewardGlyph reward={r} size={18} />
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--ink)", lineHeight: 1 }}>
                  {r.amount}
                </div>
                {isClaimed && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 10,
                      background: "rgba(8,10,14,0.58)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ color: "var(--leaf)", fontFamily: "var(--font-hero)", fontWeight: 900, fontSize: 22 }}>✓</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Just-claimed confirmation */}
        {reward && (
          <div style={{ textAlign: "center", marginBottom: 14, fontFamily: "var(--font-display)", fontSize: 14, color: reward.rarity === "jackpot" ? "var(--maple-500)" : "var(--leaf)" }}>
            {reward.rarity === "jackpot" ? "★ JACKPOT · " : ""}+{reward.type === "xp" ? `${reward.amount} XP` : syrupLabel(reward.amount)} claimed
          </div>
        )}

        {/* Claim CTA */}
        <button
          type="button"
          className="cta maple"
          onClick={handleClaim}
          disabled={claimed}
          style={{ width: "100%", marginBottom: 10, opacity: claimed ? 0.55 : 1 }}
        >
          {claimed ? "COME BACK TOMORROW" : `CLAIM DAY ${todayIdx + 1}`}
        </button>

        {/* Streak freeze */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)", border: "1px solid rgba(253,251,246,0.06)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🧊</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--ink)" }}>Streak Freeze {freezes > 0 ? `· ${freezes}` : ""}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)" }}>Protects your streak if you miss a day</div>
          </div>
          <button
            type="button"
            className="pressable"
            onClick={buyFreeze}
            aria-label={`Buy a streak freeze for ${syrupLabel(STREAK_FREEZE_COST)}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--maple-500)", color: "var(--frame)", border: "2px solid var(--frame)", borderRadius: 10, padding: "7px 12px", fontFamily: "var(--font-body)", fontWeight: 900, fontSize: 12, boxShadow: "0 3px 0 var(--frame)", cursor: "pointer", flexShrink: 0 }}
          >
            <SyrupIcon size={14} />
            {STREAK_FREEZE_COST}
          </button>
        </div>

        {/* Telegram reminder — the no-push reminder channel */}
        <a
          href={TELEGRAM_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", background: "rgba(0,136,204,0.14)", border: "1px solid rgba(0,136,204,0.45)", borderRadius: 12, padding: "11px 12px", color: "#4fc3f7", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 13 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21.94 4.6 18.9 19.04c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.93.46l.33-4.72L18.4 6.1c.37-.33-.08-.51-.58-.18L6.97 13.06l-4.6-1.44c-1-.31-1.02-1 .21-1.48l17.96-6.92c.83-.31 1.56.2 1.4 1.38z" />
          </svg>
          Get daily reminders on Telegram
        </a>

        <button
          type="button"
          onClick={close}
          style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: "var(--ink-faint)", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 6 }}
        >
          {claimed ? "DONE" : "Maybe later"}
        </button>
      </>
      )}
    </Sheet>
  );
};
