"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useProto } from "../state";
import { ASSETS, AssetWell, Phone, PixelImg, SyrupIcon, TabBar, TopHeader } from "../shared";
import { loadLeague, loadSeasonPass, claimSeasonReward, loadMissions, loadPartnerOffers } from "@/player/api";
import type { League } from "@/lib/player/leagues";
import type { SeasonPass } from "@/lib/player/seasonPass";
import { SEASON_PASS_TIERS, type SeasonReward as PassReward } from "@/lib/player/seasonPassTiers";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";

const TierMedal = ({ color = "#cd7f32", size = 28, state = "passed" }: { color?: string; size?: number; state?: "current" | "locked" | "passed" }) => {
  const dim = state === "locked" ? 0.35 : 1;
  const ring = state === "current" ? "#fff" : "rgba(255,255,255,.2)";
  const showGlyph = size >= 34;
  return (
    <div style={{ width: size, height: size, borderRadius: 99, background: `radial-gradient(circle at 35% 30%, ${color}, ${color}88 70%)`, border: `2px solid ${ring}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", opacity: dim, boxShadow: state === "current" ? `0 0 0 4px ${color}33, inset 0 -2px 4px rgba(0,0,0,.2)` : "inset 0 -1px 3px rgba(0,0,0,.25)", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)", width: size * 0.22, height: 5, background: color, borderRadius: "2px 2px 0 0", border: "1px solid rgba(0,0,0,.3)", borderBottom: "none" }} />
      <div style={{ position: "absolute", inset: Math.max(2, size * 0.12), borderRadius: 99, border: "1px solid rgba(255,255,255,.25)" }} />
      {showGlyph && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" style={{ position: "relative" }}>
          <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" fill="rgba(0,0,0,.4)" stroke="rgba(0,0,0,.55)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6" stroke="rgba(0,0,0,.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      )}
      {state === "locked" && size < 34 && <div style={{ width: size * 0.45, height: size * 0.45, borderRadius: 99, background: "rgba(0,0,0,.25)" }} />}
    </div>
  );
};

type RewardType = "xp" | "ticket" | "cosmetic";
type Reward = { type: RewardType; label: string };

const REWARD_PALETTE: Record<RewardType, { bg: string; fg: string }> = {
  xp:       { bg: "rgba(255, 201, 49, 0.10)", fg: "var(--maple-500)" },
  ticket:   { bg: "rgba(0, 207, 242, 0.10)",  fg: "var(--leaf)" },
  cosmetic: { bg: "rgba(251, 114, 255, 0.10)", fg: "var(--berry)" },
};

const RewardAsset = ({ reward }: { reward: Reward }) => {
  if (reward.type === "xp") {
    return <PixelImg src={ASSETS.xpGem} size={28} alt="" />;
  }
  if (reward.type === "ticket") {
    return <SyrupIcon size={24} />;
  }
  return <PixelImg src={ASSETS.vipStar} size={28} alt="" />;
};

// One reward chip — keeps the reward visible in every state. Claimed cells
// get a small corner badge instead of a full overlay so the player can still
// see WHAT they earned, not just THAT they earned something.
const PassRewardCell = ({
  reward,
  state,
  premium,
  onClick,
}: {
  reward: Reward;
  state: "claimed" | "current" | "locked";
  premium?: boolean;
  onClick?: () => void;
}) => {
  const palette = REWARD_PALETTE[reward.type];
  const isClaimed = state === "claimed";
  const isCurrent = state === "current";
  const isLocked = state === "locked";
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        flex: 1,
        minWidth: 0,
        height: 56,
        borderRadius: 12,
        cursor: onClick ? "pointer" : undefined,
        background: palette.bg,
        border: isCurrent
          ? `1.5px solid ${palette.fg}`
          : isClaimed
            ? `1px solid ${palette.fg}`
            : "1px solid rgba(253, 251, 246, 0.08)",
        boxShadow: isCurrent ? `0 0 0 3px ${palette.fg}20` : undefined,
        opacity: isLocked ? 0.45 : 1,
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
        color: "var(--ink)",
      }}
    >
      <AssetWell size={38} accent={palette.fg} radius={9}>
        <RewardAsset reward={reward} />
      </AssetWell>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 11,
            color: "var(--ink)",
            letterSpacing: 0.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {reward.label}
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ink-faint)", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {premium ? "VIP" : "Free"}
        </div>
      </div>
      {/* State badges — claimed (cyan check), current (maple "GET"), locked (lock).
          All sit in the corner so the reward art stays visible underneath. */}
      {isClaimed && (
        <div
          aria-label="Claimed"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 20,
            height: 20,
            borderRadius: 99,
            background: "var(--leaf)",
            color: "var(--frame)",
            fontFamily: "var(--font-display)",
            fontSize: 11,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 0 rgba(0, 0, 0, 0.4)",
          }}
        >
          ✓
        </div>
      )}
      {isCurrent && (
        <div
          aria-label="Available now"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            background: "var(--maple-500)",
            color: "var(--frame)",
            fontFamily: "var(--font-display)",
            fontSize: 9,
            padding: "2px 6px",
            borderRadius: 99,
            letterSpacing: 0.4,
            boxShadow: "0 2px 0 rgba(0, 0, 0, 0.4)",
          }}
        >
          GET
        </div>
      )}
      {isLocked && (
        <div
          aria-label="Locked"
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 14,
            height: 14,
            borderRadius: 99,
            background: "rgba(0, 0, 0, 0.55)",
            color: "var(--ink-soft)",
            fontSize: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PixelImg src={ASSETS.lock} size={12} alt="" style={{ filter: "none" }} />
        </div>
      )}
    </div>
  );
};

// "Coming soon" treatment — keeps the Season Pass design visible (so players see
// what's coming) but dims it and lays a non-interactive veil on top, matching the
// Shop's teaser pattern. Underlying claim buttons are inert so nothing can fire.
const ComingSoonVeil = ({ note, children }: { note: string; children: ReactNode }) => (
  <div style={{ position: "relative" }}>
    <div aria-hidden="true" inert style={{ opacity: 0.4, filter: "saturate(.55)", pointerEvents: "none", userSelect: "none" }}>
      {children}
    </div>
    <div
      onClick={() => trackClientEvent(AnalyticsEvent.ComingSoonClicked, { screen: "compete", feature: "season_pass", note })}
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 99, padding: "7px 14px", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 0.5, color: "#fff" }}>
        <span aria-hidden="true">🔒</span> Coming soon
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)", textAlign: "center", padding: "0 16px" }}>{note}</div>
    </div>
  </div>
);

export const CompeteScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  // Real league standing + season pass + mission/offer counts. Each falls back
  // to a sensible preview default before the server responds.
  const [league, setLeague] = useState<League | null>(null);
  const [pass, setPass] = useState<SeasonPass | null>(null);
  const [counts, setCounts] = useState<{ daily: number; partner: number; xp: number; open: number } | null>(null);
  const [localClaimed, setLocalClaimed] = useState<Set<number>>(new Set());
  const [claiming, setClaiming] = useState(false);
  useEffect(() => {
    let active = true;
    loadLeague().then((l) => { if (active && l) setLeague(l); }).catch(() => {});
    loadSeasonPass().then((p) => { if (active && p) setPass(p); }).catch(() => {});
    Promise.all([loadMissions(), loadPartnerOffers()])
      .then(([m, o]) => {
        if (!active || !m) return;
        setCounts({
          daily: m.length,
          partner: o?.length ?? 0,
          xp: m.reduce((s, x) => s + x.xp, 0),
          open: m.filter((x) => !x.done).length,
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // League ladder (DB tiers when available; otherwise the canonical 11-tier list).
  const ladder = league?.tiers?.length
    ? league.tiers.map((t) => ({ key: t.key, label: t.label, color: t.color }))
    : [
        { key: "apprentice1", label: "APPRENTICE I", color: "#cd7f32" },
        { key: "apprentice2", label: "APPRENTICE II", color: "#cd7f32" },
        { key: "silver1", label: "SILVER I", color: "#bfc7d0" },
        { key: "silver2", label: "SILVER II", color: "#bfc7d0" },
        { key: "silver3", label: "SILVER III", color: "#bfc7d0" },
        { key: "advanced1", label: "ADVANCED I", color: "#9aa6b3" },
        { key: "advanced2", label: "ADVANCED II", color: "#9aa6b3" },
        { key: "genius", label: "GENIUS", color: "#3ddbb8" },
        { key: "master3", label: "MASTER III", color: "#FFC931" },
        { key: "master2", label: "MASTER II", color: "#FFC931" },
        { key: "master1", label: "MASTER I", color: "#FFC931" },
      ];
  const currentIdx = Math.max(0, ladder.findIndex((t) => t.key === league?.key));
  const score = league?.points ?? 0;
  const safeZone = 6;
  const seasonEnd = league
    ? (() => {
        const ms = Math.max(0, league.seasonEndsAt - Date.now());
        const d = Math.floor(ms / 86_400_000);
        const h = Math.floor((ms % 86_400_000) / 3_600_000);
        return `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}h`;
      })()
    : "01d 17h";

  // Season pass progression — pass level + per-tier XP from the player's XP.
  const passLevel = pass?.level ?? 1;
  const passXpNext = pass?.xpPerTier ?? 500;
  const passXp = pass ? pass.xp % passXpNext : 340;
  const passPct = Math.min(100, Math.round((passXp / passXpNext) * 100));

  // Free-track reward cells claimed this season (server + optimistic local).
  const claimedFree = new Set<number>([
    ...((pass?.claimed ?? []).filter((c) => !c.premium).map((c) => c.tier)),
    ...localClaimed,
  ]);

  const claimFreeReward = async (level: number, reward: PassReward) => {
    if (claiming || claimedFree.has(level)) return;
    setClaiming(true);
    // Optimistic: mark claimed + credit locally; reconcile from the server result.
    setLocalClaimed((prev) => new Set(prev).add(level));
    if (reward.type === "ticket") proto.update((s) => ({ tickets: s.tickets + reward.amount }));
    else if (reward.type === "xp") proto.update((s) => ({ xp: s.xp + reward.amount }));
    flash(reward.type === "cosmetic" ? "Cosmetic unlocked!" : `Claimed ${reward.label}`);
    try {
      const res = await claimSeasonReward(level, false);
      if (res?.ok) {
        if (res.tickets != null) proto.update(() => ({ tickets: res.tickets! }));
        if (res.xp != null) proto.update(() => ({ xp: res.xp! }));
      } else if (res && !res.ok && res.reason === "already") {
        // server says already claimed — keep it marked, drop the toast noise.
      }
    } catch {
      /* offline / no session — keep the optimistic local claim */
    } finally {
      setClaiming(false);
    }
  };

  const track = SEASON_PASS_TIERS.map((t, i) => {
    const level = i + 1;
    return {
      level,
      claimed: level < passLevel,
      current: level === passLevel,
      reached: level <= passLevel,
      freeClaimed: claimedFree.has(level),
      free: t.free,
      premium: t.premium,
    };
  });

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 340, background: "radial-gradient(ellipse at center top, rgba(251,114,255,.18), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240, backgroundImage: "radial-gradient(circle at 18% 35%, rgba(255,255,255,.35) 1px, transparent 1.5px), radial-gradient(circle at 72% 60%, rgba(255,255,255,.25) 1px, transparent 1.5px), radial-gradient(circle at 42% 85%, rgba(255,255,255,.2) 1px, transparent 1.5px), radial-gradient(circle at 88% 18%, rgba(255,255,255,.3) 1px, transparent 1.5px)", backgroundSize: "200px 200px", pointerEvents: "none" }} />

      <TopHeader tickets={tickets} title="COMPETE" />

      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 80, overflow: "auto", display: "flex", flexDirection: "column", scrollbarWidth: "none" }}>
        <div data-coach="compete-ladder" style={{ padding: "10px 14px 0", display: "flex", gap: 3, alignItems: "center", justifyContent: "center" }}>
          {ladder.map((t, i) => {
            const isCurrent = i === currentIdx;
            const locked = i > currentIdx;
            return <TierMedal key={t.key} color={t.color} size={isCurrent ? 34 : 22} state={isCurrent ? "current" : locked ? "locked" : "passed"} />;
          })}
        </div>

        <div style={{ padding: "12px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#fff", letterSpacing: 0.5, lineHeight: 1 }}>{ladder[currentIdx].label}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.65)", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
              <span style={{ color: "#FFC931", display: "inline-flex", alignItems: "center", gap: 3 }}>🏆 {score}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>⏱ Ends in {seasonEnd}</span>
            </div>
          </div>
          <button onClick={() => { trackClientEvent(AnalyticsEvent.SeeRankingClicked, { screen: "compete" }); proto.goto("leaderboard"); }} style={{ background: "#fff", color: "#1e1e1e", border: "none", padding: "9px 14px", borderRadius: 99, fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 13, letterSpacing: 0.1, boxShadow: "0 3px 0 rgba(0,0,0,.3)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>See ranking</button>
        </div>

        <div style={{ margin: "0 16px", background: "rgba(168,63,184,.65)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#fff" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "#00CFF2" }}>↓{safeZone}</span>
          <span>You are currently in the safe zone.</span>
        </div>

        <button onClick={() => proto.goto("missions")} style={{ margin: "12px 16px 0", background: "#0F0F10", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "auto" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <AssetWell size={48} accent="var(--maple-500)" radius={12}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M9 11.5l2 2 4-4M5 5h14a1 1 0 0 1 1 1v13l-4-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke="#FFC931" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,201,49,.1)" />
              </svg>
            </AssetWell>
            <div style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 99, background: "#FC1919", color: "#fff", fontFamily: "var(--font-display)", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>{counts?.open ?? 7}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", letterSpacing: 0.4 }}>MISSIONS</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)", marginTop: 2 }}>{counts?.daily ?? 3} daily · {counts?.partner ?? 4} partner offers</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,201,49,.12)", border: "1px solid rgba(255,201,49,.25)", color: "var(--maple-500)", padding: "3px 7px", borderRadius: 6, fontFamily: "var(--font-display)", fontSize: 11 }}>+{counts?.xp ?? 675} XP</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </button>

        {/* Season Pass — coming soon. Design stays visible under a veil. */}
        <ComingSoonVeil note="Season Pass arrives soon — climb the tiers to earn rewards.">
        {/* Season Pass — header with title, countdown, and current tier. */}
        <div style={{ margin: "20px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)", letterSpacing: 1, lineHeight: 1 }}>SEASON PASS</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span>⏱</span> Ends in {seasonEnd}
            </div>
          </div>
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid rgba(253, 251, 246, 0.06)",
              borderRadius: 10,
              padding: "6px 10px",
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--maple-500)", lineHeight: 1 }}>{passLevel}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>Tier</div>
          </div>
        </div>

        {/* Progress to next tier — clear horizontal bar with mission count. */}
        <div style={{ margin: "10px 16px 0", background: "var(--surface-1)", border: "1px solid rgba(253, 251, 246, 0.06)", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)" }}>Next tier in</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--ink)" }}>{passXp} / {passXpNext} XP</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: "rgba(253, 251, 246, 0.06)", overflow: "hidden" }}>
            <div style={{ width: `${passPct}%`, height: "100%", background: "linear-gradient(90deg, var(--berry), var(--maple-500))", borderRadius: 99 }} />
          </div>
        </div>

        {/* VIP upsell — routes to the Shop where purchases actually happen. */}
        <button
          type="button"
          onClick={() => proto.goto("shop")}
          style={{
            margin: "10px 16px 0",
            background: "linear-gradient(180deg, var(--maple-500), var(--maple-400))",
            color: "var(--frame)",
            border: "2px solid var(--frame)",
            padding: "12px 14px",
            borderRadius: 14,
            fontFamily: "var(--font-body)",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 0.2,
            boxShadow: "0 4px 0 var(--frame)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            textAlign: "left",
          }}
        >
          <PixelImg src={ASSETS.vipStar} size={26} alt="" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, lineHeight: 1, letterSpacing: 0.4 }}>UNLOCK VIP REWARDS</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, opacity: 0.75 }}>Claim every premium reward this season</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        {/* Track headers — set the two-column expectation before the rows. */}
        <div style={{ margin: "16px 16px 6px", display: "grid", gridTemplateColumns: "32px 1fr 1fr", gap: 10, alignItems: "center" }}>
          <div />
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 0.6, textTransform: "uppercase" }}>Free</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 0.6, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            <PixelImg src={ASSETS.vipStar} size={11} alt="" /> VIP
          </div>
        </div>

        <div style={{ padding: "0 16px 16px" }}>
          {track.slice(Math.max(0, passLevel - 3), passLevel + 5).map((row, i, arr) => {
            // Claimed cells show as such; any reached-but-unclaimed free reward is
            // claimable ("current"); unreached tiers are locked.
            const freeState: "claimed" | "current" | "locked" = row.freeClaimed ? "claimed" : row.reached ? "current" : "locked";
            const premiumState: "claimed" | "current" | "locked" = row.current ? "current" : "locked";
            return (
              <div key={row.level} style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr", gap: 10, alignItems: "center", marginBottom: 10, position: "relative" }}>
                {/* Tier number column with connecting line. */}
                <div style={{ position: "relative", height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i > 0 && <div style={{ position: "absolute", top: 0, bottom: "50%", left: "50%", width: 2, background: "rgba(253, 251, 246, 0.10)", transform: "translateX(-50%)" }} />}
                  {i < arr.length - 1 && <div style={{ position: "absolute", top: "50%", bottom: 0, left: "50%", width: 2, background: "rgba(253, 251, 246, 0.10)", transform: "translateX(-50%)" }} />}
                  <div
                    style={{
                      position: "relative",
                      width: 28,
                      height: 28,
                      borderRadius: 99,
                      background: row.claimed
                        ? "var(--leaf)"
                        : row.current
                          ? "var(--maple-500)"
                          : "var(--surface-1)",
                      border: row.current
                        ? "2px solid var(--ink)"
                        : "1.5px solid rgba(253, 251, 246, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-display)",
                      fontSize: 12,
                      color: row.claimed || row.current ? "var(--frame)" : "var(--ink-faint)",
                      boxShadow: row.current ? "0 0 0 4px rgba(255, 201, 49, 0.20)" : undefined,
                    }}
                  >
                    {row.level}
                  </div>
                </div>
                <PassRewardCell
                  reward={row.free}
                  state={freeState}
                  onClick={row.reached && !row.freeClaimed ? () => claimFreeReward(row.level, row.free) : undefined}
                />
                <PassRewardCell
                  reward={row.premium}
                  state={premiumState}
                  premium
                  onClick={row.current ? () => proto.goto("shop") : undefined}
                />
              </div>
            );
          })}
        </div>
        </ComingSoonVeil>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 96,
            transform: "translateX(-50%)",
            zIndex: 120,
            background: "var(--surface-2)",
            color: "var(--ink)",
            border: "1px solid rgba(253, 251, 246, 0.14)",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.5)",
            maxWidth: 280,
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}

      <div className="bottom-bar">
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
