"use client";

import { useEffect, useState } from "react";
import { useProto } from "./state";
import { Sheet, Button } from "./shared";
import { TELEGRAM_INVITE_URL } from "@/lib/social";

// Post-purchase entry gate. Shown right after a successful ticket buy instead of
// dropping the player straight into the lobby countdown: it confirms they're in,
// shows the round's timing, and pitches the Telegram so they get pinged when the
// game goes live. Closing it (button or backdrop) enters the lobby.

// "1h 04m" / "9m 32s" / "12s" — a compact, glanceable countdown.
function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export const EntryGateModal = () => {
  const proto = useProto();
  const m = proto.entryModal;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!m) return null;

  // Enter the lobby (the round is already staged in state). Used by the CTA and
  // by tapping the backdrop — either way entry is already secured on-chain.
  const enterLobby = () => {
    proto.update({ entryModal: null });
    proto.goto("lobby");
  };

  const startsIn = m.startsAt - now;
  const live = startsIn <= 0;
  const remaining = live ? Math.max(0, m.endsAt - now) : startsIn;

  return (
    <Sheet ariaLabel="You're in" accent="var(--maple-500)" onClose={enterLobby} zIndex={120}>
      {(close) => (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, margin: "2px auto 14px", borderRadius: 18, background: "rgba(255,210,77,.14)", border: "1px solid rgba(255,210,77,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>🎟️</div>

          <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 28, color: "var(--ink)", lineHeight: 1.1 }}>You&apos;re in!</div>

          {/* Timing pill */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12, background: "rgba(255,210,77,.12)", border: "1px solid rgba(255,210,77,.32)", borderRadius: 999, padding: "7px 14px", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "var(--maple-500)", fontVariantNumeric: "tabular-nums" }}>
            {live ? `🔴 Live now · ${fmtCountdown(remaining)} left` : `⏱️ Starts in ${fmtCountdown(remaining)}`}
          </div>

          {/* Telegram callout */}
          <div style={{ marginTop: 18, background: "var(--surface-2)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, background: "rgba(41,171,226,.15)", border: "1px solid rgba(41,171,226,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✈️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", lineHeight: 1.15 }}>Don&apos;t miss kickoff</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginTop: 2, lineHeight: 1.35 }}>Join our Telegram to get notified when the game goes live.</div>
            </div>
          </div>

          <a
            href={TELEGRAM_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, width: "100%", padding: "12px 0", borderRadius: 12, background: "#229ED9", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 900, fontSize: 14, letterSpacing: 0.3, textDecoration: "none" }}
          >
            ✈️ Join the Telegram
          </a>

          <div style={{ marginTop: 10 }}>
            <Button variant="primary" flex={1} onClick={close} style={{ width: "100%" }}>
              {live ? "Enter game →" : "Go to waiting room →"}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
};
