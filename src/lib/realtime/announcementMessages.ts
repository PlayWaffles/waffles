import type { PlayerAnnouncement } from "@/lib/player/announcements";

export const ANNOUNCEMENTS_ROOM = "announcements";
export const userAnnouncementsRoom = (userId: string) => `user:${userId}`;

export type AnnouncementRealtimeMessage =
  | {
      type: "announcement.delivered";
      announcement: PlayerAnnouncement;
      // When false, the client only merges this into the feed (bell inbox) and
      // does NOT raise the transient top toast. Defaults to true (toast shown).
      // Used for cards that already have their own in-app surface — e.g. a badge
      // unlock shows a full overlay, so it should land silently in the bell.
      toast?: boolean;
    }
  | {
      type: "announcement.removed";
      id: string;
    };
