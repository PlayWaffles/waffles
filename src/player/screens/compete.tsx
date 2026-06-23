"use client";

import { useEffect, useState } from "react";
import { useProto } from "../state";
import { AssetWell, Phone, TabBar, TopHeader, useNow } from "../shared";
import { loadLeague, loadMissions, loadPartnerOffers } from "@/player/api";
import type { League } from "@/lib/player/leagues";
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

export const CompeteScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;

  // Real league standing + mission/offer counts. (Season Pass is temporarily
  // removed — the seasonPass service is kept intact for when it returns.)
  const [league, setLeague] = useState<League | null>(null);
  const [counts, setCounts] = useState<{ daily: number; partner: number; xp: number; open: number } | null>(null);
  const now = useNow(!!league, 60_000);
  useEffect(() => {
    let active = true;
    loadLeague().then((l) => { if (active && l) setLeague(l); }).catch(() => {});
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

  const ladder = league?.tiers?.length
    ? league.tiers.map((t) => ({ key: t.key, label: t.label, color: t.color }))
    : [];
  const currentIdx = league ? Math.max(0, ladder.findIndex((t) => t.key === league.key)) : -1;
  const currentTier = currentIdx >= 0 ? ladder[currentIdx] : null;
  const score = league?.points;
  const safeZone = 6;
  const seasonEnd = league
    ? (() => {
        const ms = Math.max(0, league.seasonEndsAt - now);
        const d = Math.floor(ms / 86_400_000);
        const h = Math.floor((ms % 86_400_000) / 3_600_000);
        return `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}h`;
      })()
    : "Loading";

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 340, background: "radial-gradient(ellipse at center top, rgba(251,114,255,.18), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240, backgroundImage: "radial-gradient(circle at 18% 35%, rgba(255,255,255,.35) 1px, transparent 1.5px), radial-gradient(circle at 72% 60%, rgba(255,255,255,.25) 1px, transparent 1.5px), radial-gradient(circle at 42% 85%, rgba(255,255,255,.2) 1px, transparent 1.5px), radial-gradient(circle at 88% 18%, rgba(255,255,255,.3) 1px, transparent 1.5px)", backgroundSize: "200px 200px", pointerEvents: "none" }} />

      <TopHeader tickets={tickets} title="COMPETE" />

      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 80, overflow: "auto", display: "flex", flexDirection: "column", scrollbarWidth: "none" }}>
        <div data-coach="compete-ladder" style={{ padding: "10px 14px 0", display: "flex", gap: 3, alignItems: "center", justifyContent: "center" }}>
          {ladder.length ? ladder.map((t, i) => {
            const isCurrent = i === currentIdx;
            const locked = i > currentIdx;
            return <TierMedal key={t.key} color={t.color} size={isCurrent ? 34 : 22} state={isCurrent ? "current" : locked ? "locked" : "passed"} />;
          }) : <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.55)", padding: "8px 0" }}>Loading league...</div>}
        </div>

        <div style={{ padding: "12px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#fff", letterSpacing: 0.5, lineHeight: 1 }}>{currentTier?.label ?? "Loading league"}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.65)", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
              <span style={{ color: "#FFD24D", display: "inline-flex", alignItems: "center", gap: 3 }}>🏆 {score ?? "—"}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>⏱ Ends in {seasonEnd}</span>
            </div>
          </div>
          <button onClick={() => { trackClientEvent(AnalyticsEvent.SeeRankingClicked, { screen: "compete" }); proto.goto("leaderboard"); }} style={{ background: "#fff", color: "#1e1e1e", border: "none", padding: "9px 14px", borderRadius: 99, fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 13, letterSpacing: 0.1, boxShadow: "0 3px 0 rgba(0,0,0,.3)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>See ranking</button>
        </div>

        <div style={{ margin: "0 16px", background: "rgba(168,63,184,.65)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#fff" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "#FF9F1C" }}>↓{safeZone}</span>
          <span>You are currently in the safe zone.</span>
        </div>

        <button onClick={() => proto.goto("missions")} style={{ margin: "12px 16px 0", background: "#0F0F10", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "auto" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <AssetWell size={48} accent="var(--maple-500)" radius={12}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M9 11.5l2 2 4-4M5 5h14a1 1 0 0 1 1 1v13l-4-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke="#FFD24D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,210,77,.1)" />
              </svg>
            </AssetWell>
            <div style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 99, background: "#FC1919", color: "#fff", fontFamily: "var(--font-display)", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>{counts?.open ?? "…"}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", letterSpacing: 0.4 }}>MISSIONS</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)", marginTop: 2 }}>{counts ? `${counts.daily} daily · ${counts.partner} partner offers` : "Loading missions"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,210,77,.12)", border: "1px solid rgba(255,210,77,.25)", color: "var(--maple-500)", padding: "3px 7px", borderRadius: 6, fontFamily: "var(--font-display)", fontSize: 11 }}>{counts ? `+${counts.xp} XP` : "—"}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </button>
      </div>

      <div className="bottom-bar">
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
