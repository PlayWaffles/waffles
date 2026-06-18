"use client";

import { useEffect, useState } from "react";
import { syrupLabel, useProto } from "../state";
import { ASSETS, AssetWell, BackButton, InfoButton, Phone, PixelImg, SyrupIcon, TabBar } from "../shared";
import { v2LoadMissions, v2LoadPartnerOffers, v2ClaimPartnerOffer } from "@/actions/player";
import type { V2Mission } from "@/lib/player/missions";
import type { V2PartnerOffer } from "@/lib/player/partnerOffers";

const ICON_ASSETS: Record<string, string> = {
  iconTarget: ASSETS.iconTarget,
  flame: ASSETS.flame,
  trophy: ASSETS.trophy,
  iconCalendar: ASSETS.iconCalendar,
};

export const MissionsScreen = () => {
  const proto = useProto();
  const [tab, setTab] = useState<"daily" | "partner">("daily");

  // Load real daily missions (Quest + per-user progress). Falls back to the
  // static list in the preview / unauthenticated context.
  const [loaded, setLoaded] = useState<V2Mission[] | null>(null);
  useEffect(() => {
    let active = true;
    v2LoadMissions()
      .then((m) => {
        if (active && m && m.length) setLoaded(m);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const staticDaily: { t: string; p: number; tot: number; xp: number; icon: string }[] = [
    { t: "Answer 5 questions in Survival", p: 0, tot: 5, xp: 300, icon: ASSETS.iconTarget },
    { t: "Topics: streak of 10 in 1 category", p: 0, tot: 1, xp: 225, icon: ASSETS.flame },
    { t: "Answer 3 questions in Survival", p: 2, tot: 3, xp: 150, icon: ASSETS.iconTarget },
    { t: "Win 1 tournament", p: 0, tot: 1, xp: 500, icon: ASSETS.trophy },
    { t: "Play 5 days in a row", p: 3, tot: 5, xp: 400, icon: ASSETS.iconCalendar },
  ];
  const dailyMissions = loaded
    ? loaded.map((m) => ({ t: m.title, p: m.count, tot: m.total, xp: m.xp, icon: ICON_ASSETS[m.icon] ?? ASSETS.iconTarget }))
    : staticDaily;

  // Real sponsored partner offers (+ per-user claim state). Falls back to the
  // static list in the preview / unauthenticated context.
  const [offers, setOffers] = useState<V2PartnerOffer[] | null>(null);
  const [claimedSlugs, setClaimedSlugs] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    v2LoadPartnerOffers()
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

  const STATIC_PARTNERS: V2PartnerOffer[] = [
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
      const res = await v2ClaimPartnerOffer(slug);
      if (res?.ok && res.tickets != null) proto.update(() => ({ tickets: res.tickets! }));
    } catch {
      /* no session — keep the optimistic local credit */
    }
  };

  const totalDailyXP = dailyMissions.reduce((s, m) => s + m.xp, 0);
  const totalPartnerTickets = partnerMissions.reduce((s, m) => s + m.tickets, 0);

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
        <button onClick={() => setTab("daily")} style={{ flex: 1, background: tab === "daily" ? "#FFC931" : "transparent", color: tab === "daily" ? "#1e1e1e" : "rgba(255,255,255,.6)", border: "none", padding: "9px 10px", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 0.4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span>DAILY</span>
          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: tab === "daily" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.1)" }}>{dailyMissions.length}</span>
        </button>
        <button onClick={() => setTab("partner")} style={{ flex: 1, background: tab === "partner" ? "#00CFF2" : "transparent", color: tab === "partner" ? "#1e1e1e" : "rgba(255,255,255,.6)", border: "none", padding: "9px 10px", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 0.4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", marginTop: 2 }}>Resets in 17h 42m</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dailyMissions.map((m, i) => {
                const pct = Math.min(100, Math.round((m.p / m.tot) * 100));
                const done = m.p >= m.tot;
                return (
                  <div key={i} style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: done ? 0.65 : 1 }}>
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
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,201,49,.15)", border: "1px solid rgba(255,201,49,.3)", color: "var(--maple-500)", padding: "4px 8px", borderRadius: 8, fontFamily: "var(--font-display)", fontSize: 11, flexShrink: 0 }}>
                      +{m.xp} XP
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "partner" && (
          <>
            <div style={{ background: "linear-gradient(180deg, rgba(0,207,242,.12), rgba(0,207,242,.03))", border: "1px solid rgba(0,207,242,.25)", borderRadius: 14, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
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
                      {m.verified && <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "rgba(0,207,242,.7)" }}>✓ Verified</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,207,242,.15)", border: "1px solid rgba(0,207,242,.35)", color: "#00CFF2", padding: "4px 8px", borderRadius: 8, fontFamily: "var(--font-display)", fontSize: 10 }}>
                      +{m.tickets}
                      <SyrupIcon size={14} />
                    </span>
                    {claimedSlugs.has(m.slug) ? (
                      <span style={{ background: "rgba(0,207,242,.15)", color: "#00CFF2", border: "1px solid rgba(0,207,242,.35)", padding: "5px 10px", borderRadius: 7, fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 0.4, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>✓ Claimed</span>
                    ) : (
                      <button type="button" onClick={() => claimPartner(m.slug, m.tickets)} aria-label={`${m.cta} ${m.brand}`} style={{ background: "#fff", color: "#1e1e1e", border: "none", padding: "5px 10px", borderRadius: 7, fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 0.4, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>{m.cta} →</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.4)", marginTop: 14, lineHeight: 1.5, textAlign: "center", padding: "0 12px" }}>Syrup is credited within 24h after the offer is verified by the partner. By engaging with offers you accept our partner terms.</div>
          </>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0F0F10", padding: "8px 0 6px", borderTop: "2px solid rgba(255,255,255,.08)" }}>
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
