import type { PlayerAnnouncement } from "@/lib/player/announcements";
import {
  ANNOUNCEMENTS_ROOM,
  type AnnouncementRealtimeMessage,
  userAnnouncementsRoom,
} from "@/lib/realtime/announcementMessages";

function partyHost() {
  const host = process.env.PARTYKIT_HOST ?? process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (!host?.trim()) {
    throw new Error("Missing PARTYKIT_HOST or NEXT_PUBLIC_PARTYKIT_HOST for realtime announcement delivery.");
  }
  return host.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function partySecret() {
  const secret = process.env.PARTYKIT_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing PARTYKIT_SECRET for realtime announcement delivery.");
  }
  return secret;
}

async function deliverToRoom(room: string, message: AnnouncementRealtimeMessage) {
  // The room name is used verbatim by the client (PartySocket connects to
  // `/parties/main/user:<id>` with a RAW colon) and PartyServer derives the
  // Durable Object id from the raw path segment. encodeURIComponent() would turn
  // the colon into `%3A`, routing this POST to a DIFFERENT DO than the one the
  // client is connected to — the broadcast would land in an empty room and never
  // reach the player. So the path segment must match the client's exactly (raw).
  const response = await fetch(`https://${partyHost()}/parties/main/${room}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-waffles-party-secret": partySecret(),
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PartyKit announcement delivery failed (${response.status}): ${body.slice(0, 300)}`);
  }
}

export async function deliverGlobalAnnouncement(announcement: PlayerAnnouncement) {
  await deliverToRoom(ANNOUNCEMENTS_ROOM, {
    type: "announcement.delivered",
    announcement,
  });
}

export async function deliverAnnouncementToUsers(
  userIds: string[],
  announcement: PlayerAnnouncement,
) {
  const rooms = Array.from(new Set(userIds)).map(userAnnouncementsRoom);
  await Promise.all(
    rooms.map((room) =>
      deliverToRoom(room, {
        type: "announcement.delivered",
        announcement,
      }),
    ),
  );
}

export async function removeGlobalAnnouncement(id: string) {
  await deliverToRoom(ANNOUNCEMENTS_ROOM, {
    type: "announcement.removed",
    id,
  });
}
