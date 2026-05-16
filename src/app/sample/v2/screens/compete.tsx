"use client";

import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, TabBar, TopHeader } from "../shared";

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

const REWARD_PRESETS: { free: Reward; premium: Reward }[] = [
  { free: { type: "xp", label: "+50 XP" }, premium: { type: "ticket", label: "×2 Tickets" } },
  { free: { type: "ticket", label: "×1 Ticket" }, premium: { type: "cosmetic", label: "Frame" } },
  { free: { type: "xp", label: "+75 XP" }, premium: { type: "ticket", label: "×3 Tickets" } },
  { free: { type: "cosmetic", label: "Emote" }, premium: { type: "cosmetic", label: "Avatar" } },
];

const REWARD_PALETTE: Record<RewardType, { bg: string; fg: string; glyph: string }> = {
  xp:       { bg: "rgba(255, 201, 49, 0.10)", fg: "var(--maple-500)", glyph: "XP" },
  ticket:   { bg: "rgba(0, 207, 242, 0.10)",  fg: "var(--leaf)",      glyph: "🎟" },
  cosmetic: { bg: "rgba(251, 114, 255, 0.10)", fg: "var(--berry)",     glyph: "★" },
};

// One reward chip — keeps the reward visible in every state. Claimed cells
// get a small corner badge instead of a full overlay so the player can still
// see WHAT they earned, not just THAT they earned something.
const PassRewardCell = ({
  reward,
  state,
  premium,
}: {
  reward: Reward;
  state: "claimed" | "current" | "locked";
  premium?: boolean;
}) => {
  const palette = REWARD_PALETTE[reward.type];
  const isClaimed = state === "claimed";
  const isCurrent = state === "current";
  const isLocked = state === "locked";
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        height: 56,
        borderRadius: 12,
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
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "rgba(0, 0, 0, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Archivo Black",
          fontSize: 16,
          color: palette.fg,
          flexShrink: 0,
        }}
      >
        {palette.glyph}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: "Archivo Black",
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
            fontFamily: "Archivo Black",
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
            fontFamily: "Archivo Black",
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
          🔒
        </div>
      )}
    </div>
  );
};

