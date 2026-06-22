"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PixelImg, resolveAvatar } from "@/player/shared";
import live from "./live.module.css";

// ---------------------------------------------------------------------------
// Live-activity lab — ways to show "people are buying tickets right now" on the
// Home page. Strip vs bubble vs alternatives, all animated with real avatars.
// ---------------------------------------------------------------------------

const FEED = [
  { name: "Maya", seed: "maya-7", action: "just bought a ticket" },
  { name: "Leo", seed: "leo-3", action: "joined World Cup Royale" },
  { name: "Ada", seed: "ada-9", action: "is in for the next round" },
  { name: "Kai", seed: "kai-2", action: "just bought a ticket" },
  { name: "Zoe", seed: "zoe-5", action: "bought 3 tickets" },
  { name: "Sam", seed: "sam-1", action: "just bought a ticket" },
  { name: "Ria", seed: "ria-8", action: "joined World Cup Royale" },
  { name: "Tom", seed: "tom-4", action: "just bought a ticket" },
];

/** Steps an index 0..len-1 every `ms`. SSR-stable (starts at 0). */
function useCycle(len: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % len), ms);
    return () => clearInterval(id);
  }, [len, ms]);
  return i;
}

const Pfp = ({ seed, size = 22 }: { seed: string; size?: number }) => (
  <PixelImg src={resolveAvatar(null, seed)} size={size} alt="" style={{ borderRadius: 99, objectFit: "cover", background: "#1c1c1f", border: "2px solid #0b0b0c", flexShrink: 0 }} />
);

const LiveDot = ({ color = "var(--leaf)" }: { color?: string }) => (
  <span style={{ width: 7, height: 7, borderRadius: 99, background: color, boxShadow: `0 0 0 3px ${color}33`, flexShrink: 0, animation: "waffles-v2-pulse 1.5s infinite" }} />
);

// ===========================================================================
// 1 — Scrolling ticker strip (top of home, full width, continuous)
// ===========================================================================
function ScrollingStrip() {
  const loop = [...FEED, ...FEED];
  return (
    <div style={{ overflow: "hidden", borderRadius: 99, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", padding: "6px 0", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)" }}>
      <div className={live.marquee}>
        {loop.map((e, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "0 12px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.65)" }}>
            <Pfp seed={e.seed} size={19} />
            <span style={{ color: "#fff" }}>{e.name}</span> {e.action}
            <span style={{ color: "var(--maple-500)", marginLeft: 8 }}>•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// 2 — Rotating strip (one message at a time, swaps every few seconds)
// ===========================================================================
function RotatingStrip() {
  const i = useCycle(FEED.length, 2600);
  const e = FEED[i];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", padding: "8px 12px", overflow: "hidden" }}>
      <LiveDot />
      <div key={i} className={live.swap} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.65)" }}>
        <Pfp seed={e.seed} size={22} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: "#fff" }}>{e.name}</span> {e.action}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "var(--leaf)", textTransform: "uppercase", flexShrink: 0 }}>Live</span>
    </div>
  );
}

// ===========================================================================
// 3 — Toast bubble (pops in over the home content, auto-dismisses, cycles)
// ===========================================================================
function BubbleToast() {
  const i = useCycle(FEED.length, 3800);
  const e = FEED[i];
  return (
    <div key={i} className={live.bubble} style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(18,18,20,.97)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "8px 13px 8px 8px", boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
      <Pfp seed={e.seed} size={32} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{e.name}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>{e.action}</div>
      </div>
    </div>
  );
}

// ===========================================================================
// 4 — Live burst pill (alternative): a persistent counter + a new face that
//     pops into the stack on every purchase. Less intrusive than a toast,
//     always visible unlike a strip.
// ===========================================================================
function LiveBurstPill() {
  const i = useCycle(FEED.length, 1800);
  // The "front" face is the latest buyer; the rest trail behind it.
  const order = [FEED[i], FEED[(i + 1) % FEED.length], FEED[(i + 2) % FEED.length], FEED[(i + 3) % FEED.length]];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, borderRadius: 99, background: "linear-gradient(180deg, rgba(255,201,49,.14), rgba(255,201,49,.05))", border: "1px solid rgba(255,201,49,.28)", padding: "5px 13px 5px 6px" }}>
      <div style={{ display: "flex" }}>
        {order.map((e, idx) => (
          <span key={`${i}-${idx}`} className={idx === 0 ? live.pop : undefined} style={{ marginLeft: idx === 0 ? 0 : -9, zIndex: order.length - idx, display: "inline-flex" }}>
            <Pfp seed={e.seed} size={24} />
          </span>
        ))}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <LiveDot color="#FC1919" />
        <span><span style={{ fontFamily: "var(--font-fredoka)" }}>37</span> bought this hour</span>
      </span>
    </div>
  );
}

