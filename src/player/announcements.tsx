"use client";

import { useEffect, useRef, useState } from "react";
import { useProto, type Proto, type ScreenName } from "./state";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import type { AnnouncementTone, PlayerAnnouncement } from "@/lib/player/announcements";

// ===== Model + data ===========================================================
// Announcements are surfaced two ways: a dismissable Home banner (the
// highest-priority active one) and an inbox opened from the bell. Both render
// `proto.announcements` — the live, fully DB-backed server feed (authored
// Announcement rows + per-user triggered cards), fetched in state.tsx and
// already filtered to active + sorted by priority. Read/dismissed state is
// DB-backed for authored items and session-only for triggered ones.

type Tone = AnnouncementTone;

export type Announcement = PlayerAnnouncement;

const HOUR = 3_600_000;

const TONE: Record<Tone, { fg: string; bg: string; bd: string }> = {
  maple: { fg: "#FFD24D", bg: "rgba(255,210,77,.12)", bd: "rgba(255,210,77,.32)" },
  berry: { fg: "#FB72FF", bg: "rgba(251,114,255,.12)", bd: "rgba(251,114,255,.32)" },
  leaf: { fg: "#FF9F1C", bg: "rgba(255,159,28,.12)", bd: "rgba(255,159,28,.32)" },
};

const timeAgo = (ts: number) => {
  const h = Math.round((Date.now() - ts) / HOUR);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

// Marks an announcement read and runs its CTA (open the season takeover, or
// navigate to a screen). Shared by the Home banner, the inbox, and the global
// push toast so all three behave identically. `sourceScreen` only tags analytics.
const actOnAnnouncement = (proto: Proto, a: Announcement, sourceScreen: ScreenName) => {
  proto.markAnnouncementsRead([a.id]);
  trackClientEvent(AnalyticsEvent.AnnouncementMarkedRead, {
    announcement_id: a.id,
    announcement_type: a.tone,
    source_screen: sourceScreen,
  });
  if (a.cta?.theme) {
    trackClientEvent(AnalyticsEvent.AnnouncementCtaClicked, {
      announcement_id: a.id,
      announcement_type: a.tone,
      cta_target: a.cta.theme,
      source_screen: sourceScreen,
    });
    proto.update({ wcTakeoverOpen: true });
    return;
  }
  if (a.cta?.screen) {
    trackClientEvent(AnalyticsEvent.AnnouncementCtaClicked, {
      announcement_id: a.id,
      announcement_type: a.tone,
      cta_target: a.cta.screen,
      source_screen: sourceScreen,
    });
    proto.goto(a.cta.screen as ScreenName);
  }
};

// ===== Home banner ============================================================
// Shows the top-priority active announcement the player hasn't dismissed.

export const AnnouncementBanner = () => {
  const proto = useProto();
  const viewedRef = useRef<string | null>(null);
  const top = proto.announcements.find((a) => !proto.annDismissed.includes(a.id));
  useEffect(() => {
    if (!top || viewedRef.current === top.id) return;
    viewedRef.current = top.id;
    trackClientEvent(AnalyticsEvent.AnnouncementBannerViewed, {
      announcement_id: top.id,
      announcement_type: top.tone,
      cta_target: top.cta?.theme ?? top.cta?.screen ?? "none",
      source_screen: proto.screen,
    });
  }, [proto.screen, top]);
  if (!top) return null;
  const c = TONE[top.tone];

  const onOpen = () => {
    trackClientEvent(AnalyticsEvent.AnnouncementBannerOpened, {
      announcement_id: top.id,
      announcement_type: top.tone,
      cta_target: top.cta?.theme ?? top.cta?.screen ?? "none",
      source_screen: proto.screen,
    });
    actOnAnnouncement(proto, top, proto.screen);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 14, padding: "10px 12px" }}>
      <button
        type="button"
        className="pressable"
        onClick={onOpen}
        aria-label={`${top.title}. ${top.body}`}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "transparent", border: 0, padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}
      >
        <span style={{ fontSize: 22, flexShrink: 0 }}>{top.emoji}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", lineHeight: 1.1 }}>{top.title}</span>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.55)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top.cta ? top.cta.label + " ›" : top.body}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          trackClientEvent(AnalyticsEvent.AnnouncementBannerDismissed, {
            announcement_id: top.id,
            announcement_type: top.tone,
            source_screen: proto.screen,
          });
          proto.dismissAnnouncement(top.id);
        }}
        aria-label="Dismiss announcement"
        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 99, border: "none", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        ×
      </button>
    </div>
  );
};

// ===== Global push toast ======================================================
// A pushed announcement (PartyKit realtime) surfaces here as a top slide-down on
// ANY screen, so it isn't missed by players who aren't on Home. It auto-clears
// (timer lives in state.tsx); tapping runs the CTA, × just hides the toast — the
// announcement still lives on in the Home banner + inbox.

