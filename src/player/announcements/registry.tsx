"use client";

import type { ReactNode } from "react";
import type { Proto } from "../state";
import { resolveThemeId } from "../theme";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import {
  getMigrationNotice,
  dismissMigrationNotice,
  getWorldCupTakeover,
  dismissWorldCupTakeover,
} from "@/player/api";
import { MigrationBody } from "./bodies/migration";
import { WorldCupBody } from "./bodies/world-cup";

// ===== Modal announcement registry ===========================================
// One entry per full-screen / small-modal announcement. To add a new one, append
// an entry here — <AnnouncementModalHost> handles the gating, precedence and
// persistence. Order = precedence (earlier wins when more than one is eligible).

export type ModalAnnouncement = {
  /** Stable id, matches the DB Announcement.slug used for persistence. */
  slug: string;
  /** Render the surface (full or small modal). `close` persists + dismisses. */
  render: (close: () => void) => ReactNode;
  /** Server gate: should this auto-open for the user? Fetched once on Home. */
  getNotice: () => Promise<{ show: boolean }>;
  /** Persist "seen/dismissed" (idempotent). Runs on close. */
  dismiss: () => Promise<void> | void;
  /** Open on-demand from global state (e.g. a bell-CTA flag), on any screen. */
  protoOpen?: (proto: Proto) => boolean;
  /** Clear the on-demand flag on close. */
  onCloseProto?: (proto: Proto) => void;
  /** Hold the auto-open while an onboarding tournament-join intent is pending. */
  suppressWhilePendingJoin?: boolean;
  /** Fired once when the entry auto-opens (not on an on-demand open). */
  onAutoOpen?: () => void;
};

export const MODAL_ANNOUNCEMENTS: ModalAnnouncement[] = [
  {
    // One-time "welcome to v2" for migrated users. Highest precedence so it never
    // stacks under the season takeover.
    slug: "v2-migration-welcome",
    render: (close) => <MigrationBody onClose={close} />,
    getNotice: getMigrationNotice,
    dismiss: dismissMigrationNotice,
  },
  {
    // Season welcome. Auto-shows once; the announcement bell reopens it via the
    // `wcTakeoverOpen` flag. Suppressed during the onboarding→join funnel so it
    // never covers the buy sheet.
    slug: "world-cup-takeover",
    render: (close) => <WorldCupBody onClose={close} />,
    getNotice: getWorldCupTakeover,
    dismiss: dismissWorldCupTakeover,
    protoOpen: (p) => p.wcTakeoverOpen,
    onCloseProto: (p) => p.update({ wcTakeoverOpen: false }),
    suppressWhilePendingJoin: true,
    onAutoOpen: () =>
      trackClientEvent(AnalyticsEvent.WorldCupTakeoverAutoOpened, {
        screen: "home",
        theme_id: resolveThemeId(),
        entry_reason: "first_visit",
      }),
  },
];