// ===========================================================================
// ★ Combined — rotating strip + the burst pill's pop. Each new buyer's avatar
//   pops into the stack while their message swaps in, with a live count.
// ===========================================================================
function CombinedStrip() {
  const i = useCycle(FEED.length, 2400);
  const e = FEED[i];
  const stack = [FEED[i], FEED[(i + 1) % FEED.length], FEED[(i + 2) % FEED.length]];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", padding: "7px 12px", overflow: "hidden" }}>
      <LiveDot color="#FC1919" />
      <div style={{ display: "flex", flexShrink: 0 }}>
        {stack.map((p, idx) => (
          <span key={`${i}-${idx}`} className={idx === 0 ? live.pop : undefined} style={{ marginLeft: idx === 0 ? 0 : -9, zIndex: stack.length - idx, display: "inline-flex" }}>
            <Pfp seed={p.seed} size={23} />
          </span>
        ))}
      </div>
      <div key={i} className={live.swap} style={{ minWidth: 0, flex: 1, fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <span style={{ color: "#fff" }}>{e.name}</span> {e.action}
      </div>
    </div>
  );
}

// ===========================================================================
// Context frame — a faux Home top so placement reads in situ.
// ===========================================================================
function HomeFrame({ top, float }: { top?: ReactNode; float?: ReactNode }) {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 360, borderRadius: 22, background: "#0b0b0c", border: "1px solid rgba(255,255,255,.06)", padding: 14, minHeight: 250, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-fredoka)", fontSize: 15, color: "#fff", letterSpacing: 0.5 }}>WAFFLES</span>
        <span style={{ width: 26, height: 26, borderRadius: 99, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }} />
      </div>
      {top}
      {/* faded card silhouette for context */}
      <div style={{ marginTop: top ? 12 : 0, height: 132, borderRadius: 16, background: "linear-gradient(180deg, #131314, #0f0f10)", border: "1px solid rgba(255,255,255,.05)", opacity: 0.65 }} />
      {float}
    </div>
  );
}

// ===========================================================================
function Slot({ tag, name, note, children }: { tag: string; name: string; note: string; children: ReactNode }) {
  return (
    <div style={{ width: "100%", maxWidth: 380 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-fredoka)", fontSize: 13, color: "var(--maple-500)" }}>{tag}</span>
        <span style={{ fontFamily: "var(--font-fredoka)", fontSize: 15, color: "#fff" }}>{name}</span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.4, color: "rgba(255,255,255,.45)", fontWeight: 600 }}>{note}</p>
      {children}
    </div>
  );
}

export default function LiveActivityPreview() {
  return (
    <div className="waffles-v2" data-theme="world-cup" style={{ minHeight: "100dvh", background: "#000", padding: "32px 20px 80px", fontFamily: "var(--font-fredoka), Fredoka, ui-rounded, system-ui, sans-serif" }}>
      <header style={{ maxWidth: 1100, margin: "0 auto 28px" }}>
        <h1 style={{ fontFamily: "var(--font-fredoka)", fontSize: 30, color: "#fff", margin: 0 }}>Live activity — buying social proof</h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>
          Four ways to show people are buying tickets right now. Live-animated with real avatars.
        </p>
      </header>
      {/* Featured: the chosen combined direction */}
      <div style={{ maxWidth: 380, margin: "0 auto 36px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--font-fredoka)", fontSize: 13, color: "var(--maple-500)" }}>★</span>
          <span style={{ fontFamily: "var(--font-fredoka)", fontSize: 15, color: "#fff" }}>Combined (chosen)</span>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.4, color: "rgba(255,255,255,.45)", fontWeight: 600 }}>Rotating message + the burst pop: a new face pops into the stack as each buyer&apos;s line swaps in, with the live hourly count.</p>
        <HomeFrame top={<CombinedStrip />} />
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,.35)", textTransform: "uppercase", marginBottom: 16 }}>Reference — the pieces it combines</div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28, justifyItems: "center" }}>
        <Slot tag="1" name="Scrolling strip" note="Full-width ticker at the top of home, scrolling continuously. Highest volume of names; ambient, easy to ignore.">
          <HomeFrame top={<ScrollingStrip />} />
        </Slot>
        <Slot tag="2" name="Rotating strip" note="One message at a time, swaps every ~2.5s. Calmer than a scroller, each name gets a beat. Reads cleanly.">
          <HomeFrame top={<RotatingStrip />} />
        </Slot>
        <Slot tag="3" name="Toast bubble" note="Pops in over content, auto-dismisses, cycles. Most attention-grabbing — but interruptive if too frequent.">
          <HomeFrame float={<div style={{ position: "absolute", left: 14, bottom: 14 }}><BubbleToast /></div>} />
        </Slot>
        <Slot tag="4" name="Live burst pill" note="Alternative: a persistent counter where a new face pops into the stack on each buy. Always visible, not interruptive.">
          <HomeFrame top={<div style={{ display: "flex" }}><LiveBurstPill /></div>} />
        </Slot>
      </div>
    </div>
  );
}
