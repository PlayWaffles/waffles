"use client";

import { useEffect, useState } from "react";
import { useProto } from "../state";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import { TONE, actOnAnnouncement } from "./tone";

// ===== Global push toast — the "disappears" surface ==========================
// A pushed announcement (PartyKit realtime) surfaces here as a top slide-down on
// ANY screen, so it isn't missed by players who aren't on Home. It auto-clears
// (timer lives in state.tsx); tapping runs the CTA, × just hides the toast — the
// announcement still lives on in the Home banner + inbox.

const TOAST_HOLD_MS = 5000; // visible time before it auto-lifts away
const TOAST_EXIT_MS = 280; // must match the exit keyframe duration

export const AnnouncementToast = () => {
  const proto = useProto();
  const update = proto.update; // memoized in the provider — stable across renders
  const a = proto.announcementToast;
  // The id currently animating out. `leaving` is derived, so a fresh toast (new
  // id) is automatically in the entering state — no setState reset needed.
  const [exitingId, setExitingId] = useState<string | null>(null);
  const leaving = !!a && exitingId === a.id;

  // New toast: log the view and start the visible-hold timer. Keyed on the id so
  // it restarts cleanly when one push replaces another.
  useEffect(() => {
    if (!a) return;
    trackClientEvent(AnalyticsEvent.AnnouncementBannerViewed, {
      announcement_id: a.id,
      announcement_type: a.tone,
      cta_target: a.cta?.theme ?? a.cta?.screen ?? "none",
      source_screen: proto.screen,
    });
    const hold = setTimeout(() => setExitingId(a.id), TOAST_HOLD_MS);
    return () => clearTimeout(hold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  // Once the exit animation has played, drop the payload from state.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => {
      update({ announcementToast: null });
      setExitingId(null);
    }, TOAST_EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving, update]);

  if (!a) return null;
  const c = TONE[a.tone];

  const onTap = () => {
    trackClientEvent(AnalyticsEvent.AnnouncementBannerOpened, {
      announcement_id: a.id,
      announcement_type: a.tone,
      cta_target: a.cta?.theme ?? a.cta?.screen ?? "none",
      source_screen: proto.screen,
    });
    actOnAnnouncement(proto, a, proto.screen);
    setExitingId(a.id);
  };

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: "max(8px, env(safe-area-inset-top))",
        left: 10,
        right: 10,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "linear-gradient(rgba(20,16,12,.98), rgba(20,16,12,.98))",
        border: `1px solid ${c.bd}`,
        borderRadius: 14,
        padding: "10px 12px",
        boxShadow: "0 10px 30px rgba(0,0,0,.5)",
        animation: leaving
          ? `waffles-v2-toast-out ${TOAST_EXIT_MS}ms var(--ease-out-quart) forwards`
          : "waffles-v2-toast-in .3s var(--ease-out-quart)",
      }}
    >
      <button
        type="button"
        className="pressable"
        onClick={onTap}
        aria-label={`${a.title}. ${a.body}`}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "transparent", border: 0, padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}
      >
        <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: c.bg, border: `1px solid ${c.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>{a.emoji}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", lineHeight: 1.1 }}>{a.title}</span>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.6)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.cta ? a.cta.label + " ›" : a.body}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => setExitingId(a.id)}
        aria-label="Dismiss"
        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 99, border: "none", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        ×
      </button>
    </div>
  );
};
