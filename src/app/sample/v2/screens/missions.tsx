"use client";

import { useState } from "react";
import { useProto } from "../state";
import { ASSETS, FlameIcon, Phone, PixelImg, TabBar } from "../shared";

export const MissionsScreen = () => {
  const proto = useProto();
  const [tab, setTab] = useState<"daily" | "partner">("daily");

  const dailyMissions: { t: string; p: number; tot: number; xp: number; icon: string }[] = [
    { t: "Answer 5 questions in Survival", p: 0, tot: 5, xp: 300, icon: ASSETS.iconTarget },
    { t: "Topics: streak of 10 in 1 category", p: 0, tot: 1, xp: 225, icon: ASSETS.flame },
    { t: "Answer 3 questions in Survival", p: 2, tot: 3, xp: 150, icon: ASSETS.iconTarget },
    { t: "Win 1 tournament", p: 0, tot: 1, xp: 500, icon: ASSETS.trophy },
    { t: "Play 5 days in a row", p: 3, tot: 5, xp: 400, icon: ASSETS.iconCalendar },
  ];

  const partnerMissions = [
    { brand: "Duolingo", brandColor: "#58CC02", glyph: "🦉", t: "Try a free language lesson", cta: "Open app", tickets: 3, time: "~2 min", verified: true },
    { brand: "Spotify", brandColor: "#1DB954", glyph: "♫", t: "Sign up for Spotify Free trial", cta: "Get offer", tickets: 5, time: "~5 min", verified: true },
    { brand: "Doordash", brandColor: "#FF3008", glyph: "D", t: "Place your first order, $10 off", cta: "Claim", tickets: 10, time: "varies", verified: true, hot: true },
    { brand: "Pulse", brandColor: "#FFC931", glyph: "?", t: "Answer a 5-min market survey", cta: "Start", tickets: 2, time: "~5 min", verified: true },
    { brand: "Lyft", brandColor: "#FF00BF", glyph: "L", t: "First ride, up to $5 off", cta: "Claim", tickets: 8, time: "~2 min", verified: true },
    { brand: "Calm", brandColor: "#3a8df1", glyph: "☾", t: "Try a free 7-day trial", cta: "Open app", tickets: 6, time: "~3 min", verified: true },
  ];

  const totalDailyXP = dailyMissions.reduce((s, m) => s + m.xp, 0);
  const totalPartnerTickets = partnerMissions.reduce((s, m) => s + m.tickets, 0);

  return (
    <Phone>
      <div style={{ position: "absolute", inset: 0, background: "var(--frame)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 160, background: "radial-gradient(ellipse at 50% 0%, rgba(255,201,49,.18), transparent 70%)" }} />

      <div style={{ position: "absolute", top: 6, left: 0, right: 0, padding: "0 14px", display: "flex", alignItems: "center", color: "#fff", gap: 8 }}>
        <button aria-label="Back to Compete" onClick={() => proto.goto("pass", { back: true })} style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, fontFamily: "Archivo Black", fontSize: 18, letterSpacing: 0.5, textAlign: "center" }}>MISSIONS</div>
        <div style={{ width: 30, height: 30, borderRadius: 99, border: "1.5px solid rgba(255,255,255,.25)", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>i</div>
      </div>

      <div style={{ position: "absolute", top: 96, left: 14, right: 14, background: "#0F0F10", borderRadius: 99, padding: 4, border: "1px solid rgba(255,255,255,.06)", display: "flex", gap: 2 }}>
        <button onClick={() => setTab("daily")} style={{ flex: 1, background: tab === "daily" ? "#FFC931" : "transparent", color: tab === "daily" ? "#1e1e1e" : "rgba(255,255,255,.6)", border: "none", padding: "9px 10px", borderRadius: 99, fontFamily: "Archivo Black", fontSize: 11, letterSpacing: 0.4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span>DAILY</span>
          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: tab === "daily" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.1)" }}>{dailyMissions.length}</span>
        </button>
        <button onClick={() => setTab("partner")} style={{ flex: 1, background: tab === "partner" ? "#00CFF2" : "transparent", color: tab === "partner" ? "#1e1e1e" : "rgba(255,255,255,.6)", border: "none", padding: "9px 10px", borderRadius: 99, fontFamily: "Archivo Black", fontSize: 11, letterSpacing: 0.4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span>PARTNERS</span>
          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: tab === "partner" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.1)" }}>{partnerMissions.length}</span>
        </button>
      </div>

      <div style={{ position: "absolute", top: 148, left: 0, right: 0, bottom: 80, overflow: "auto", scrollbarWidth: "none", padding: "10px 14px 24px" }}>
        {tab === "daily" && (
          <>
            <div style={{ background: "linear-gradient(180deg, rgba(255,201,49,.14), rgba(255,201,49,.04))", border: "1px solid rgba(255,201,49,.25)", borderRadius: 14, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <PixelImg src={ASSETS.trophy} size={48} alt="" />
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
                    <PixelImg src={m.icon} size={44} alt="" style={{ flexShrink: 0 }} />
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
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(0,207,242,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="16" viewBox="0 0 22 14" fill="none">
                  <path d="M2 3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a2 2 0 0 0 0-4V3z" fill="#00CFF2" />
                  <path d="M9 3v8" stroke="#0F0F10" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Archivo Black", fontSize: 13, color: "#fff", letterSpacing: 0.3 }}>Earn up to {totalPartnerTickets} 🎟 from offers</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.55)", marginTop: 2 }}>Sponsored by our partners · Verified rewards</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {partnerMissions.map((m, i) => (
                <div key={i} style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "12px 12px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                  {m.hot && <div style={{ position: "absolute", top: -6, right: 10, background: "#FC1919", color: "#fff", fontFamily: "Archivo Black", fontSize: 8, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 4, boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>HOT</div>}
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: m.brandColor, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 20, color: "#fff", flexShrink: 0, boxShadow: "inset 0 -2px 0 rgba(0,0,0,.2)" }}>{m.glyph}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontFamily: "Archivo Black", fontSize: 12, color: "#fff", letterSpacing: 0.3 }}>{m.brand}</div>
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
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.85)", lineHeight: 1.3, marginTop: 2 }}>{m.t}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.45)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⏱ {m.time}</span>
                      {m.verified && <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "rgba(0,207,242,.7)" }}>✓ Verified</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,207,242,.15)", border: "1px solid rgba(0,207,242,.35)", color: "#00CFF2", padding: "4px 8px", borderRadius: 8, fontFamily: "Archivo Black", fontSize: 10 }}>
                      +{m.tickets}
                      <svg width="11" height="9" viewBox="0 0 22 14" fill="none">
                        <path d="M2 3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a2 2 0 0 0 0-4V3z" fill="#00CFF2" />
                        <path d="M9 3v8" stroke="#0F0F10" strokeWidth="1" strokeDasharray="1.5 1.5" />
                      </svg>
                    </span>
                    <button style={{ background: "#fff", color: "#1e1e1e", border: "none", padding: "5px 10px", borderRadius: 7, fontFamily: "Archivo Black", fontSize: 9, letterSpacing: 0.4, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>{m.cta} →</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.4)", marginTop: 14, lineHeight: 1.5, textAlign: "center", padding: "0 12px" }}>Tickets are credited within 24h after the offer is verified by the partner. By engaging with offers you accept our partner terms.</div>
          </>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0F0F10", padding: "8px 0 6px", borderTop: "2px solid rgba(255,255,255,.08)" }}>
        <TabBar active="compete" />
      </div>
    </Phone>
  );
};
