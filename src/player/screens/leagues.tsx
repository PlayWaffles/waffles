"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useProto } from "../state";
import { ASSETS, BackButton, Phone, PixelImg, SyrupIcon, TabBar } from "../shared";
import { loadLeague } from "@/actions/player";
import type { League } from "@/lib/player/leagues";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";

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
    <span style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString()}</span>
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

type RewardRow = {
  r: "rainbow" | "purple" | "brown";
  syrup: number;
  powerUps: { kind: string; n: number }[];
  boost?: { kind: string; charges: number };
};
type Tier = (typeof TIERS)[number] & {
  current?: boolean;
  rewards: RewardRow[];
};

// Short glyph for each power-up kind shown on a reward row.
const POWERUP_GLYPH: Record<string, string> = {
  FIFTY_FIFTY: "½",
  EXTRA_TIME: "⏱",
  SKIP: "⏭",
  SHIELD: "🛡",
};

// Cohort movement thresholds — mirrors PROMOTE_TOP / DEMOTE_BOTTOM in
// src/lib/player/leagueSettlement.ts (kept in sync by hand; a client component
// can't import the server-only settlement module).
const PROMOTE_TOP = 7;
const DEMOTE_BOTTOM = 5;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0m";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

type Zone = { label: string; color: string; bg: string; arrow: string };
// Where the player sits relative to the promotion (top 7) / demotion (bottom 5)
// lines, with the same small-cohort clamp the settlement job uses.
function zoneFor(league: League): Zone | null {
  const { rank, cohortSize, key } = league;
  if (rank == null || cohortSize <= 0) return null;
  const demoteFrom = Math.max(PROMOTE_TOP, cohortSize - DEMOTE_BOTTOM);
  if (key !== "master1" && rank <= PROMOTE_TOP) {
    return { label: "Promotion zone", color: "#3dd17a", bg: "rgba(61,209,122,0.14)", arrow: "▲" };
  }
  if (key !== "apprentice1" && rank > demoteFrom) {
    return { label: "Demotion zone", color: "#ff6b6b", bg: "rgba(255,107,107,0.14)", arrow: "▼" };
  }
  return { label: "Safe zone", color: "var(--ink-soft)", bg: "var(--surface-2)", arrow: "—" };
}

