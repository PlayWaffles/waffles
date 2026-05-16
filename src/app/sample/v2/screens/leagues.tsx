"use client";

import type { ReactNode } from "react";
import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, TabBar } from "../shared";

const TIERS = [
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

// Map TIERS color → generated medal asset, falling back to apprentice if unmatched.
const MEDAL_BY_COLOR: Record<string, string> = {
  "#cd7f32": ASSETS.medalApprentice,
  "#bfc7d0": ASSETS.medalSilver,
  "#9aa6b3": ASSETS.medalAdvanced,
  "#3ddbb8": ASSETS.medalGenius,
  "#FFC931": ASSETS.medalMaster,
};
const BigMedal = ({ color = "#cd7f32", size = 78 }: { color?: string; size?: number }) => (
  <PixelImg src={MEDAL_BY_COLOR[color] ?? ASSETS.medalApprentice} size={size} alt="medal" />
);

const Pill = ({ icon, color, value }: { icon: ReactNode; color: string; value: number }) => (
  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "var(--surface-2)", border: "1px solid rgba(253, 251, 246, 0.06)", borderRadius: 99, padding: "5px 8px", fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>
    <span style={{ color, fontSize: 14 }}>{icon}</span>
    <span style={{ fontFamily: "Archivo Black", fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString()}</span>
  </div>
);

const RewardChest = ({ variant, idx }: { variant: "rainbow" | "purple" | "brown"; idx: number }) => {
  const labels = ["1°", "2°-5°", "6°-20°"];
  const src = variant === "rainbow" ? ASSETS.chestRainbow : variant === "purple" ? ASSETS.chestPurple : ASSETS.chestBrown;
  return (
    <div style={{ width: 42, position: "relative", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <PixelImg src={src} size={32} alt={`${variant} chest`} />
      <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ink-soft)", marginTop: 1, fontStyle: "italic" }}>{labels[idx]}</div>
    </div>
  );
};

type Tier = (typeof TIERS)[number] & {
  current?: boolean;
  rewards: { r: "rainbow" | "purple" | "brown"; n: number | null; t: number; c: number }[];
};

const LeagueCard = ({ tier }: { tier: Tier }) => {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        borderRadius: 14,
        marginBottom: 14,
        overflow: "hidden",
        boxShadow: "0 4px 0 rgba(0, 0, 0, 0.25)",
        border: tier.current ? "2px solid var(--maple-500)" : "1px solid rgba(253, 251, 246, 0.06)",
        position: "relative",
      }}
    >
      <div style={{ height: 36, background: tier.color, position: "relative" }}>
        {tier.current && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: -2,
              background: "var(--maple-500)",
              color: "var(--frame)",
              padding: "4px 10px",
              borderRadius: "0 6px 6px 0",
              fontSize: 11,
              fontWeight: 800,
              fontFamily: "Nunito",
              boxShadow: "0 2px 0 rgba(0, 0, 0, 0.3)",
            }}
          >
            Your League
          </div>
        )}
      </div>
      <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)" }}>
        <BigMedal color={tier.color} size={56} />
      </div>
      <div
        style={{
          // Current tier gets a warm gold tint; others sit on the standard dark surface.
          background: tier.current ? "var(--maple-100)" : "var(--surface-2)",
          padding: "34px 14px 14px",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "Archivo Black", fontSize: 18, letterSpacing: 0.5, color: "var(--ink)", marginBottom: 10 }}>{tier.label}</div>

        {tier.rewards.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-1)",
              border: "1px solid rgba(253, 251, 246, 0.06)",
              borderRadius: 99,
              padding: "7px 10px",
              marginBottom: 6,
            }}
          >
            <RewardChest variant={r.r} idx={i} />
            {r.n != null && <Pill icon="✓" color="#3dd17a" value={r.n} />}
            <Pill icon="🎟" color="var(--berry)" value={r.t} />
            <Pill icon="🪙" color="var(--maple-500)" value={r.c} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const LeaguesScreen = () => {
  const proto = useProto();

  const displayed: Tier[] = [
    { ...TIERS[1], rewards: [{ r: "rainbow", n: 4, t: 300, c: 7500 }, { r: "purple", n: 1, t: 100, c: 4500 }, { r: "brown", n: null, t: 40, c: 2000 }] },
    { ...TIERS[0], rewards: [{ r: "rainbow", n: 2, t: 200, c: 5000 }, { r: "purple", n: 1, t: 50, c: 3000 }, { r: "brown", n: null, t: 20, c: 1000 }], current: true },
    { ...TIERS[2], rewards: [{ r: "rainbow", n: 5, t: 350, c: 8500 }, { r: "purple", n: 2, t: 150, c: 5500 }, { r: "brown", n: null, t: 60, c: 2500 }] },
    { ...TIERS[5], rewards: [{ r: "rainbow", n: 8, t: 500, c: 12500 }, { r: "purple", n: 3, t: 200, c: 7500 }, { r: "brown", n: null, t: 80, c: 4000 }] },
    { ...TIERS[6], rewards: [{ r: "rainbow", n: 10, t: 600, c: 15000 }, { r: "purple", n: 3, t: 250, c: 9000 }, { r: "brown", n: null, t: 100, c: 5000 }] },
    { ...TIERS[8], rewards: [{ r: "rainbow", n: 18, t: 1000, c: 25000 }, { r: "purple", n: 5, t: 450, c: 15000 }, { r: "brown", n: null, t: 180, c: 9000 }] },
    { ...TIERS[10], rewards: [{ r: "rainbow", n: 25, t: 1500, c: 40000 }, { r: "purple", n: 8, t: 600, c: 25000 }, { r: "brown", n: null, t: 250, c: 15000 }] },
  ];

  return (
    <Phone statusDark>
      {/* Same dark surface + gold glow + confetti dots used by the
          leaderboard / results screens, replacing the off-brand purple. */}
      <div className="bg-deep" />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          background: "radial-gradient(ellipse at center top, rgba(255, 201, 49, 0.18), transparent 65%)",
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
          height: 170,
          backgroundImage:
            "radial-gradient(circle, #FFC931 2px, transparent 2.5px), radial-gradient(circle, #FB72FF 2px, transparent 2.5px), radial-gradient(circle, #00CFF2 2px, transparent 2.5px)",
          backgroundSize: "80px 80px, 100px 100px, 70px 70px",
          backgroundPosition: "0 0, 30px 40px, 50px 20px",
          opacity: 0.3,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, padding: "0 14px", display: "flex", alignItems: "center", color: "var(--ink)", zIndex: 2 }}>
        <button aria-label="Back to leaderboard" onClick={() => proto.goto("leaderboard", { back: true })} style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: "var(--ink)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "Archivo Black", fontSize: 18, letterSpacing: 1, marginRight: 34 }}>LEAGUES</div>
      </div>

      <div style={{ position: "absolute", top: 90, left: 0, right: 0, bottom: 64, padding: "0 16px 16px", overflow: "auto", scrollbarWidth: "none" }}>
        <div style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 12, fontWeight: 700, padding: "0 20px 18px", lineHeight: 1.4 }}>
          Move up to the next league for better rewards!
        </div>

        {displayed.map((tier, i) => <LeagueCard key={i} tier={tier} />)}
      </div>

      <div className="bottom-bar" style={{ paddingTop: 4, paddingBottom: 4, gap: 0 }}>
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
