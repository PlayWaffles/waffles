import { parseArgs } from "node:util";
import PartySocket from "partysocket";
import { SignJWT } from "jose";
import type { ChatItem, Message } from "../shared/protocol";
import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";

type GameRecord = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  platform: string;
  network: string;
};

type UserRef = {
  id: string;
  username: string | null;
};

function normalizeUsername(username: string | null | undefined) {
  return username?.trim().replace(/^@/, "").toLowerCase() ?? null;
}

async function createPartyToken() {
  return new SignJWT({
    userId: "partykit-chat-backfill",
    platform: "FARCASTER",
    fid: 999999999,
    username: "chat-backfill-bot",
    pfpUrl: null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(env.partykitSecret));
}

async function fetchSyncChat(gameId: string, timeoutMs: number) {
  const token = await createPartyToken();

  return new Promise<ChatItem[]>((resolve, reject) => {
    const socket = new PartySocket({
      host: env.partykitHost,
      party: "main",
      room: `game-${gameId}`,
      query: { token },
    });

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out waiting for sync from room game-${gameId}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("error", onError);
      socket.removeEventListener("close", onClose);
    };

    const finish = (fn: () => void) => {
      cleanup();
      socket.close();
      fn();
    };

    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(String(event.data)) as Message;
        if (message.type === "sync") {
          finish(() => resolve(message.chat));
        }
      } catch (error) {
        finish(() =>
          reject(
            error instanceof Error
              ? error
              : new Error("Failed to parse PartyKit sync payload"),
          ),
        );
      }
    };

    const onError = () => {
      finish(() => reject(new Error(`PartyKit socket error for room game-${gameId}`)));
    };

    const onClose = () => {
      finish(() =>
        reject(new Error(`PartyKit room game-${gameId} closed before sync arrived`)),
      );
    };

    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onError);
    socket.addEventListener("close", onClose);
  });
}

async function resolveGame(gameId?: string, title?: string): Promise<GameRecord | null> {
  if (gameId) {
    return prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        platform: true,
        network: true,
      },
    });
  }

  if (title) {
    return prisma.game.findFirst({
      where: { title },
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        platform: true,
        network: true,
      },
    });
  }

  return prisma.game.findFirst({
    where: { endsAt: { lt: new Date() } },
    orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      platform: true,
      network: true,
    },
  });
}

async function resolveGames(gameId?: string, title?: string, all?: boolean) {
  if (all) {
    return prisma.game.findMany({
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        platform: true,
        network: true,
      },
    });
  }

  const game = await resolveGame(gameId, title);
  return game ? [game] : [];
}

function addUserRef(
  map: Map<string, string[]>,
  username: string | null | undefined,
  userId: string,
) {
  const key = normalizeUsername(username);
  if (!key) return;
  const existing = map.get(key) ?? [];
  if (!existing.includes(userId)) {
    existing.push(userId);
    map.set(key, existing);
  }
}

function buildGlobalUserMap(users: UserRef[]) {
  const usersByUsername = new Map<string, string[]>();
  for (const user of users) {
    addUserRef(usersByUsername, user.username, user.id);
  }
  return usersByUsername;
}

async function main() {
  const { values } = parseArgs({
    options: {
      "game-id": { type: "string" },
      title: { type: "string" },
      all: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      timeout: { type: "string", default: "10000" },
    },
  });

  if (!env.partykitHost || !env.partykitSecret) {
    throw new Error("PartyKit is not configured");
  }

  const games = await resolveGames(values["game-id"], values.title, values.all);
  if (games.length === 0) {
    throw new Error("No matching game found");
  }

  const globalUsers = await prisma.user.findMany({
    where: { username: { not: null } },
    select: {
      id: true,
      username: true,
    },
  });
  const globalUsersByUsername = buildGlobalUserMap(globalUsers);

  const summaries = [];

  for (const game of games) {
    try {
      const syncChat = await fetchSyncChat(game.id, Number(values.timeout));

      const [entries, existingChats] = await Promise.all([
        prisma.gameEntry.findMany({
          where: { gameId: game.id },
          select: {
            userId: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        }),
        prisma.chat.findMany({
          where: { gameId: game.id },
          select: {
            userId: true,
            text: true,
            createdAt: true,
          },
        }),
      ]);

      const usersByUsername = new Map<string, string[]>();
      for (const entry of entries) {
        addUserRef(usersByUsername, entry.user.username, entry.userId);
      }

      const existingKeys = new Set(
        existingChats.map(
          (chat) => `${chat.userId}|${chat.text}|${chat.createdAt.toISOString()}`,
        ),
      );

      const unresolved: ChatItem[] = [];
      const duplicates: ChatItem[] = [];
      const inserts: Array<{ gameId: string; userId: string; text: string; createdAt: Date }> =
        [];

      for (const message of syncChat) {
        const key = normalizeUsername(message.username);
        const entryMatches = key ? usersByUsername.get(key) ?? [] : [];
        const globalMatches = key ? globalUsersByUsername.get(key) ?? [] : [];
        const matchingUsers =
          entryMatches.length === 1
            ? entryMatches
            : globalMatches.length === 1
              ? globalMatches
              : entryMatches;

        if (matchingUsers.length !== 1) {
          unresolved.push(message);
          continue;
        }

        const userId = matchingUsers[0];
        const createdAt = new Date(message.ts);
        const dedupeKey = `${userId}|${message.text}|${createdAt.toISOString()}`;

        if (existingKeys.has(dedupeKey)) {
          duplicates.push(message);
          continue;
        }

        existingKeys.add(dedupeKey);
        inserts.push({
          gameId: game.id,
          userId,
          text: message.text,
          createdAt,
        });
      }

      if (!values["dry-run"] && inserts.length > 0) {
        await prisma.chat.createMany({
          data: inserts,
        });
      }

      summaries.push({
        game,
        syncCount: syncChat.length,
        insertedCount: values["dry-run"] ? 0 : inserts.length,
        wouldInsertCount: inserts.length,
        duplicateCount: duplicates.length,
        unresolvedCount: unresolved.length,
        unresolved: unresolved.map((message) => ({
          id: message.id,
          username: message.username,
          text: message.text,
          ts: new Date(message.ts).toISOString(),
        })),
      });
    } catch (error) {
      summaries.push({
        game,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        totalGames: games.length,
        processedGames: summaries.length,
        summaries,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      "[backfill-partykit-chat]",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
