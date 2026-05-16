"use client";

import { useState } from "react";
import { useProto } from "../state";
import { ASSETS, InfoIcon, Phone, PixelImg, TabBar } from "../shared";

// Pre-generated medal art replaces the synthesized SVG medal.
const BigMedal = ({ size = 78 }: { color?: string; size?: number }) => (
  <PixelImg src={ASSETS.medalApprentice} size={size} alt="medal" />
);

const ChestGlyph = ({ rank }: { rank: number }) => {
  const src = rank <= 5 ? ASSETS.chestRainbow : rank <= 20 ? ASSETS.chestPurple : ASSETS.chestBrown;
  return <PixelImg src={src} size={22} alt="chest" />;
};

type Player = { rank: number; name: string; pts: number; color: string; avatar?: string; you?: boolean };

const AVATAR_BY_RANK = [
  ASSETS.avatarFox, ASSETS.avatarBear, ASSETS.avatarFrog, ASSETS.avatarPanda,
  ASSETS.avatarOwl, ASSETS.avatarCat, ASSETS.avatarDog, ASSETS.avatarRabbit,
];

const LeaderRow = ({ p }: { p: Player }) => {
  const av = p.you ? ASSETS.wally : AVATAR_BY_RANK[(p.rank - 1) % AVATAR_BY_RANK.length];
  // Top-3 ranks get the brand maple gold, everyone else uses the muted-ink ramp.
  const rankColor = p.rank === 1 ? "var(--maple-500)" : p.rank === 2 ? "#bfc7d0" : p.rank === 3 ? "#cd7f32" : "var(--ink-faint)";
  const ptsColor = p.you ? "var(--maple-500)" : "var(--ink)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 22px", color: "var(--ink)" }}>
      <div style={{ width: 28, fontFamily: "var(--font-display)", fontSize: 14, color: rankColor, textAlign: "center", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{p.rank}</div>
      <PixelImg src={av} size={44} alt="" />
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {!p.you && <ChestGlyph rank={p.rank} />}
        <PixelImg src={ASSETS.trophy} size={22} alt="" />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: ptsColor, fontVariantNumeric: "tabular-nums", minWidth: 38, textAlign: "right" }}>{p.pts.toLocaleString()}</span>
      </div>
    </div>
  );
};

