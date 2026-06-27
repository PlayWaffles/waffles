import { prisma } from "@/lib/db";
import { themeLabel } from "@/lib/player/roundQuestions";
import { getDisplayName } from "@/lib/address";
import { avatarIdForSeed, isAvatarId } from "@/lib/avatars";
import { UserPlatform } from "@prisma";
import type { WrappedData } from "@/components/wrapped/WrappedCard";

// Same-origin pixel-avatar path (mirrors player/shared's resolveAvatar, but pure
// so it runs server-side without pulling the client module).
function avatarPath(avatarId: string | null | undefined, seed: string): string {
  const id = isAvatarId(avatarId) ? avatarId : avatarIdForSeed(seed || "waffles");
  return `/images/player/optimized/avatar-${id}.webp`;
}

/**
 * Real "Waffles Wrapped" stats for a calendar month. Scoped to MiniPay (Celo,
 * USDT) per our analytics convention — and the prize figures are USDT, so mixing
 * platforms/currencies would be wrong. Defaults to the current month-to-date.
 */

const PLATFORM = UserPlatform.MINIPAY;

const fmt = (n: number) => n.toLocaleString("en-US");
const usdt = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} USDT`;
const usdtWhole = (n: number) => `${Math.round(n)} USDT`;

export async function getMonthlyWrapped(reference: Date = new Date()): Promise<WrappedData> {
  const monthStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const now = reference;
  const monthLabel = monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const realGame = { platform: PLATFORM, onchainId: { not: null } } as const;
  // A tournament "ran" if it actually had paid players (the cron also creates
  // empty rounds, which would inflate the count and read as "N run · 0 players").
  const gameWhere = { ...realGame, startsAt: { gte: monthStart, lte: now }, playerCount: { gt: 0 } };
  // Paid entries for real MiniPay games this month.
  const entryWhere = { paidAt: { not: null, gte: monthStart, lte: now }, game: realGame };
  // Prizes settled this month.
  const prizeWhere = { prize: { gt: 0 }, game: { ...realGame, rankedAt: { gte: monthStart, lte: now } } };

  const [tournaments, playerGroups, answeredAgg, paidoutAgg, biggestAgg, themeGroups, topEarners] = await Promise.all([
    prisma.game.count({ where: gameWhere }),
    prisma.gameEntry.groupBy({ by: ["userId"], where: entryWhere }),
    prisma.gameEntry.aggregate({ _sum: { answered: true }, where: entryWhere }),
    prisma.gameEntry.aggregate({ _sum: { prize: true }, where: prizeWhere }),
    prisma.gameEntry.aggregate({ _max: { prize: true }, where: prizeWhere }),
    prisma.game.groupBy({ by: ["theme"], where: gameWhere, _count: { theme: true }, orderBy: { _count: { theme: "desc" } } }),
    prisma.gameEntry.groupBy({ by: ["userId"], where: prizeWhere, _sum: { prize: true }, orderBy: { _sum: { prize: "desc" } }, take: 1 }),
  ]);

  const players = playerGroups.length;
  const answered = answeredAgg._sum.answered ?? 0;
  const paidout = paidoutAgg._sum.prize ?? 0;
  const biggest = biggestAgg._max.prize ?? 0;

  const topTheme = themeGroups[0];
  const topThemeShare = topTheme && tournaments > 0 ? Math.round((topTheme._count.theme / tournaments) * 100) : 0;
  const topCategory = topTheme ? themeLabel(topTheme.theme) : "—";

  let topPlayer: WrappedData["topPlayer"] = null;
  const earner = topEarners[0];
  if (earner && (earner._sum.prize ?? 0) > 0) {
    const user = await prisma.user.findUnique({ where: { id: earner.userId }, select: { username: true, wallet: true, avatarId: true } });
    topPlayer = {
      name: getDisplayName({ username: user?.username ?? null, wallet: user?.wallet ?? null }),
      detail: `${usdt(earner._sum.prize ?? 0)} won`,
      avatar: avatarPath(user?.avatarId, user?.username || user?.wallet || earner.userId),
    };
  }

  return {
    monthLabel,
    stats: [
      { asset: "ticket", value: fmt(tournaments), label: "tournaments run", color: "leaf" },
      { asset: "players", value: fmt(players), label: "players", color: "cyan" },
      { asset: "coin", value: usdtWhole(paidout), label: "paid out in prizes", color: "gold" },
      { asset: "gem", value: fmt(answered), label: "questions answered", color: "berry" },
      { asset: "football", value: topCategory, label: tournaments > 0 ? `top category · ${topThemeShare}%` : "top category", color: "green" },
      { asset: "trophy", value: usdt(biggest), label: "biggest single win", color: "gold" },
    ],
    topPlayer,
  };
}
