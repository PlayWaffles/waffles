"use client";

import { ASSETS, PixelImg } from "../../shared";
import { FullModal, FullModalGlow } from "../FullModal";

// Full-page "what's new" takeover for the big rebuild. One-time per device
// (localStorage-gated in the registry). Content is the published announcement.

const SECTIONS: { icon: string; title: string; text: string }[] = [
  {
    icon: "🎬",
    title: "A brand-new welcome",
    text: "First-timers now get to try a real question, then pick how to start — a free Rookie Cup or jump straight into a live cash round. No more guessing what Waffles is about.",
  },
  {
    icon: "🆓",
    title: "The Rookie Cup",
    text: "Your first tournament is on us — a free intro round with a guaranteed win and Syrup to get you going. Available right from Home until you've played it.",
  },
  {
    icon: "🏆",
    title: "Tournaments, reimagined",
    text: "A new round every 4 hours, alternating World Cup football and General mixed-trivia (movies, anime, crypto and more). Entry is now $0.10 so tournament prizes can be bigger, and faster correct answers win — plus a skill-edge head start based on how far you've climbed. More winners: the top half of every round walks away with Syrup, and if you're in the top 10, you win cash!",
  },
  {
    icon: "📊",
    title: "A real Leaderboard",
    text: "The old Compete tab is now a proper Leaderboard, with two boards: Tournament (This game · Top Earners ranked by USDT won · Past games, with everyone's winnings in USDT) and Practice (climb the ranks by total XP). Questions are no longer repetitive and are now varied based on your current level.",
  },
  {
    icon: "🎯",
    title: 'Levels are now "Practice"',
    text: "Renamed and reworked: you get 10 free practice plays a day, and every tournament you enter adds more. Warm up solo any time — correct answers now light up green, the way they should.",
  },
  {
    icon: "🔔",
    title: "Notifications that actually reach you (MiniPay)",
    text: "Live in-app alerts when a round goes live, when results land, when someone passes you on the board, and when you unlock a badge — no more missing the action.",
  },
  {
    icon: "✨",
    title: "Quality-of-life",
    text: "A nudge to try a live tournament after your practice runs (if you haven't played one that day), a cleaner Home with a quick follow-us-on-X link and a tidier missions preview, and smoother MiniPay payments — better handling of funding, gas, and network mismatches (one-tap Add Cash when you're short).",
  },
];

export const UpdateBody = ({ onClose }: { onClose: () => void }) => (
  <FullModal
    ariaLabel="Waffles update — what's new"
    background="linear-gradient(180deg, #181206 0%, #0a0a0b 100%)"
    zIndex={95}
    decoration={<FullModalGlow />}
    footerStyle={{ background: "linear-gradient(180deg, transparent, #0a0a0b 30%)" }}
    footer={
      <button type="button" className="cta maple" onClick={onClose} style={{ width: "100%", flex: "none" }}>
        Let&apos;s cook 🔥
      </button>
    }
  >
    <PixelImg
      src={ASSETS.chestRainbow}
      size={88}
      alt=""
      style={{ filter: "drop-shadow(0 0 26px rgba(255,210,77,.5))", marginBottom: 6 }}
    />
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, color: "var(--maple-500)", textTransform: "uppercase", marginBottom: 8 }}>
      Big update
    </div>
    <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 30, lineHeight: 1.06, color: "#fff", marginBottom: 10 }}>
      Waffles just got a huge update 🧇
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.62)", lineHeight: 1.45, maxWidth: 320, marginBottom: 18 }}>
      We know you complained a lot about how buggy and complex the new update was —
      so we made a few changes. We rebuilt the core of the experience; here&apos;s
      everything that&apos;s new.
    </div>
    <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 9 }}>
      {SECTIONS.map((s, i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "11px 14px", textAlign: "left" }}
        >
          <span style={{ fontSize: 22, flexShrink: 0, width: 26, textAlign: "center", marginTop: 1 }} aria-hidden>{s.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", lineHeight: 1.15 }}>{s.title}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.6)", marginTop: 3, lineHeight: 1.4 }}>{s.text}</div>
          </div>
        </div>
      ))}
    </div>
  </FullModal>
);