// Live "where you stand this week" card: tier, cohort rank, points, the
// promotion/demotion status, and a ticking countdown to the season reset.
const StandingCard = ({ league, now }: { league: League; now: number }) => {
  const zone = zoneFor(league);
  return (
    <div style={{ background: "var(--maple-100)", borderRadius: 14, marginBottom: 16, padding: 14, boxShadow: "0 4px 0 rgba(0, 0, 0, 0.25)", border: "2px solid var(--maple-500)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BigMedal color={league.color} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--ink-soft)" }}>YOUR STANDING</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 0.5, color: "var(--ink)" }}>{league.label}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
            {league.rank != null ? `Rank #${league.rank}` : "Unranked"}
            {league.cohortSize > 0 ? ` of ${league.cohortSize}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{league.points.toLocaleString()}</div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--ink-soft)", marginTop: 2 }}>PTS</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        {zone && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: zone.bg, color: zone.color, borderRadius: 99, padding: "5px 10px", fontSize: 11, fontWeight: 800 }}>
            <span aria-hidden>{zone.arrow}</span>
            {zone.label}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-soft)", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          <span aria-hidden>⏳</span> Resets in {formatCountdown(league.seasonEndsAt - now)}
        </div>
      </div>
    </div>
  );
};

const LeagueCard = ({ tier }: { tier: Tier }) => {
  return (
    <div
      data-coach={tier.current ? "leagues-current" : undefined}
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
              fontFamily: "var(--font-body)",
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
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 0.5, color: "var(--ink)", marginBottom: 10 }}>{tier.label}</div>

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
            <Pill icon={<SyrupIcon size={14} />} color="var(--berry)" value={r.syrup} />
            {r.powerUps.map((p) => (
              <Pill key={p.kind} icon={POWERUP_GLYPH[p.kind] ?? "⚡"} color="var(--maple-500)" value={p.n} />
            ))}
            {r.boost && <Pill icon="⚡" color="#3dd17a" value={r.boost.charges} />}
          </div>
        ))}
      </div>
    </div>
  );
};

export const LeaguesScreen = () => {
  const proto = useProto();

  // Real current-season tier + DB-backed reward ladder. Defaults to the
  // prototype's tier/rewards so the preview / unauthenticated context still
  // renders before the server responds.
  const [league, setLeague] = useState<League | null>(null);
  useEffect(() => {
    let active = true;
    loadLeague()
      .then((l) => {
        if (active && l) setLeague(l);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Screen impression — fired once on mount, independent of the async load.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackClientEvent(AnalyticsEvent.LeaguesViewed, { screen: "leagues" });
  }, []);

  // Once the real league resolves, log the current-tier card + rewards ladder
  // impressions with tier context (the ladder is always rendered inline).
  const detailRef = useRef(false);
  useEffect(() => {
    if (detailRef.current || !league) return;
    detailRef.current = true;
    const ctx = {
      screen: "leagues",
      tier: league.key,
      rank: league.rank ?? null,
      cohort_size: league.cohortSize,
      points: league.points,
    };
    trackClientEvent(AnalyticsEvent.LeagueCardViewed, ctx);
    trackClientEvent(AnalyticsEvent.LeagueRewardsViewed, ctx);
  }, [league]);

  // Tick once a second so the season-reset countdown stays live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentKey = league?.key ?? "apprentice1";
  // Server reward ladder keyed by tier; fall back to inline preview values.
  const rewardsByKey = new Map((league?.tiers ?? []).map((t) => [t.key, t.rewards as Tier["rewards"]]));
  // Preview-only fallback (server `league.tiers[].rewards` is the real source).
  // Mirrors the band grants in src/lib/player/leagues.ts; syrup scales by tier.
  const rows = (rainbow: number, purple: number, brown: number): RewardRow[] => [
    { r: "rainbow", syrup: rainbow, powerUps: [{ kind: "SHIELD", n: 1 }, { kind: "FIFTY_FIFTY", n: 2 }], boost: { kind: "DOUBLE_XP", charges: 3 } },
    { r: "purple", syrup: purple, powerUps: [{ kind: "FIFTY_FIFTY", n: 1 }], boost: { kind: "DOUBLE_XP", charges: 1 } },
    { r: "brown", syrup: brown, powerUps: [] },
  ];
  const FALLBACK_REWARDS: Record<string, Tier["rewards"]> = {
    apprentice2: rows(300, 100, 40),
    apprentice1: rows(200, 50, 20),
    silver1: rows(350, 150, 60),
    advanced1: rows(500, 200, 80),
    advanced2: rows(600, 250, 100),
    master3: rows(1000, 450, 180),
    master1: rows(1500, 600, 250),
  };
  // Canonical displayed subset + order of tiers.
  const DISPLAY_KEYS = ["apprentice2", "apprentice1", "silver1", "advanced1", "advanced2", "master3", "master1"];
  const displayed: Tier[] = DISPLAY_KEYS.map((key) => {
    const base = TIERS.find((t) => t.key === key)!;
    return { ...base, current: key === currentKey, rewards: rewardsByKey.get(key) ?? FALLBACK_REWARDS[key] ?? [] };
  });
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
        <BackButton
          label="Back to leaderboard"
          onClick={() => {
            trackClientEvent(AnalyticsEvent.LeaguesBackClicked, {
              screen: "leagues",
              tier: league?.key ?? null,
            });
            proto.goto("leaderboard", { back: true });
          }}
        />
        <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 1, marginRight: 34 }}>LEAGUES</div>
      </div>

      <div style={{ position: "absolute", top: 90, left: 0, right: 0, bottom: 64, padding: "0 16px 16px", overflow: "auto", scrollbarWidth: "none" }}>
        {league && <StandingCard league={league} now={now} />}

        <div style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 12, fontWeight: 700, padding: "0 20px 18px", lineHeight: 1.4 }}>
          Finish in the top {PROMOTE_TOP} to move up — bottom {DEMOTE_BOTTOM} drop a league.
        </div>

        {displayed.map((tier, i) => <LeagueCard key={i} tier={tier} />)}
      </div>

      <div className="bottom-bar" style={{ paddingTop: 4, paddingBottom: 4, gap: 0 }}>
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