export const CompeteScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;
  const passLevel = 7;
  const passXp = 340;
  const passXpNext = 500;
  const passPct = Math.min(100, Math.round((passXp / passXpNext) * 100));

  const ladder = [
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
  const currentIdx = 0;
  const score = 0;
  const safeZone = 6;
  const seasonEnd = "01d 17h";

  const track = Array.from({ length: 12 }, (_, i) => {
    const claimed = i < passLevel - 1;
    const current = i === passLevel - 1;
    return {
      level: i + 1,
      claimed,
      current,
      free: REWARD_PRESETS[i % REWARD_PRESETS.length].free,
      premium: REWARD_PRESETS[i % REWARD_PRESETS.length].premium,
    };
  });

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 340, background: "radial-gradient(ellipse at center top, rgba(251,114,255,.18), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240, backgroundImage: "radial-gradient(circle at 18% 35%, rgba(255,255,255,.35) 1px, transparent 1.5px), radial-gradient(circle at 72% 60%, rgba(255,255,255,.25) 1px, transparent 1.5px), radial-gradient(circle at 42% 85%, rgba(255,255,255,.2) 1px, transparent 1.5px), radial-gradient(circle at 88% 18%, rgba(255,255,255,.3) 1px, transparent 1.5px)", backgroundSize: "200px 200px", pointerEvents: "none" }} />

      <TopHeader tickets={tickets} title="COMPETE" />

      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 80, overflow: "auto", display: "flex", flexDirection: "column", scrollbarWidth: "none" }}>
        <div style={{ padding: "10px 14px 0", display: "flex", gap: 3, alignItems: "center", justifyContent: "center" }}>
          {ladder.map((t, i) => {
            const isCurrent = i === currentIdx;
            const locked = i > currentIdx;
            return <TierMedal key={t.key} color={t.color} size={isCurrent ? 34 : 22} state={isCurrent ? "current" : locked ? "locked" : "passed"} />;
          })}
        </div>

        <div style={{ padding: "12px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "Archivo Black", fontSize: 22, color: "#fff", letterSpacing: 0.5, lineHeight: 1 }}>{ladder[currentIdx].label}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.65)", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
              <span style={{ color: "#FFC931", display: "inline-flex", alignItems: "center", gap: 3 }}>🏆 {score}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>⏱ Ends in {seasonEnd}</span>
            </div>
          </div>
          <button onClick={() => proto.goto("leaderboard")} style={{ background: "#fff", color: "#1e1e1e", border: "none", padding: "9px 14px", borderRadius: 99, fontFamily: "Nunito", fontWeight: 800, fontSize: 13, letterSpacing: 0.1, boxShadow: "0 3px 0 rgba(0,0,0,.3)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>See ranking</button>
        </div>

        <div style={{ margin: "0 16px", background: "rgba(168,63,184,.65)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#fff" }}>
          <span style={{ fontFamily: "Archivo Black", fontSize: 12, color: "#00CFF2" }}>↓{safeZone}</span>
          <span>You are currently in the safe zone.</span>
        </div>

        <button onClick={() => proto.goto("missions")} style={{ margin: "12px 16px 0", background: "#0F0F10", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "auto" }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(180deg, rgba(255,201,49,.18), rgba(255,201,49,.06))", border: "1px solid rgba(255,201,49,.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M9 11.5l2 2 4-4M5 5h14a1 1 0 0 1 1 1v13l-4-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke="#FFC931" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,201,49,.1)" />
            </svg>
            <div style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 99, background: "#FC1919", color: "#fff", fontFamily: "Archivo Black", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>7</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#fff", letterSpacing: 0.4 }}>MISSIONS</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)", marginTop: 2 }}>3 daily · 4 partner offers</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,201,49,.12)", border: "1px solid rgba(255,201,49,.25)", color: "var(--maple-500)", padding: "3px 7px", borderRadius: 6, fontFamily: "var(--font-display)", fontSize: 11 }}>+675 XP</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </button>

        {/* Season Pass — header with title, countdown, and current tier. */}
        <div style={{ margin: "20px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "Archivo Black", fontSize: 20, color: "var(--ink)", letterSpacing: 1, lineHeight: 1 }}>SEASON PASS</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span>⏱</span> Ends in 4d 16h
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
            <div style={{ fontFamily: "Archivo Black", fontSize: 16, color: "var(--maple-500)", lineHeight: 1 }}>{passLevel}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>Tier</div>
          </div>
        </div>

        {/* Progress to next tier — clear horizontal bar with mission count. */}
        <div style={{ margin: "10px 16px 0", background: "var(--surface-1)", border: "1px solid rgba(253, 251, 246, 0.06)", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)" }}>Next tier in</span>
            <span style={{ fontFamily: "Archivo Black", fontSize: 11, color: "var(--ink)" }}>{passXp} / {passXpNext} XP</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: "rgba(253, 251, 246, 0.06)", overflow: "hidden" }}>
            <div style={{ width: `${passPct}%`, height: "100%", background: "linear-gradient(90deg, var(--berry), var(--maple-500))", borderRadius: 99 }} />
          </div>
        </div>

        {/* VIP upsell — full-width primary CTA so it doesn't fight with the
            progress bar for attention. The benefit copy makes the value clear
            instead of just labelling the button "ACTIVATE VIP". */}
        <button
          style={{
            margin: "10px 16px 0",
            background: "linear-gradient(180deg, var(--maple-500), var(--maple-400))",
            color: "var(--frame)",
            border: "2px solid var(--frame)",
            padding: "12px 14px",
            borderRadius: 14,
            fontFamily: "Nunito",
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
            <div style={{ fontFamily: "Archivo Black", fontSize: 14, lineHeight: 1, letterSpacing: 0.4 }}>UNLOCK VIP REWARDS</div>
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
          {track.slice(passLevel - 3, passLevel + 5).map((row, i, arr) => {
            const freeState: "claimed" | "current" | "locked" = row.claimed ? "claimed" : row.current ? "current" : "locked";
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
                      fontFamily: "Archivo Black",
                      fontSize: 12,
                      color: row.claimed || row.current ? "var(--frame)" : "var(--ink-faint)",
                      boxShadow: row.current ? "0 0 0 4px rgba(255, 201, 49, 0.20)" : undefined,
                    }}
                  >
                    {row.level}
                  </div>
                </div>
                <PassRewardCell reward={row.free} state={freeState} />
                <PassRewardCell reward={row.premium} state={premiumState} premium />
              </div>
            );
          })}
        </div>
      </div>

      <div className="bottom-bar">
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
