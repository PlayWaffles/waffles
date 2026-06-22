"use client";

import { useEffect, useRef, useState } from "react";
import { syrupLabel, useProto } from "../state";
import { useResilientAction } from "../useResilientAction";
import { ASSETS, AssetWell, BackButton, InfoButton, Phone, PixelImg, SyrupIcon, TabBar } from "../shared";
import { loadMissions, loadPartnerOffers, claimPartnerOffer, claimMission } from "@/player/api";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import type { Mission } from "@/lib/player/missions";
import type { PartnerOffer } from "@/lib/player/partnerOffers";

const ICON_ASSETS: Record<string, string> = {
  iconTarget: ASSETS.iconTarget,
  flame: ASSETS.flame,
  trophy: ASSETS.trophy,
  iconCalendar: ASSETS.iconCalendar,
};

// "Hh Mm" until the next UTC midnight — the boundary the server resets daily
// mission progress on (see lib/player/missions.ts).
const timeToUtcMidnight = (): string => {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((next.getTime() - now.getTime()) / 60_000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export const MissionsScreen = () => {
  const proto = useProto();
  const [tab, setTab] = useState<"daily" | "partner">("daily");

  // Load real daily missions (Quest + per-user progress) via a resilient fetch
  // (retries through the auth-cookie race), then mirror into local state so the
  // optimistic claim flip below can mutate it. Falls back to the static list in
  // the preview / unauthenticated context.
  const { data: fetchedMissions } = useResilientAction(() => loadMissions(), []);
  const [loaded, setLoaded] = useState<Mission[] | null>(null);
  useEffect(() => {
    if (fetchedMissions && fetchedMissions.length) setLoaded(fetchedMissions);
  }, [fetchedMissions]);

  type DailyRow = { slug: string | null; t: string; p: number; tot: number; xp: number; icon: string; done: boolean; claimable: boolean; featured: boolean };
  // Preview rows for the unauth/loading context: the 3 featured dailies + a few
  // sample generated missions, mirroring the real two-section layout.
  const staticDaily: DailyRow[] = [
    { slug: null, t: "Answer 5 questions", p: 0, tot: 5, xp: 300, icon: ASSETS.iconTarget, done: false, claimable: false, featured: true },
    { slug: null, t: "Win a tournament", p: 0, tot: 1, xp: 500, icon: ASSETS.trophy, done: false, claimable: false, featured: true },
    { slug: null, t: "Keep a 5-day streak", p: 3, tot: 5, xp: 400, icon: ASSETS.iconCalendar, done: false, claimable: false, featured: true },
    { slug: null, t: "Score 1,000 points", p: 0, tot: 1000, xp: 250, icon: ASSETS.flame, done: false, claimable: false, featured: false },
    { slug: null, t: "Play 3 games", p: 1, tot: 3, xp: 180, icon: ASSETS.iconCalendar, done: false, claimable: false, featured: false },
    { slug: null, t: "Enter 3 tournaments", p: 0, tot: 3, xp: 300, icon: ASSETS.trophy, done: false, claimable: false, featured: false },
    { slug: null, t: "Answer 10 questions", p: 0, tot: 10, xp: 200, icon: ASSETS.iconTarget, done: false, claimable: false, featured: false },
  ];
  const dailyMissions: DailyRow[] = loaded
    ? loaded.map((m) => ({ slug: m.slug, t: m.title, p: m.count, tot: m.total, xp: m.xp, icon: ICON_ASSETS[m.icon] ?? ASSETS.iconTarget, done: m.done, claimable: m.claimable, featured: m.featured }))
    : staticDaily;
  const featuredMissions = dailyMissions.filter((m) => m.featured);
  const generatedMissions = dailyMissions.filter((m) => !m.featured);

  // Claim a completed daily mission — awards XP server-side, with an optimistic
  // local flip + XP credit so the tile updates instantly.
  const [claimingSlug, setClaimingSlug] = useState<string | null>(null);
  const claimDailyMission = async (slug: string | null, xp: number) => {
    if (!slug || claimingSlug) return;
    setClaimingSlug(slug);
    trackClientEvent(AnalyticsEvent.MissionClaimClicked, { screen: "missions", mission_slug: slug, xp });
    try {
      const res = await claimMission(slug);
      if (res?.ok) {
        proto.update(() => ({ xp: res.xp }));
        setLoaded((list) => list?.map((m) => (m.slug === slug ? { ...m, done: true, claimable: false, count: m.total } : m)) ?? list);
        trackClientEvent(AnalyticsEvent.MissionClaimSucceeded, { screen: "missions", mission_slug: slug, xp_awarded: res.xpAwarded });
      } else {
        trackClientEvent(AnalyticsEvent.MissionClaimFailed, { screen: "missions", mission_slug: slug, reason: res?.error ?? "no_session" });
      }
    } finally {
      setClaimingSlug(null);
    }
  };

  // One mission tile — shared by the Daily (featured) and generated sections.
  const renderRow = (m: DailyRow, key: string | number) => {
    const pct = Math.min(100, Math.round((m.p / m.tot) * 100));
    return (
      <div key={key} style={{ background: "var(--surface-1)", border: m.claimable ? "1px solid rgba(255,201,49,.35)" : "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: m.done ? 0.55 : 1 }}>
        <AssetWell size={60} accent={m.icon === ASSETS.flame ? "var(--berry)" : m.icon === ASSETS.trophy ? "var(--maple-500)" : "var(--leaf)"} radius={14}>
          <PixelImg src={m.icon} size={46} alt="" />
        </AssetWell>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{m.t}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#FFC931" }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.5)", whiteSpace: "nowrap" }}>{m.p}/{m.tot}</span>
          </div>
        </div>
        {m.done ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,159,28,.15)", border: "1px solid rgba(255,159,28,.35)", color: "#FF9F1C", padding: "5px 9px", borderRadius: 8, fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: 0.3, flexShrink: 0, whiteSpace: "nowrap" }}>
            ✓ Claimed
          </div>
        ) : m.claimable ? (
          <button
            type="button"
            onClick={() => claimDailyMission(m.slug, m.xp)}
            disabled={claimingSlug === m.slug}
            aria-label={`Claim ${m.xp} XP for ${m.t}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--maple-500)", border: "1.5px solid var(--frame)", color: "var(--frame)", padding: "6px 11px", borderRadius: 8, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 0.3, flexShrink: 0, whiteSpace: "nowrap", cursor: claimingSlug === m.slug ? "default" : "pointer", boxShadow: "0 3px 0 var(--frame)", opacity: claimingSlug === m.slug ? 0.6 : 1 }}
          >
            {claimingSlug === m.slug ? "…" : `CLAIM +${m.xp}`}
          </button>
        ) : (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,201,49,.15)", border: "1px solid rgba(255,201,49,.3)", color: "var(--maple-500)", padding: "4px 8px", borderRadius: 8, fontFamily: "var(--font-display)", fontSize: 11, flexShrink: 0 }}>
            +{m.xp} XP
          </div>
        )}
      </div>
    );
  };

  // Real sponsored partner offers (+ per-user claim state). Falls back to the
  // static list in the preview / unauthenticated context.
  const [offers, setOffers] = useState<PartnerOffer[] | null>(null);
  const [claimedSlugs, setClaimedSlugs] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    loadPartnerOffers()
      .then((o) => {
        if (active && o && o.length) {
          setOffers(o);
          setClaimedSlugs(new Set(o.filter((x) => x.claimed).map((x) => x.slug)));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const STATIC_PARTNERS: PartnerOffer[] = [
    { slug: "duolingo-lesson", brand: "Duolingo", brandColor: "#58CC02", glyph: "🦉", title: "Try a free language lesson", cta: "Open app", tickets: 3, estTime: "~2 min", verified: true, hot: false, claimed: false },
    { slug: "spotify-trial", brand: "Spotify", brandColor: "#1DB954", glyph: "♫", title: "Sign up for Spotify Free trial", cta: "Get offer", tickets: 5, estTime: "~5 min", verified: true, hot: false, claimed: false },
    { slug: "doordash-first-order", brand: "Doordash", brandColor: "#FF3008", glyph: "D", title: "Place your first order, $10 off", cta: "Claim", tickets: 10, estTime: "varies", verified: true, hot: true, claimed: false },
    { slug: "pulse-survey", brand: "Pulse", brandColor: "#FFC931", glyph: "?", title: "Answer a 5-min market survey", cta: "Start", tickets: 2, estTime: "~5 min", verified: true, hot: false, claimed: false },
    { slug: "lyft-first-ride", brand: "Lyft", brandColor: "#FF00BF", glyph: "L", title: "First ride, up to $5 off", cta: "Claim", tickets: 8, estTime: "~2 min", verified: true, hot: false, claimed: false },
    { slug: "calm-trial", brand: "Calm", brandColor: "#3a8df1", glyph: "☾", title: "Try a free 7-day trial", cta: "Open app", tickets: 6, estTime: "~3 min", verified: true, hot: false, claimed: false },
  ];
  const partnerMissions = offers ?? STATIC_PARTNERS;

  const claimPartner = async (slug: string, tickets: number) => {
    if (claimedSlugs.has(slug)) return;
    setClaimedSlugs((prev) => new Set(prev).add(slug));
    proto.update((s) => ({ tickets: s.tickets + tickets }));
    try {
      const res = await claimPartnerOffer(slug);
      if (res?.ok && res.tickets != null) proto.update(() => ({ tickets: res.tickets! }));
    } catch {
      /* no session — keep the optimistic local credit */
    }
  };

  const totalDailyXP = dailyMissions.reduce((s, m) => s + m.xp, 0);
  const totalPartnerTickets = partnerMissions.reduce((s, m) => s + m.tickets, 0);

  // Real time left until missions reset — the server scopes daily progress to
  // the UTC day, so the countdown targets the next UTC midnight. Ticks each
  // minute so it stays accurate while the screen is open.
  const [resetLabel, setResetLabel] = useState(() => timeToUtcMidnight());
  useEffect(() => {
    const id = setInterval(() => setResetLabel(timeToUtcMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Screen impression (the daily tab is live; partner offers are coming-soon).
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackClientEvent(AnalyticsEvent.MissionsViewed, {
      screen: "missions",
      daily_count: dailyMissions.length,
    });
  }, [dailyMissions.length]);

  return (
    <Phone>
      <div style={{ position: "absolute", inset: 0, background: "var(--frame)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 160, background: "radial-gradient(ellipse at 50% 0%, rgba(255,201,49,.18), transparent 70%)" }} />

      <div style={{ position: "absolute", top: 6, left: 0, right: 0, padding: "0 14px", display: "flex", alignItems: "center", color: "#fff", gap: 8 }}>
        <BackButton label="Back to Compete" onClick={() => proto.goto("pass", { back: true })} />
        <div style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 0.5, textAlign: "center" }}>MISSIONS</div>
        <InfoButton title="Missions" text="Complete missions to earn rewards. Daily missions refresh every 24 hours and grant XP toward your level. Partner offers are sponsored tasks that pay out bonus Syrup." />
      </div>

      <div style={{ position: "absolute", top: 96, left: 14, right: 14, background: "#0F0F10", borderRadius: 99, padding: 4, border: "1px solid rgba(255,255,255,.06)", display: "flex", gap: 2 }}>
        <button onClick={() => { trackClientEvent(AnalyticsEvent.MissionsTabChanged, { screen: "missions", tab: "daily" }); setTab("daily"); }} style={{ flex: 1, background: tab === "daily" ? "#FFC931" : "transparent", color: tab === "daily" ? "#1e1e1e" : "rgba(255,255,255,.6)", border: "none", padding: "9px 10px", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 0.4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span>DAILY</span>
          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: tab === "daily" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.1)" }}>{dailyMissions.length}</span>
        </button>
        <button onClick={() => { trackClientEvent(AnalyticsEvent.MissionsTabChanged, { screen: "missions", tab: "partner", coming_soon: true }); setTab("partner"); }} style={{ flex: 1, background: tab === "partner" ? "#FF9F1C" : "transparent", color: tab === "partner" ? "#1e1e1e" : "rgba(255,255,255,.6)", border: "none", padding: "9px 10px", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 0.4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span>PARTNERS</span>
          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: tab === "partner" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.1)" }}>{partnerMissions.length}</span>
        </button>
      </div>

      <div style={{ position: "absolute", top: 148, left: 0, right: 0, bottom: 80, overflow: "auto", scrollbarWidth: "none", padding: "10px 14px 24px" }}>
        {tab === "daily" && (
          <>
            <div data-coach="missions-daily" style={{ background: "linear-gradient(180deg, rgba(255,201,49,.14), rgba(255,201,49,.04))", border: "1px solid rgba(255,201,49,.25)", borderRadius: 14, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <AssetWell size={76} accent="var(--maple-500)" radius={16}>
                <PixelImg src={ASSETS.trophy} size={62} alt="" />
              </AssetWell>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--ink)", letterSpacing: 0.3 }}>Earn up to {totalDailyXP} XP today</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", marginTop: 2 }}>Resets in {resetLabel}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 2px 10px" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,255,255,.85)", letterSpacing: 0.8 }}>DAILY</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.07)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {featuredMissions.map((m, i) => renderRow(m, m.slug ?? `f${i}`))}
            </div>

            {generatedMissions.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 2px 10px" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,255,255,.85)", letterSpacing: 0.8 }}>MISSIONS</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.45)", letterSpacing: 0.4 }}>FRESH DAILY</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.07)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {generatedMissions.map((m, i) => renderRow(m, m.slug ?? `g${i}`))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "partner" && (
          <div style={{ position: "relative" }}>
            {/* Partner offers aren't live yet — the real list is rendered dimmed
                behind a "coming soon" scrim, kept intact for when it ships. */}
            <div aria-hidden="true" style={{ filter: "blur(3px)", opacity: 0.35, pointerEvents: "none", userSelect: "none" }}>
            <div style={{ background: "linear-gradient(180deg, rgba(255,159,28,.12), rgba(255,159,28,.03))", border: "1px solid rgba(255,159,28,.25)", borderRadius: 14, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <AssetWell size={46} accent="var(--leaf)" radius={12}>
                <SyrupIcon size={24} />
              </AssetWell>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", letterSpacing: 0.3 }}>Earn up to {syrupLabel(totalPartnerTickets)} from offers</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.55)", marginTop: 2 }}>Sponsored by our partners · Verified rewards</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {partnerMissions.map((m) => (
                <div key={m.slug} style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "12px 12px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                  {m.hot && <div style={{ position: "absolute", top: -6, right: 10, background: "#FC1919", color: "#fff", fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 4, boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>HOT</div>}
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: m.brandColor, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 20, color: "#fff", flexShrink: 0, boxShadow: "inset 0 -2px 0 rgba(0,0,0,.2)" }}>{m.glyph}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "#fff", letterSpacing: 0.3 }}>{m.brand}</div>
                      {/* Clear "Sponsored" pill so the partnership is unmistakable
                          and never reads as a regular in-app reward. */}
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 900,
                          color: "var(--ink-soft)",
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                          background: "rgba(253, 251, 246, 0.08)",
                          border: "1px solid rgba(253, 251, 246, 0.15)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          lineHeight: 1,
                        }}
                      >
                        Sponsored
                      </span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.85)", lineHeight: 1.3, marginTop: 2 }}>{m.title}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.45)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⏱ {m.estTime}</span>
                      {m.verified && <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "rgba(255,159,28,.7)" }}>✓ Verified</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,159,28,.15)", border: "1px solid rgba(255,159,28,.35)", color: "#FF9F1C", padding: "4px 8px", borderRadius: 8, fontFamily: "var(--font-display)", fontSize: 10 }}>
                      +{m.tickets}
                      <SyrupIcon size={14} />
                    </span>
                    {claimedSlugs.has(m.slug) ? (
                      <span style={{ background: "rgba(255,159,28,.15)", color: "#FF9F1C", border: "1px solid rgba(255,159,28,.35)", padding: "5px 10px", borderRadius: 7, fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 0.4, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>✓ Claimed</span>
                    ) : (
                      <button type="button" onClick={() => claimPartner(m.slug, m.tickets)} aria-label={`${m.cta} ${m.brand}`} style={{ background: "#fff", color: "#1e1e1e", border: "none", padding: "5px 10px", borderRadius: 7, fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 0.4, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>{m.cta} →</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.4)", marginTop: 14, lineHeight: 1.5, textAlign: "center", padding: "0 12px" }}>Syrup is credited within 24h after the offer is verified by the partner. By engaging with offers you accept our partner terms.</div>
            </div>

            {/* Coming-soon scrim */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12, padding: "24px" }}>
              <AssetWell size={64} accent="var(--leaf)" radius={16}>
                <SyrupIcon size={32} />
              </AssetWell>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff", letterSpacing: 0.3 }}>Partner offers</div>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: "#FF9F1C", background: "rgba(255,159,28,.12)", border: "1px solid rgba(255,159,28,.35)", padding: "4px 10px", borderRadius: 99 }}>
                Coming soon
              </span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.6)", lineHeight: 1.5, maxWidth: 260 }}>
                Sponsored offers that pay out bonus Syrup are on the way. Check back soon.
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0F0F10", padding: "8px 0 6px", borderTop: "2px solid rgba(255,255,255,.08)" }}>
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
