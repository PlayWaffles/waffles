"use client";

import { useEffect, useState } from "react";
import { useProto } from "../state";
import { ASSETS, FlameIcon, PixelImg, Sheet, TicketIcon } from "../shared";
import { playSound } from "../sound";
import { v2BuyStreakFreeze, v2ClaimDaily } from "@/actions/v2";

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

// Variable reward pool (Hooked: variable rewards form habits faster than a
// fixed schedule). A weighted roll on claim — the streak tilts the odds toward
// the rarer prizes, so the loss-aversion of the streak still escalates value.
const REWARD_POOL: { roll: Roll; weight: number }[] = [
  { roll: { type: "xp", amount: 25, rarity: "common" }, weight: 26 },
  { roll: { type: "ticket", amount: 1, rarity: "common" }, weight: 26 },
  { roll: { type: "xp", amount: 50, rarity: "common" }, weight: 16 },
  { roll: { type: "ticket", amount: 2, rarity: "rare" }, weight: 14 },
  { roll: { type: "xp", amount: 100, rarity: "rare" }, weight: 8 },
  { roll: { type: "ticket", amount: 5, rarity: "jackpot" }, weight: 3 },
  { roll: { type: "ticket", amount: 10, rarity: "jackpot" }, weight: 1 },
];

// Longer streaks boost the rare/jackpot weights (caps out around day 30).
function rollReward(streak: number): Roll {
  const boost = 1 + Math.min(streak, 30) / 15; // 1× → 3×
  const weighted = REWARD_POOL.map((e) => ({
    roll: e.roll,
    w: e.roll.rarity === "common" ? e.weight : e.weight * boost,
  }));
  const total = weighted.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of weighted) {
    if ((r -= e.w) <= 0) return e.roll;
  }
  return weighted[0].roll;
}

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
  reward.type === "ticket" ? <TicketIcon size={size} /> : <PixelImg src={ASSETS.xpGem} size={size} alt="" />;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClaim = async () => {
    if (claimed) return;
    playSound("purchase");
    // Server is authoritative: it rolls + credits, so we display ITS roll (a
    // separate local roll would mismatch the credited reward). Falls back to a
    // local roll only in the preview / unauthenticated context.
    const server = await v2ClaimDaily();
    if (server) {
      if (server.claimed) {
        proto.update({ tickets: server.tickets, xp: server.xp, streak: server.streak });
        writeDaily({ lastClaim: todayKey(), streak: server.streak, freezes });
        setReward(server.roll);
      } else {
        // already claimed today server-side — sync local + reflect claimed.
        writeDaily({ lastClaim: todayKey(), streak: baseStreak, freezes });
      }
      setClaimed(true);
      return;
    }
    // Preview fallback (no auth): roll + credit locally.
    const r = rollReward(baseStreak);
    if (r.type === "ticket") proto.update((s) => ({ tickets: s.tickets + r.amount }));
    else proto.update((s) => ({ xp: s.xp + r.amount }));
    const next: DailyState = { lastClaim: todayKey(), streak: baseStreak + 1, freezes };
    writeDaily(next);
    proto.update({ streak: next.streak });
    setReward(r);
    setClaimed(true);
  };

  const buyFreeze = () => {
    if (proto.tickets < STREAK_FREEZE_COST) {
      onClose();
      proto.goto("shop");
      return;
    }
    proto.update((s) => ({ tickets: s.tickets - STREAK_FREEZE_COST }));
    void v2BuyStreakFreeze(); // persist the spend + freeze server-side
    const updated = freezes + 1;
    setFreezes(updated);
    writeDaily({ lastClaim: claimed ? todayKey() : readDaily().lastClaim, streak: claimed ? baseStreak + 1 : baseStreak, freezes: updated });
  };

  const displayStreak = claimed ? baseStreak + 1 : baseStreak;

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
          {claimed ? "Come back tomorrow to keep it going" : "Open your mystery box — longer streaks, better odds"}
        </div>

        {/* Mystery box — variable reward, revealed on open */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div
            style={{
              position: "relative",
              width: 132,
              height: 132,
              borderRadius: 22,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "0 8px",
              textAlign: "center",
              ...(reward
                ? {
                    background: "var(--surface-2)",
                    border: `2px solid ${reward.rarity === "jackpot" ? "var(--maple-500)" : reward.rarity === "rare" ? "var(--leaf)" : "rgba(253,251,246,0.15)"}`,
                    boxShadow:
                      reward.rarity === "jackpot"
                        ? "0 0 34px rgba(255,201,49,0.55)"
                        : reward.rarity === "rare"
                          ? "0 0 26px rgba(0,207,242,0.45)"
                          : "none",
                    animation: "waffles-v2-lvl-pop .5s cubic-bezier(0.34,1.56,0.64,1) both",
                  }
                : {
                    background: "linear-gradient(180deg, var(--maple-500), var(--maple-400))",
                    border: "2px solid var(--frame)",
                    boxShadow: "0 5px 0 var(--frame)",
                  }),
            }}
          >
            {reward ? (
              <>
                <RewardGlyph reward={reward} size={44} />
                <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 20, color: "var(--ink)", lineHeight: 1 }}>
                  +{reward.amount} {reward.type === "xp" ? "XP" : reward.amount === 1 ? "ticket" : "tickets"}
                </div>
                {reward.rarity !== "common" && (
                  <div
                    className="chip"
                    style={{
                      fontSize: 9,
                      padding: "2px 8px",
                      background: reward.rarity === "jackpot" ? "rgba(255,201,49,.2)" : "rgba(0,207,242,.16)",
                      color: reward.rarity === "jackpot" ? "var(--maple-500)" : "var(--leaf)",
                      border: `1px solid ${reward.rarity === "jackpot" ? "rgba(255,201,49,.45)" : "rgba(0,207,242,.4)"}`,
                    }}
                  >
                    {reward.rarity === "jackpot" ? "★ JACKPOT" : "RARE"}
                  </div>
                )}
              </>
            ) : (
              <span style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: claimed ? 44 : 64, color: "var(--frame)" }}>
                {claimed ? "✓" : "?"}
              </span>
            )}
          </div>
        </div>

        {/* Open / claim CTA */}
        <button
          type="button"
          className="cta maple"
          onClick={handleClaim}
          disabled={claimed}
          style={{ width: "100%", marginBottom: 10, opacity: claimed ? 0.55 : 1 }}
        >
          {claimed ? "COME BACK TOMORROW" : "OPEN TODAY'S REWARD"}
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
            aria-label={`Buy a streak freeze for ${STREAK_FREEZE_COST} tickets`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--maple-500)", color: "var(--frame)", border: "2px solid var(--frame)", borderRadius: 10, padding: "7px 12px", fontFamily: "var(--font-body)", fontWeight: 900, fontSize: 12, boxShadow: "0 3px 0 var(--frame)", cursor: "pointer", flexShrink: 0 }}
          >
            <TicketIcon size={14} />
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
