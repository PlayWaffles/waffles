"use client";

import { useState } from "react";
import { useProto, type ScreenName } from "./state";
import { type ThemeId } from "./theme";

// ===== Model + data ===========================================================
// Announcements are surfaced two ways for the MVP: a dismissable Home banner
// (the highest-priority active one) and an inbox opened from the bell. Both read
// from the same active list; read/dismissed state lives in proto (persisted to
// localStorage). In production this list would come from remote config so news
// ships without an app release.

type Tone = "maple" | "berry" | "leaf";

export type Announcement = {
  id: string;
  priority: number; // higher wins the banner slot
  tone: Tone;
  emoji: string;
  title: string;
  body: string;
  // A CTA either navigates to a screen, or (for a season like the World Cup)
  // opens that season's full-page welcome via the `theme` tag.
  cta?: { label: string; screen?: ScreenName; theme?: ThemeId };
  publishedAt: number;
  startsAt: number;
  endsAt: number;
};

const HOUR = 3_600_000;
const NOW = Date.now();
const FAR_FUTURE = NOW + 365 * 24 * HOUR;

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "world-cup-season",
    priority: 40,
    tone: "leaf",
    emoji: "⚽",
    title: "The World Cup is here",
    body: "Football trivia, live every hour, with real prizes on the line. See what's new this season.",
    cta: { label: "See what's new", theme: "world-cup" },
    publishedAt: NOW - 1 * HOUR,
    startsAt: 0,
    endsAt: FAR_FUTURE,
  },
  {
    id: "prize-wallet",
    priority: 30,
    tone: "leaf",
    emoji: "💸",
    title: "Cash out your winnings",
    body: "Tournament prizes are paid in USDT. Claim them anytime from your new Prize Wallet.",
    cta: { label: "Open Prize Wallet", screen: "profile" },
    publishedAt: NOW - 2 * HOUR,
    startsAt: 0,
    endsAt: FAR_FUTURE,
  },
  {
    id: "double-xp-weekend",
    priority: 20,
    tone: "berry",
    emoji: "⚡",
    title: "Double XP weekend",
    body: "Every tournament you play this weekend earns 2× XP. Climb the leagues faster.",
    cta: { label: "Play now", screen: "home" },
    publishedAt: NOW - 26 * HOUR,
    startsAt: 0,
    endsAt: FAR_FUTURE,
  },
  {
    id: "prize-pool-boost",
    priority: 10,
    tone: "maple",
    emoji: "🏆",
    title: "Prize pool boosted",
    body: "Top of the Hour now pays out up to 25 tickets — finish Top 100 to win.",
    publishedAt: NOW - 50 * HOUR,
    startsAt: 0,
    endsAt: FAR_FUTURE,
  },
];

// Active = inside its [startsAt, endsAt] window. Sorted highest-priority first.
// We intentionally do NOT hide a theme-activation announcement once its theme is
// active: it's the persistent entry point to the full-page takeover, so removing
// it would make that content unreachable (there's no UI to leave the theme).
export function activeAnnouncements(at: number = Date.now()): Announcement[] {
  return ANNOUNCEMENTS.filter((a) => at >= a.startsAt && at <= a.endsAt).sort((a, b) => b.priority - a.priority);
}

const TONE: Record<Tone, { fg: string; bg: string; bd: string }> = {
  maple: { fg: "#FFC931", bg: "rgba(255,201,49,.12)", bd: "rgba(255,201,49,.32)" },
  berry: { fg: "#FB72FF", bg: "rgba(251,114,255,.12)", bd: "rgba(251,114,255,.32)" },
  leaf: { fg: "#00CFF2", bg: "rgba(0,207,242,.12)", bd: "rgba(0,207,242,.32)" },
};

const timeAgo = (ts: number) => {
  const h = Math.round((Date.now() - ts) / HOUR);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

// ===== Home banner ============================================================
// Shows the top-priority active announcement the player hasn't dismissed.

export const AnnouncementBanner = () => {
  const proto = useProto();
  const top = activeAnnouncements().find((a) => !proto.annDismissed.includes(a.id));
  if (!top) return null;
  const c = TONE[top.tone];

  const onOpen = () => {
    proto.markAnnouncementsRead([top.id]);
    // A season CTA opens that season's full-page welcome.
    if (top.cta?.theme) {
      proto.update({ wcTakeoverOpen: true });
      return;
    }
    if (top.cta?.screen) proto.goto(top.cta.screen);
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
        onClick={() => proto.dismissAnnouncement(top.id)}
        aria-label="Dismiss announcement"
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
  const active = activeAnnouncements();
  const unread = active.filter((a) => !proto.annRead.includes(a.id)).length;

  const openInbox = () => {
    setOpen(true);
    proto.markAnnouncementsRead(active.map((a) => a.id));
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
      {open && <AnnouncementInbox onClose={() => setOpen(false)} />}
    </>
  );
};

const AnnouncementInbox = ({ onClose }: { onClose: () => void }) => {
  const proto = useProto();
  const active = activeAnnouncements();
  return (
    <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
          <button type="button" onClick={onClose} aria-label="Close" style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>Close</button>
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
                          if (a.cta!.theme) { proto.update({ wcTakeoverOpen: true }); onClose(); return; }
                          if (a.cta!.screen) proto.goto(a.cta!.screen);
                          onClose();
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
