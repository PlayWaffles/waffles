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

const REWARD_PRESETS: { free: { type: "xp" | "ticket" | "cosmetic"; label: string }; premium: { type: "xp" | "ticket" | "cosmetic"; label: string } }[] = [
  { free: { type: "xp", label: "+50" }, premium: { type: "ticket", label: "×2" } },
  { free: { type: "ticket", label: "×1" }, premium: { type: "cosmetic", label: "Frame" } },
  { free: { type: "xp", label: "+75" }, premium: { type: "ticket", label: "×3" } },
  { free: { type: "cosmetic", label: "Emote" }, premium: { type: "cosmetic", label: "Avatar" } },
];

const PassRewardCell = ({ type, label, claimed, current, locked }: { type: "xp" | "ticket" | "cosmetic"; label: string; claimed: boolean; current: boolean; locked: boolean }) => {
  const styles =
    type === "xp"
      ? { bg: "#1a1a1c", fg: "#FFC931", glyph: "XP" }
      : type === "ticket"
      ? { bg: "rgba(255,201,49,.12)", fg: "#FFC931", glyph: "🎟" }
      : { bg: "rgba(251,114,255,.12)", fg: "#FB72FF", glyph: "★" };

  const dim = !claimed && !current;
  const showLock = locked && !claimed;

  return (
    <div style={{ width: 54, height: 54, borderRadius: 10, background: styles.bg, border: claimed ? `1.5px solid ${styles.fg}` : `1px solid ${styles.fg}40`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, color: styles.fg, opacity: dim ? 0.55 : 1, position: "relative", boxShadow: current ? `0 0 0 2px ${styles.fg}30` : "none" }}>
      <div style={{ fontFamily: "Archivo Black", fontSize: 14, lineHeight: 1 }}>{styles.glyph}</div>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.3 }}>{label}</div>
      {showLock && <div style={{ position: "absolute", top: 3, right: 3, width: 12, height: 12, borderRadius: 99, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>🔒</div>}
      {claimed && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,207,242,.12)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 22, height: 22, borderRadius: 99, background: "#00CFF2", color: "#1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 13 }}>✓</div>
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
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #000 100%)" }} />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 340, background: "radial-gradient(ellipse at center top, rgba(251,114,255,.18), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 60, left: 0, right: 0, height: 240, backgroundImage: "radial-gradient(circle at 18% 35%, rgba(255,255,255,.35) 1px, transparent 1.5px), radial-gradient(circle at 72% 60%, rgba(255,255,255,.25) 1px, transparent 1.5px), radial-gradient(circle at 42% 85%, rgba(255,255,255,.2) 1px, transparent 1.5px), radial-gradient(circle at 88% 18%, rgba(255,255,255,.3) 1px, transparent 1.5px)", backgroundSize: "200px 200px", pointerEvents: "none" }} />

      <TopHeader tickets={tickets} title="COMPETE" />

      <div style={{ position: "absolute", top: 60, left: 0, right: 0, bottom: 80, overflow: "auto", display: "flex", flexDirection: "column", scrollbarWidth: "none" }}>
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,201,49,.12)", border: "1px solid rgba(255,201,49,.25)", color: "#FFC931", padding: "3px 7px", borderRadius: 6, fontFamily: "Archivo Black", fontSize: 10 }}>+675 <PixelImg src={ASSETS.trophy} size={12} alt="" /></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </button>

        <div style={{ textAlign: "center", marginTop: 16, marginBottom: 6 }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 22, color: "#fff", letterSpacing: 1.2 }}>SEASON PASS</div>
          <div style={{ display: "inline-flex", gap: 6, alignItems: "center", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.7)", marginTop: 4 }}>
            <span>⏱</span> Ends in 4d 16h
          </div>
        </div>

        <div style={{ margin: "10px 16px 8px", display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ flex: "0 0 auto", background: "linear-gradient(180deg, #FFC931, #F5BB1B)", color: "#1e1e1e", border: "none", padding: "10px 14px", borderRadius: 12, fontFamily: "Archivo Black", fontSize: 13, letterSpacing: 0.3, boxShadow: "0 3px 0 #1e1e1e", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <PixelImg src={ASSETS.vipStar} size={16} alt="" /> ACTIVATE VIP
          </button>
          <div style={{ flex: 1, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 99, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 99, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
              <div style={{ width: `${passPct}%`, height: "100%", background: "linear-gradient(90deg, #FB72FF, #FFC931)" }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.7)", fontFamily: "Archivo Black", whiteSpace: "nowrap" }}>0/1 mission</span>
            <div style={{ width: 22, height: 22, borderRadius: 99, background: "#00CFF2", color: "#1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 11, flexShrink: 0 }}>1</div>
          </div>
        </div>

        <div style={{ padding: "8px 16px 16px" }}>
          {track.slice(0, 5).map((row) => (
            <div key={row.level} style={{ display: "grid", gridTemplateColumns: "1fr 32px 1fr", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <PassRewardCell {...row.free} claimed={row.claimed} current={row.current} locked={!row.claimed && !row.current} />
              <div style={{ position: "relative", height: 54, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {row.level > 1 && <div style={{ position: "absolute", top: 0, bottom: "50%", left: "50%", width: 2, background: "rgba(255,255,255,.12)", transform: "translateX(-50%)" }} />}
                {row.level < 5 && <div style={{ position: "absolute", top: "50%", bottom: 0, left: "50%", width: 2, background: "rgba(255,255,255,.12)", transform: "translateX(-50%)" }} />}
                <div style={{ position: "relative", width: 30, height: 30, borderRadius: 99, background: row.claimed ? "#00CFF2" : row.current ? "#FFC931" : "rgba(15,15,16,1)", border: row.current ? "2px solid #fff" : "1.5px solid rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 13, color: row.claimed || row.current ? "#1e1e1e" : "rgba(255,255,255,.5)", boxShadow: row.current ? "0 0 0 4px rgba(255,201,49,.25)" : "none" }}>
                  {row.claimed ? "✓" : row.level - 1}
                </div>
              </div>
              <PassRewardCell {...row.premium} claimed={false} current={row.current} locked />
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0F0F10", padding: "8px 0 6px", borderTop: "2px solid rgba(255,255,255,.08)" }}>
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
