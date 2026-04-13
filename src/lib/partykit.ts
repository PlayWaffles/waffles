"use server";

import PartySocket from "partysocket";
import { env } from "@/lib/env";

const SERVICE = "partykit-client";

export interface StoredPartyChatMessage {
  id: string;
  text: string;
  username: string;
  pfp: string | null;
  ts: number;
}

// ==========================================
// HELPER
// ==========================================

function partyFetch(
  gameId: string,
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: unknown;
  },
) {
  const host = env.partykitHost;
  const method = options?.method ?? "POST";

  console.log("[" + SERVICE + "]", "fetch_request", {
    gameId,
    path,
    host,
    room: `game-${gameId}`,
    method,
  });

  return PartySocket.fetch(
    {
      host,
      room: `game-${gameId}`,
      party: "main",
      path,
    },
    {
      method,
      headers: {
        Authorization: `Bearer ${env.partykitSecret}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(options?.body ?? {}) } : {}),
    },
  );
}

// ==========================================
// FUNCTIONS
// ==========================================

/**
 * Initialize a PartyKit room for a new game.
 * THROWS on failure - caller must handle rollback.
 */
export async function initGameRoom(
  gameId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<void> {
  if (!env.partykitHost || !env.partykitSecret) {
    throw new Error("PartyKit not configured");
  }

  console.log("[" + SERVICE + "]", "init_room_request", {
    gameId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  const res = await partyFetch(gameId, "init", {
    method: "POST",
    body: {
      gameId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    console.error("[" + SERVICE + "]", "init_room_failed", {
      gameId,
      status: res.status,
      error: errorText,
    });
    throw new Error(`PartyKit init failed: ${errorText}`);
  }

  console.log("[" + SERVICE + "]", "init_room_success", { gameId });
}

/**
 * Notify PartyKit of a ticket purchase.
 * Broadcasts both stats update and entrant addition atomically.
 */
export async function notifyTicketPurchased(
  gameId: string,
  data: {
    username: string;
    pfpUrl: string | null;
    prizePool: number;
    playerCount: number;
  },
): Promise<void> {
  if (!env.partykitHost || !env.partykitSecret) {
    console.warn("[" + SERVICE + "]", "notify_ticket_purchased_skipped", {
      gameId,
      reason: "PartyKit not configured",
    });
    return;
  }

  try {
    const res = await partyFetch(gameId, "ticket-purchased", {
      method: "POST",
      body: data,
    });

    if (res.ok) {
      console.log("[" + SERVICE + "]", "notify_ticket_purchased_success", {
        gameId,
        username: data.username,
        prizePool: data.prizePool,
        playerCount: data.playerCount,
      });
    } else {
      console.error("[" + SERVICE + "]", "notify_ticket_purchased_failed", {
        gameId,
        status: res.status,
        statusText: res.statusText,
      });
    }
  } catch (err) {
    console.error("[" + SERVICE + "]", "notify_ticket_purchased_error", {
      gameId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Broadcast a stats-only update without adding an entrant.
 */
export async function notifyGameStatsUpdated(
  gameId: string,
  data: {
    prizePool: number;
    playerCount: number;
  },
): Promise<void> {
  if (!env.partykitHost || !env.partykitSecret) {
    console.warn("[" + SERVICE + "]", "notify_game_stats_skipped", {
      gameId,
      reason: "PartyKit not configured",
    });
    return;
  }

  try {
    const res = await partyFetch(gameId, "update-stats", {
      method: "POST",
      body: data,
    });

    if (!res.ok) {
      console.error("[" + SERVICE + "]", "notify_game_stats_failed", {
        gameId,
        status: res.status,
        statusText: res.statusText,
      });
      return;
    }

    console.log("[" + SERVICE + "]", "notify_game_stats_success", {
      gameId,
      prizePool: data.prizePool,
      playerCount: data.playerCount,
    });
  } catch (err) {
    console.error("[" + SERVICE + "]", "notify_game_stats_error", {
      gameId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Cleanup PartyKit room when a game is deleted.
 * Notifies the PartyKit server to close connections and free resources.
 */
export async function cleanupGameRoom(gameId: string): Promise<void> {
  if (!env.partykitHost || !env.partykitSecret) {
    console.warn("[" + SERVICE + "]", "cleanup_skipped", {
      gameId,
      reason: "PartyKit not configured",
    });
    return;
  }

  try {
    console.log("[" + SERVICE + "]", "cleanup_request", { gameId });

    const res = await partyFetch(gameId, "cleanup", {
      method: "POST",
      body: {
        reason: "game_deleted",
      },
    });

    if (res.ok) {
      console.log("[" + SERVICE + "]", "cleanup_success", { gameId });
    } else {
      console.warn("[" + SERVICE + "]", "cleanup_failed", {
        gameId,
        status: res.status,
      });
    }
  } catch (err) {
    // Don't throw - cleanup is best-effort
    console.error("[" + SERVICE + "]", "cleanup_error", {
      gameId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Update game timing in PartyKit storage and reschedule alarms.
 * THROWS on failure - caller must handle error.
 */
export async function updateGame(
  gameId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<void> {
  if (!env.partykitHost || !env.partykitSecret) {
    throw new Error("PartyKit not configured");
  }

  console.log("[partykit] update_game_request", {
    gameId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  const res = await partyFetch(gameId, "update-game", {
    method: "POST",
    body: {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    console.error("[partykit] update_game_failed", {
      gameId,
      status: res.status,
      error: errorText,
    });
    throw new Error(`PartyKit update failed: ${errorText}`);
  }

  console.log("[partykit] update_game_success", { gameId });
}

export async function getStoredChatHistory(
  gameId: string,
): Promise<StoredPartyChatMessage[]> {
  if (!env.partykitHost || !env.partykitSecret) {
    return [];
  }

  try {
    const res = await partyFetch(gameId, "chat-history", { method: "GET" });
    if (!res.ok) {
      console.warn("[partykit] chat_history_failed", {
        gameId,
        status: res.status,
      });
      return [];
    }

    const data = (await res.json()) as {
      messages?: StoredPartyChatMessage[];
    };

    return Array.isArray(data.messages) ? data.messages : [];
  } catch (error) {
    console.error("[partykit] chat_history_error", {
      gameId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
