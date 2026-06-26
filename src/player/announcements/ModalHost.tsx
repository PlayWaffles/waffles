"use client";

import { useEffect, useRef, useState } from "react";
import { useProto } from "../state";
import { MODAL_ANNOUNCEMENTS, type ModalAnnouncement } from "./registry";

// ===== Modal announcement host ===============================================
// Owns every full/small modal announcement: resolves each one's auto-open gate
// (once, on Home), picks the highest-precedence eligible one, and persists its
// "seen" state on close. Replaces the per-modal state + render ternary that used
// to live in the player page. `onActiveChange` lets the page suppress lower-
// priority overlays (daily reward, league result, coach marks) while one is up.

export const AnnouncementModalHost = ({
  enabled,
  onActiveChange,
}: {
  /** True once onboarding is done — gates the auto-show checks. */
  enabled: boolean;
  /** Pass a stable setter (e.g. a useState dispatch) — called when active flips. */
  onActiveChange?: (active: boolean) => void;
}) => {
  const proto = useProto();
  const onHome = proto.screen === "home";

  // Server gate results, keyed by slug. A missing key = not yet resolved.
  const [notice, setNotice] = useState<Record<string, boolean>>({});
  const fetched = useRef<Set<string>>(new Set());
  // Entries closed this session — don't auto-reopen them.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Resolve each entry's auto-open gate once, on Home, after onboarding.
  useEffect(() => {
    if (!enabled || !onHome) return;
    for (const e of MODAL_ANNOUNCEMENTS) {
      if (fetched.current.has(e.slug)) continue;
      fetched.current.add(e.slug);
      e.getNotice()
        .then((r) => setNotice((n) => ({ ...n, [e.slug]: r.show })))
        .catch(() => setNotice((n) => ({ ...n, [e.slug]: false })));
    }
  }, [enabled, onHome]);

  // Pick the active modal: the first entry (by precedence) that's either opened
  // on-demand or auto-eligible. A still-resolving earlier gate holds later
  // auto-opens so a higher-precedence modal never flashes in afterwards.
  let active: ModalAnnouncement | null = null;
  let activeIsAuto = false;
  let earlierUnresolved = false;
  for (const e of MODAL_ANNOUNCEMENTS) {
    const protoOpen = e.protoOpen?.(proto) ?? false;
    const autoEligible =
      !earlierUnresolved &&
      enabled &&
      onHome &&
      notice[e.slug] === true &&
      !dismissed.has(e.slug) &&
      (!e.suppressWhilePendingJoin || !proto.pendingTournamentJoin);
    if (protoOpen || autoEligible) {
      active = e;
      activeIsAuto = !protoOpen;
      break;
    }
    if (!(e.slug in notice)) earlierUnresolved = true;
  }

  // Tell the parent whether a modal is up (entry refs are module-stable, so this
  // only fires on a real change).
  useEffect(() => {
    onActiveChange?.(active != null);
  }, [active, onActiveChange]);

  // Fire each entry's auto-open analytics once.
  const autoLogged = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (active && activeIsAuto && !autoLogged.current.has(active.slug)) {
      autoLogged.current.add(active.slug);
      active.onAutoOpen?.();
    }
  }, [active, activeIsAuto]);

  if (!active) return null;
  const entry = active;

  const close = () => {
    setDismissed((d) => new Set(d).add(entry.slug));
    entry.onCloseProto?.(proto);
    void entry.dismiss();
  };

  return <>{entry.render(close)}</>;
};
