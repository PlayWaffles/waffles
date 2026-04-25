"use client";

import { useState } from "react";
import { useProto } from "../state";
import { ASSETS, Phone, PixelImg } from "../shared";

// Pre-generated medal art replaces the synthesized SVG medal.
const BigMedal = ({ size = 78 }: { color?: string; size?: number }) => (
  <PixelImg src={ASSETS.medalApprentice} size={size} alt="medal" />
);

const ChestGlyph = ({ rank }: { rank: number }) => {
  const src = rank <= 5 ? ASSETS.chestRainbow : rank <= 20 ? ASSETS.chestPurple : ASSETS.chestBrown;
  return <PixelImg src={src} size={22} alt="chest" />;
};

type Player = { rank: number; name: string; pts: number; color: string; avatar?: string; you?: boolean };

const LeaderRow = ({ p }: { p: Player }) => {
  const initial = p.name[0].toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 22px", color: "#1e1e1e" }}>
      <div style={{ width: 30, height: 30, borderRadius: 99, border: p.you ? "2px solid #9ca3af" : "2px solid #3dd17a", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 13, color: "#1e1e1e", flexShrink: 0 }}>{p.rank}</div>
      {p.avatar === "photo" ? (
        <div style={{ width: 36, height: 36, borderRadius: 99, background: "radial-gradient(circle at 50% 35%, #f8c896 0%, #e09a6b 70%)", flexShrink: 0, position: "relative", overflow: "hidden", border: "1px solid rgba(0,0,0,.08)" }}>
          <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "40%", background: "#3a2820", borderRadius: "18px 18px 8px 8px" }} />
          <div style={{ position: "absolute", top: "48%", left: "25%", width: 3, height: 3, background: "#1e1e1e", borderRadius: 99 }} />
          <div style={{ position: "absolute", top: "48%", right: "25%", width: 3, height: 3, background: "#1e1e1e", borderRadius: 99 }} />
          <div style={{ position: "absolute", bottom: "25%", left: "35%", right: "35%", height: 2, borderBottom: "1.5px solid #1e1e1e", borderRadius: "0 0 6px 6px" }} />
        </div>
      ) : (
        <div style={{ width: 36, height: 36, borderRadius: 99, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Archivo Black", fontSize: 15, flexShrink: 0 }}>{initial}</div>
      )}
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "#1e1e1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        {!p.you && <ChestGlyph rank={p.rank} />}
        <PixelImg src={ASSETS.trophy} size={16} alt="" />
        <span style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#1e1e1e", fontVariantNumeric: "tabular-nums", minWidth: 34, textAlign: "right" }}>{p.pts.toLocaleString()}</span>
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
      <div style={{ position: "absolute", inset: 0, background: "#fff" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 230, background: "linear-gradient(180deg, #4d1f99 0%, #3a1a78 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 230, backgroundImage: "radial-gradient(circle at 18% 35%, rgba(255,255,255,.5) 1px, transparent 1.5px), radial-gradient(circle at 72% 60%, rgba(255,255,255,.4) 1px, transparent 1.5px), radial-gradient(circle at 42% 25%, rgba(255,255,255,.3) 1px, transparent 1.5px), radial-gradient(circle at 88% 18%, rgba(255,255,255,.45) 1px, transparent 1.5px), radial-gradient(circle at 30% 75%, rgba(255,255,255,.3) 1px, transparent 1.5px)", backgroundSize: "200px 200px", pointerEvents: "none" }} />

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff" }}>
        <button onClick={() => proto.goto("pass", { back: true })} style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => proto.goto("leagues")} style={{ background: "rgba(255,255,255,.1)", border: "1.5px solid rgba(255,255,255,.4)", borderRadius: 99, width: 30, height: 30, padding: 0, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 13 }}>i</button>
      </div>

      <div style={{ position: "absolute", top: 78, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <BigMedal color="#cd7f32" size={70} />
        </div>
        <div style={{ fontFamily: "Archivo Black", fontSize: 22, letterSpacing: 0.5 }}>APPRENTICE I</div>
        <div style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.85)", marginTop: 4 }}>
          <span>⏱</span> Ends in 1d 15h
        </div>
      </div>

      <div style={{ position: "absolute", top: 240, left: 0, right: 0, bottom: 0, background: "#fff", borderRadius: "18px 18px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", padding: "0 24px" }}>
          {[
            { id: "league" as const, label: "Your League" },
            { id: "friends" as const, label: "Friends" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "transparent", border: "none", padding: "14px 0 12px", fontFamily: "Nunito", fontSize: 15, fontWeight: tab === t.id ? 900 : 700, color: tab === t.id ? "#1e1e1e" : "#9ca3af", borderBottom: tab === t.id ? "2.5px solid #1e1e1e" : "2.5px solid transparent", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px 10px", color: "#1e1e1e" }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Position</span>
          <span style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 5 }}>
            Points
            <span style={{ width: 16, height: 16, borderRadius: 99, border: "1.5px solid #9ca3af", color: "#9ca3af", fontSize: 10, fontFamily: "Archivo Black", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>i</span>
          </span>
        </div>

        <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>
          {leaders.map((p) => <LeaderRow key={p.rank} p={p} />)}
          <div style={{ position: "sticky", bottom: 0, background: "#f4eaff", borderTop: "1px solid #e5d4f8" }}>
            <LeaderRow p={you} />
          </div>
        </div>
      </div>
    </Phone>
  );
};
