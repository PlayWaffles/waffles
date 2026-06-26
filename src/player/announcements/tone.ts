"use client";

// Shared model + helpers for the announcement surfaces (Toast, Banner, Inbox,
// SmallModal, FullModal). The feed surfaces (toast/banner/inbox) all render
// `proto.announcements` — the DB-backed server feed fetched in state.tsx,
// already filtered to active + sorted by priority.

import type { Proto, ScreenName } from "../state";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import type { AnnouncementTone, PlayerAnnouncement } from "@/lib/player/announcements";

export type Tone = AnnouncementTone;
export type Announcement = PlayerAnnouncement;

const HOUR = 3_600_000;

// Accent palette shared by every surface so a "berry" toast and a "berry"
// inbox card read identically. `fg` = text/icon, `bg` = chip fill, `bd` = border.
export const TONE: Record<Tone, { fg: string; bg: string; bd: string }> = {
  maple: { fg: "#FFD24D", bg: "rgba(255,210,77,.12)", bd: "rgba(255,210,77,.32)" },
  berry: { fg: "#FB72FF", bg: "rgba(251,114,255,.12)", bd: "rgba(251,114,255,.32)" },
  leaf: { fg: "#FF9F1C", bg: "rgba(255,159,28,.12)", bd: "rgba(255,159,28,.32)" },
};

export const timeAgo = (ts: number) => {
  const h = Math.round((Date.now() - ts) / HOUR);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

// Marks an announcement read and runs its CTA (open the season takeover, or
// navigate to a screen). Shared by the Home banner, the inbox, and the global
// push toast so all three behave identically. `sourceScreen` only tags analytics.
export const actOnAnnouncement = (proto: Proto, a: Announcement, sourceScreen: ScreenName) => {
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
  if (a.cta?.sheet === "daily") {
    trackClientEvent(AnalyticsEvent.AnnouncementCtaClicked, {
      announcement_id: a.id,
      announcement_type: a.tone,
      cta_target: "sheet:daily",
      source_screen: sourceScreen,
    });
    // The daily-reward/streak sheet is a global overlay (proto.dailyOpen), not a
    // screen — open it directly so it surfaces on whatever screen the player's on.
    proto.update({ dailyOpen: true });
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
    return;
  }
  // A modal-surface announcement reveals its details as a modal (rendered
  // globally, so it opens on any screen — including mid-game from the toast).
  // A "toast" announcement is informational: tapping just marks it read.
  if (a.surface === "small" || a.surface === "full") {
    trackClientEvent(AnalyticsEvent.AnnouncementCtaClicked, {
      announcement_id: a.id,
      announcement_type: a.tone,
      cta_target: `open:${a.surface}`,
      source_screen: sourceScreen,
    });
    proto.update({ announcementDetail: a });
  }
};
