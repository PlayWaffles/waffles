"use client";

import { ASSETS, PixelImg } from "../shared";

// One-time welcome shown to users migrated from the old app. Gated server-side
// (migrated user + not yet dismissed in the DB); the parent handles persistence.

const WHATS_NEW: { icon: string; title: string; text: string }[] = [
  { icon: "✨", title: "Fresh new look", text: "We redesigned the whole thing." },
  { icon: "🪜", title: "Levels", text: "Climb through levels and earn rewards as you play." },
  { icon: "📈", title: "Earn XP", text: "Every game you play earns XP and levels up your profile." },
  { icon: "🍯", title: "Syrup", text: "Your new in-game currency — spend it on power-ups, cosmetics & emotes." },
  { icon: "⏱️", title: "Games every 4 hours", text: "A new tournament every 4 hours. No more waiting to play." },
  { icon: "🎯", title: "Daily missions", text: "Knock them out for extra rewards." },
  { icon: "🔥", title: "Daily rewards & streaks", text: "Show up daily and keep your streak alive." },
];

export const MigrationTakeover = ({ onClose }: { onClose: () => void }) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to the new Waffles"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 95,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #181206 0%, #0a0a0b 100%)",
        animation: "waffles-v2-onb-in 0.35s var(--ease-out-quart)",
      }}
    >
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 300, background: "radial-gradient(ellipse at center top, rgba(255,210,77,.26), transparent 65%)", pointerEvents: "none" }} />

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 24px 8px", position: "relative", zIndex: 1 }}>
        <PixelImg src={ASSETS.trophy} size={92} alt="" style={{ filter: "drop-shadow(0 0 26px rgba(255,210,77,.5))", marginBottom: 6 }} />
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, color: "var(--maple-500)", textTransform: "uppercase", marginBottom: 8 }}>What&apos;s new</div>
        <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 34, lineHeight: 1.05, color: "#fff", marginBottom: 18 }}>
          Waffles got a glow-up 🧇
        </div>

        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 9 }}>
          {WHATS_NEW.map((p) => (
            <div key={p.title} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", textAlign: "left" }}>
              <span style={{ fontSize: 22, flexShrink: 0, width: 26, textAlign: "center" }} aria-hidden>{p.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", lineHeight: 1.1 }}>{p.title}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.6)", marginTop: 2, lineHeight: 1.3 }}>{p.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 18px max(20px, env(safe-area-inset-bottom))", position: "relative", zIndex: 1, background: "linear-gradient(180deg, transparent, #0a0a0b 30%)" }}>
        <button type="button" className="cta maple" onClick={onClose} style={{ width: "100%", flex: "none" }}>
          Go get your levels and cook 🔥
        </button>
      </div>
    </div>
  );
};