export const LeaderboardScreen = () => {
  const proto = useProto();
  const [tab, setTab] = useState<"league" | "friends">("league");

  const leaders: Player[] = [
    { rank: 1, name: "wendy.maria.589", pts: 6543, color: "#FFC931", avatar: "photo" },
    { rank: 2, name: "alesandra.s.rodrigue", pts: 5150, color: "#a266ff" },
    { rank: 3, name: "spikeelmejor2026", pts: 5050, color: "#5db8ff" },
    { rank: 4, name: "mkt.design83", pts: 3000, color: "#7a4525" },
    { rank: 5, name: "lorennabarboza319", pts: 3000, color: "#1f9b8e" },
    { rank: 6, name: "edumh2103", pts: 1500, color: "#7a6147" },
    { rank: 7, name: "niharadd", pts: 1360, color: "#3dd17a" },
    { rank: 8, name: "nazlbr", pts: 1320, color: "#3dd17a" },
    { rank: 9, name: "zone.simple34", pts: 1050, color: "#e8d046" },
    { rank: 10, name: "mark.rivera", pts: 980, color: "#a266ff" },
    { rank: 11, name: "bk.pixels", pts: 920, color: "#5db8ff" },
    { rank: 12, name: "tim.h", pts: 880, color: "#3dd17a" },
  ];
  const you: Player = { rank: 40, name: "celestine.ejiofor", pts: 0, color: "#3dd17a", you: true };

  return (
    <Phone statusDark>
      {/* Match the rest of the v2 app: deep tinted-neutral surface with a
          warm gold glow at the top that echoes the results / level-up screens
          rather than the off-brand purple gradient that was here before. */}
      <div className="bg-deep" />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 280,
          background: "radial-gradient(ellipse at center top, rgba(255, 201, 49, 0.22), transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 280,
          backgroundImage:
            "radial-gradient(circle, #FFC931 2px, transparent 2.5px), radial-gradient(circle, #FB72FF 2px, transparent 2.5px), radial-gradient(circle, #00CFF2 2px, transparent 2.5px)",
          backgroundSize: "80px 80px, 100px 100px, 70px 70px",
          backgroundPosition: "0 0, 30px 40px, 50px 20px",
          opacity: 0.35,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--ink)", zIndex: 2 }}>
        <button aria-label="Back to Compete" onClick={() => proto.goto("pass", { back: true })} style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" aria-label="About leagues" onClick={() => proto.goto("leagues")} style={{ background: "rgba(253, 251, 246, 0.08)", border: "1.5px solid rgba(253, 251, 246, 0.25)", borderRadius: 99, width: 30, height: 30, padding: 0, cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}><InfoIcon size={16} /></button>
      </div>

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, textAlign: "center", color: "var(--ink)", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, filter: "drop-shadow(0 0 24px rgba(255, 201, 49, 0.35))" }}>
          <BigMedal color="#cd7f32" size={120} />
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 0.5 }}>APPRENTICE I</div>
        <div style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", marginTop: 4 }}>
          <span>⏱</span> Ends in 1d 15h
        </div>
      </div>

      <div style={{ position: "absolute", top: 280, left: 14, right: 14, bottom: 80, background: "var(--surface-1)", borderRadius: 18, border: "1px solid rgba(253, 251, 246, 0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid rgba(253, 251, 246, 0.08)", padding: "0 24px" }}>
          {[
            { id: "league" as const, label: "Your League" },
            { id: "friends" as const, label: "Friends" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "transparent", border: "none", padding: "14px 0 12px", fontFamily: "Nunito", fontSize: 15, fontWeight: tab === t.id ? 900 : 700, color: tab === t.id ? "var(--ink)" : "var(--ink-faint)", borderBottom: tab === t.id ? "2.5px solid var(--maple-500)" : "2.5px solid transparent", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "league" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px 10px", color: "var(--ink-soft)" }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>Position</span>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                Points
                <span aria-hidden="true" style={{ color: "var(--ink-faint)", display: "inline-flex" }}><InfoIcon size={14} /></span>
              </span>
            </div>
            <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>
              {leaders.map((p) => <LeaderRow key={p.rank} p={p} />)}
              {/* "You" row pinned to the bottom — uses the maple-tinted highlight
                  that the results screen uses for the player's row, so the two
                  leaderboards in the app share a visual language. */}
              <div style={{ position: "sticky", bottom: 0, background: "var(--maple-100)", borderTop: "1.5px solid var(--maple-500)" }}>
                <LeaderRow p={you} />
              </div>
            </div>
          </>
        ) : (
          // Friends tab — empty state with a clear CTA, instead of mirroring
          // the league list and leaving the user wondering whether the tab
          // even switched. Sets up a real product moment (invite friends).
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 99, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, border: "1px solid rgba(253, 251, 246, 0.08)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="9" cy="8" r="3.5" stroke="var(--ink-soft)" strokeWidth="2" fill="none" />
                <path d="M3 19c.8-3 3.2-5 6-5s5.2 2 6 5" stroke="var(--ink-soft)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <circle cx="17" cy="6" r="2.5" stroke="var(--maple-500)" strokeWidth="2" fill="none" />
                <path d="M14 14c.5-1.8 1.8-3 3-3s2.5 1.2 3 3" stroke="var(--maple-500)" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontFamily: "Archivo Black", fontSize: 18, color: "var(--ink)", letterSpacing: 0.4 }}>No friends yet</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.45, maxWidth: 260 }}>
              Add friends to see their scores next to yours and compete for bragging rights.
            </div>
            <button
              type="button"
              className="pressable"
              style={{
                marginTop: 22,
                background: "var(--maple-500)",
                color: "var(--frame)",
                border: "2px solid var(--frame)",
                fontFamily: "Nunito",
                fontWeight: 900,
                fontSize: 13,
                padding: "10px 20px",
                borderRadius: 12,
                letterSpacing: 0.3,
                boxShadow: "0 3px 0 var(--frame)",
                cursor: "pointer",
              }}
              onClick={() => {
                // No-op for prototype — inviting friends is out of scope.
              }}
            >
              INVITE FRIENDS
            </button>
          </div>
        )}
      </div>

      <div className="bottom-bar" style={{ paddingTop: 4, paddingBottom: 4, gap: 0 }}>
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
