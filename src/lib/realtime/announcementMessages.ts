import type { PlayerAnnouncement } from "@/lib/player/announcements";

export const ANNOUNCEMENTS_ROOM = "announcements";
export const userAnnouncementsRoom = (userId: string) => `user:${userId}`;

export type AnnouncementRealtimeMessage =
  | {
      type: "announcement.delivered";
      announcement: PlayerAnnouncement;
    }
  | {
      type: "announcement.removed";
      id: string;
    };