export const AnnouncementToast = () => {
  const proto = useProto();
  const a = proto.announcementToast;
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!a || viewedRef.current === a.id) return;
    viewedRef.current = a.id;
    trackClientEvent(AnalyticsEvent.AnnouncementBannerViewed, {
      announcement_id: a.id,
      announcement_type: a.tone,
      cta_target: a.cta?.theme ?? a.cta?.screen ?? "none",
      source_screen: proto.screen,
    });
  }, [a, proto.screen]);
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
    proto.update({ announcementToast: null });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "max(8px, env(safe-area-inset-top))",
        left: 10,
        right: 10,
        zIndex: 130,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "linear-gradient(rgba(20,16,12,.98), rgba(20,16,12,.98))",
        border: `1px solid ${c.bd}`,
        borderRadius: 14,
        padding: "10px 12px",
        boxShadow: "0 10px 30px rgba(0,0,0,.5)",
        animation: "waffles-v2-onb-in .28s var(--ease-out-quart)",
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
        onClick={() => proto.update({ announcementToast: null })}
        aria-label="Dismiss"
        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 99, border: "none", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        ×
      </button>
    </div>
  );
};

// ===== Bell + inbox ===========================================================

export const AnnouncementBell = () => {
  const proto = useProto();
  const [open, setOpen] = useState(false);
  const active = proto.announcements;
  const unread = active.filter((a) => !proto.annRead.includes(a.id)).length;

  const openInbox = () => {
    trackClientEvent(AnalyticsEvent.AnnouncementInboxOpened, {
      source_screen: proto.screen,
      unread_count: unread,
      announcement_count: active.length,
    });
    setOpen(true);
    proto.markAnnouncementsRead(active.map((a) => a.id));
    active.forEach((a) => {
      if (proto.annRead.includes(a.id)) return;
      trackClientEvent(AnalyticsEvent.AnnouncementMarkedRead, {
        announcement_id: a.id,
        announcement_type: a.tone,
        source_screen: proto.screen,
      });
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openInbox}
        aria-label={unread > 0 ? `Announcements, ${unread} unread` : "Announcements"}
        style={{ position: "relative", width: 38, height: 38, borderRadius: 99, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "var(--ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span aria-hidden="true" style={{ position: "absolute", top: 6, right: 7, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 99, background: "var(--live-red)", border: "2px solid var(--surface-deep)", color: "#fff", fontSize: 9, fontWeight: 900, lineHeight: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)" }}>{unread}</span>
        )}
      </button>
      {open && <AnnouncementInbox sourceScreen={proto.screen} onClose={() => setOpen(false)} />}
    </>
  );
};

const AnnouncementInbox = ({ sourceScreen, onClose }: { sourceScreen: ScreenName; onClose: () => void }) => {
  const proto = useProto();
  const active = proto.announcements;
  const closeInbox = () => {
    trackClientEvent(AnalyticsEvent.AnnouncementInboxClosed, {
      source_screen: sourceScreen,
      announcement_count: active.length,
    });
    onClose();
  };
  return (
    <div role="presentation" onClick={closeInbox} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Announcements"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxHeight: "76%", overflow: "auto", background: "var(--surface-1)", borderTop: "2px solid var(--maple-500)", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "18px 16px max(20px, env(safe-area-inset-bottom))" }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(253,251,246,0.2)", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--ink)" }}>Announcements</div>
          <button type="button" onClick={closeInbox} aria-label="Close" style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>Close</button>
        </div>

        {active.length === 0 ? (
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--ink-faint)", padding: "24px 0" }}>You&apos;re all caught up.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {active.map((a) => {
              const c = TONE[a.tone];
              return (
                <div key={a.id} style={{ background: "var(--surface-2)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12 }}>
                  <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, background: c.bg, border: `1px solid ${c.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{a.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--ink)", lineHeight: 1.1 }}>{a.title}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-faint)", flexShrink: 0 }}>{timeAgo(a.publishedAt)}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.4 }}>{a.body}</div>
                    {a.cta && (
                      <button
                        type="button"
                        onClick={() => {
                          trackClientEvent(AnalyticsEvent.AnnouncementCtaClicked, {
                            announcement_id: a.id,
                            announcement_type: a.tone,
                            cta_target: a.cta!.theme ?? a.cta!.screen ?? "none",
                            source_screen: sourceScreen,
                          });
                          if (a.cta!.theme) { proto.update({ wcTakeoverOpen: true }); closeInbox(); return; }
                          if (a.cta!.screen) proto.goto(a.cta!.screen as ScreenName);
                          closeInbox();
                        }}
                        style={{ marginTop: 10, background: "transparent", border: `1.5px solid ${c.bd}`, color: c.fg, borderRadius: 9, padding: "6px 12px", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 0.3, cursor: "pointer" }}
                      >
                        {a.cta.label}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
