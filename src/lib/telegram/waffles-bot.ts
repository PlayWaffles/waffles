import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const TELEGRAM_API_ROOT = "https://api.telegram.org";
const MAX_WINNERS = 5;

type TelegramSendMessageResponse =
  | { ok: true; result: { message_id: number } }
  | { ok: false; description?: string; error_code?: number };

type GameStartAnnouncement = {
  id: string;
  gameNumber: number;
  title: string;
  startsAt: Date;
  endsAt: Date;
  prizePool: number;
  playerCount: number;
  maxPlayers: number;
};

type WinnerAnnouncement = {
  rank: number | null;
  prize: number | null;
  score: number;
  user: { username: string | null };
};

type GameResultAnnouncement = GameStartAnnouncement & {
  winners: WinnerAnnouncement[];
};

function requireTelegramConfig() {
  if (!env.telegramBotToken || !env.telegramGroupChatId) {
    throw new Error("Waffles Bot is not configured: TELEGRAM_BOT_TOKEN and TELEGRAM_GROUP_CHAT_ID are required");
  }

  return {
    botToken: env.telegramBotToken,
    chatId: env.telegramGroupChatId,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatUsd(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function gameUrl() {
  return `${env.rootUrl}${env.homeUrlPath}`;
}

function usernameFor(winner: WinnerAnnouncement) {
  return winner.user.username?.trim() || "Unknown player";
}

function startMessage(game: GameStartAnnouncement) {
  const lines = [
    `<b>Waffles Bot</b>`,
    ``,
    `<b>${escapeHtml(game.title)}</b> is live now.`,
    `Players: ${game.playerCount}/${game.maxPlayers}`,
    `Prize pool: ${formatUsd(game.prizePool)}`,
    `Ends: ${formatTime(game.endsAt)}`,
    ``,
    `<a href="${escapeHtml(gameUrl())}">Play Waffles</a>`,
  ];

  return lines.join("\n");
}

function resultsMessage(game: GameResultAnnouncement) {
  const winnerLines = game.winners.slice(0, MAX_WINNERS).map((winner) => {
    const rank = winner.rank ? `#${winner.rank}` : "#-";
    const prize = winner.prize && winner.prize > 0 ? ` - ${formatUsd(winner.prize)}` : "";
    return `${rank} ${escapeHtml(usernameFor(winner))}${prize}`;
  });

  const lines = [
    `<b>Waffles Bot</b>`,
    ``,
    `<b>${escapeHtml(game.title)}</b> has ended.`,
    `Prize pool: ${formatUsd(game.prizePool)}`,
    ``,
    winnerLines.length > 0 ? `<b>Winners</b>\n${winnerLines.join("\n")}` : `No prize winners this round.`,
    ``,
    `<a href="${escapeHtml(gameUrl())}">See results</a>`,
  ];

  return lines.join("\n");
}

async function sendTelegramMessage(text: string) {
  const { botToken, chatId } = requireTelegramConfig();
  const response = await fetch(`${TELEGRAM_API_ROOT}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = (await response.json().catch(() => null)) as TelegramSendMessageResponse | null;
  if (!response.ok || !data?.ok) {
    const description = data && "description" in data ? data.description : response.statusText;
    throw new Error(`Telegram sendMessage failed: ${description || "unknown error"}`);
  }

  return data.result.message_id;
}

async function claimStartedAnnouncement(gameId: string) {
  const claimedAt = new Date();
  const result = await prisma.game.updateMany({
    where: { id: gameId, telegramStartedAt: null },
    data: { telegramStartedAt: claimedAt },
  });

  return result.count === 1 ? claimedAt : null;
}

async function releaseStartedAnnouncement(gameId: string, claimedAt: Date) {
  await prisma.game.updateMany({
    where: { id: gameId, telegramStartedAt: claimedAt },
    data: { telegramStartedAt: null },
  });
}

async function claimResultsAnnouncement(gameId: string) {
  const claimedAt = new Date();
  const result = await prisma.game.updateMany({
    where: { id: gameId, telegramResultsAt: null },
    data: { telegramResultsAt: claimedAt },
  });

  return result.count === 1 ? claimedAt : null;
}

async function releaseResultsAnnouncement(gameId: string, claimedAt: Date) {
  await prisma.game.updateMany({
    where: { id: gameId, telegramResultsAt: claimedAt },
    data: { telegramResultsAt: null },
  });
}

export async function sendTelegramGameStarted(gameId: string) {
  const claimedAt = await claimStartedAnnouncement(gameId);
  if (!claimedAt) return false;

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        gameNumber: true,
        title: true,
        startsAt: true,
        endsAt: true,
        prizePool: true,
        playerCount: true,
        maxPlayers: true,
      },
    });

    if (!game) throw new Error(`Game ${gameId} not found for Telegram start announcement`);
    await sendTelegramMessage(startMessage(game));
    return true;
  } catch (error) {
    await releaseStartedAnnouncement(gameId, claimedAt);
    throw error;
  }
}

export async function sendTelegramGameResults(gameId: string) {
  const claimedAt = await claimResultsAnnouncement(gameId);
  if (!claimedAt) return false;

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        gameNumber: true,
        title: true,
        startsAt: true,
        endsAt: true,
        prizePool: true,
        playerCount: true,
        maxPlayers: true,
        entries: {
          where: { prize: { gt: 0 } },
          select: {
            rank: true,
            prize: true,
            score: true,
            user: { select: { username: true } },
          },
          orderBy: { rank: "asc" },
          take: MAX_WINNERS,
        },
      },
    });

    if (!game) throw new Error(`Game ${gameId} not found for Telegram results announcement`);
    await sendTelegramMessage(resultsMessage({ ...game, winners: game.entries }));
    return true;
  } catch (error) {
    await releaseResultsAnnouncement(gameId, claimedAt);
    throw error;
  }
}

export async function sendDueTelegramGameStartedAnnouncements(limit = 20) {
  const now = new Date();
  const games = await prisma.game.findMany({
    where: {
      telegramStartedAt: null,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    select: { id: true },
    orderBy: { startsAt: "asc" },
    take: limit,
  });

  let sent = 0;
  for (const game of games) {
    if (await sendTelegramGameStarted(game.id)) sent++;
  }

  return sent;
}

export async function sendDueTelegramGameResultAnnouncements(limit = 20) {
  const games = await prisma.game.findMany({
    where: {
      telegramResultsAt: null,
      rankedAt: { not: null },
    },
    select: { id: true },
    orderBy: { rankedAt: "asc" },
    take: limit,
  });

  let sent = 0;
  for (const game of games) {
    if (await sendTelegramGameResults(game.id)) sent++;
  }

  return sent;
}
