// Public surface of the announcement system:
//   • Toast      — the auto-dismissing top slide-down ("disappears"); shown on
//                  live delivery, on any screen.
//   • Bell inbox — the persistent history list of every announcement.
//   • Detail     — tapping a toast/inbox item opens its details as a SmallModal
//                  or FullModal, per the announcement's `surface`.
// One-off modal announcements (migration, season takeover) are declared in
// registry.tsx and driven by <AnnouncementModalHost>.

export { AnnouncementToast } from "./Toast";
export { AnnouncementBell } from "./Inbox";
export { AnnouncementDetail } from "./Detail";
export { AnnouncementModalHost } from "./ModalHost";

// Reusable surface shells + helpers, for authoring new announcements.
export { SmallModal } from "./SmallModal";
export { FullModal, FullModalGlow, FullModalTemplate, type FullModalBullet } from "./FullModal";
export { TONE, type Tone, type Announcement } from "./tone";
export { MODAL_ANNOUNCEMENTS, type ModalAnnouncement } from "./registry";
