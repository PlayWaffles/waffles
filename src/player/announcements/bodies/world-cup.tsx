"use client";

import { useEffect, useState } from "react";
import { TOURNAMENT_TOP_PRIZE, usdtLabel } from "../../state";
import { ASSETS, PixelImg } from "../../shared";
import { FullModal, FullModalGlow } from "../FullModal";

// Season welcome — the *moment* the World Cup goes live. The World Cup is the
// default season for everyone (not opt-in), so this is a celebratory intro, not
// a gate: a single "Let's go" dismisses it. "Seen" is DB-backed (the host
// persists it on close) — so it shows once per user across devices; the
// announcement bell entry reopens it anytime.
//
// Too custom for the generic template (live countdown, dual-layer festive
// header, date/kickoff badges), so it renders directly on the <FullModal> shell.

const PERKS: { icon: string; text: string }[] = [
  { icon: "⚽", text: "Football trivia, refreshed daily" },
  { icon: "🔀", text: "New question formats — pick, order & more" },
  { icon: "⏱️", text: "Live tournaments every 4 hours" },
  { icon: "🏆", text: `Win up to ${usdtLabel(TOURNAMENT_TOP_PRIZE)} in real prizes` },
];

export const WorldCupBody = ({ onClose }: { onClose: () => void }) => {
  // Live countdown to the next tournament-window kickoff.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const ms = Math.max(0, next.getTime() - now);
  const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");

  return (
    <FullModal
      ariaLabel="World Cup season is live"
      // World Cup palette baked in (the app theme is still default when this
      // shows, so we can't rely on the [data-theme] vars yet).
      background="linear-gradient(180deg, #0c2017 0%, #05130b 100%)"
      decoration={
        <>
          {/* Festive top glow + confetti-dot texture */}
          <FullModalGlow height={320} color="rgba(255,210,77,.28)" />
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320, backgroundImage: "radial-gradient(circle, #FFD24D 2px, transparent 2.5px), radial-gradient(circle, #2bbf5b 2px, transparent 2.5px), radial-gradient(circle, #fff 1.5px, transparent 2px)", backgroundSize: "80px 80px, 100px 100px, 70px 70px", backgroundPosition: "0 0, 30px 40px, 50px 20px", opacity: 0.4, pointerEvents: "none" }} />
        </>
      }
      contentStyle={{ justifyContent: "safe center", padding: "0 28px" }}
      footerStyle={{ padding: "0 18px max(20px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 10 }}
      footer={
        <button type="button" className="cta maple" onClick={onClose} style={{ width: "100%", flex: "none" }}>
          LET&apos;S GO
        </button>
      }
    >
      <div style={{ position: "relative", marginBottom: 8 }}>
        <PixelImg src={ASSETS.trophy} size={128} alt="" style={{ filter: "drop-shadow(0 0 30px rgba(255,210,77,.55))", animation: "waffles-v2-lvl-trophy-float 3.2s ease-in-out infinite" }} />
        <span style={{ position: "absolute", right: -6, bottom: 2, fontSize: 40, filter: "drop-shadow(0 3px 6px rgba(0,0,0,.5))" }} aria-hidden>⚽</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: "var(--maple-500)", textTransform: "uppercase", marginBottom: 8 }}>Season is live</div>
      <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 40, lineHeight: 1.02, color: "#fff", marginBottom: 10 }}>
        The World Cup<br />comes to Waffles
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 800, color: "#fff" }}>📅 Jun 11 – Jul 19</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,210,77,.14)", border: "1px solid rgba(255,210,77,.4)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 800, color: "var(--maple-500)", fontVariantNumeric: "tabular-nums" }}>⏱️ Next kickoff {mm}:{ss}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.6)", marginBottom: 24, maxWidth: 300 }}>
        A whole new season of football trivia. Play live, climb the table, win real prizes.
      </div>

      <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        {PERKS.map((p) => (
          <div key={p.text} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", textAlign: "left" }}>
            <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden>{p.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{p.text}</span>
          </div>
        ))}
      </div>
    </FullModal>
  );
};
