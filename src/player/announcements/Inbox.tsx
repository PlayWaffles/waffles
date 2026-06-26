"use client";

import { useState, type KeyboardEvent } from "react";
import { useProto, type ScreenName } from "../state";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import { TONE, timeAgo, actOnAnnouncement } from "./tone";

// ===== Bell + inbox ===========================================================
// The bell opens a bottom-sheet list of every active announcement. This is the
// persistent home for everything that also flashes by as a toast.

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
              // Toast-category items are informational — the card just shows the
              // body. Nav / small / full items are tappable: navigate or open the
              // detail modal, then close the inbox so the (global) modal is clear.
              const tappable = !!a.cta || a.surface === "small" || a.surface === "full";
              const onOpen = () => {
                actOnAnnouncement(proto, a, sourceScreen);
                closeInbox();
              };
              return (
                <div
                  key={a.id}
                  {...(tappable
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onClick: onOpen,
                        onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } },
                      }
                    : {})}
                  aria-label={`${a.title}. ${a.body}`}
                  style={{ background: "var(--surface-2)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, cursor: tappable ? "pointer" : "default", textAlign: "left" }}
                >
                  <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, background: c.bg, border: `1px solid ${c.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{a.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--ink)", lineHeight: 1.1 }}>{a.title}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-faint)", flexShrink: 0 }}>{timeAgo(a.publishedAt)}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.4 }}>{a.body}</div>
                    {tappable && (
                      <div style={{ marginTop: 10, display: "inline-block", background: "transparent", border: `1.5px solid ${c.bd}`, color: c.fg, borderRadius: 9, padding: "6px 12px", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 0.3 }}>
                        {a.cta ? a.cta.label : "View details"}
                      </div>
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
