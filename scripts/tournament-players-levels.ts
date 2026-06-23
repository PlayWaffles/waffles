/**
 * Report: every MiniPay player who has entered a paid tournament, with their
 * current level on each track (Standard + World Cup).
 *
 * "Tournament player" = a user with at least one PAID GameEntry in a MiniPay
 * on-chain tournament game. "Current level" = their LevelProgress.level per
 * track (defaults to 1 if they've never played that track's campaign).
 *
 * READ-ONLY: no writes. Sorted by best tournament finish (rank 1 first), then by
 * number of entries.
 *
 *   bunx tsx scripts/tournament-players-levels.ts          # aligned table
 *   bunx tsx scripts/tournament-players-levels.ts --json   # full JSON
 *   bunx tsx scripts/tournament-players-levels.ts --csv    # CSV to stdout
 */
import { prisma } from "@/lib/db";
import { LevelTrack, UserPlatform } from "@prisma";

const asJson = process.argv.includes("--json");
const asCsv = process.argv.includes("--csv");
const TIMEOUT_MS = Number(process.env.REPORT_TIMEOUT_MS ?? 120_000);
const CHUNK = 1_000;

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

type Row = {
  userId: string;
  username: string;
  entries: number;
  bestRank: number | null;
  lastEntryAt: Date | null;
  standardLevel: number;
  worldCupLevel: number;
};

async function main() {
  // One paid-tournament group per distinct user: entry count, best (lowest) rank,
  // and most recent entry time.
  const grouped = await prisma.gameEntry.groupBy({
    by: ["userId"],
    where: {
      paidAt: { not: null },
      game: { platform: UserPlatform.MINIPAY, onchainId: { not: null } },
    },
    _count: { _all: true },
    _min: { rank: true },
    _max: { paidAt: true },
  });

  const ids = grouped.map((g) => g.userId);

  // Usernames + per-track levels, chunked so the IN lists stay bounded.
  const nameById = new Map<string, string>();
  const levelByUser = new Map<string, { standard: number; worldCup: number }>();
  for (const batch of chunk(ids, CHUNK)) {
    const [users, levels] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: batch } }, select: { id: true, username: true } }),
      prisma.levelProgress.findMany({
        where: { userId: { in: batch } },
        select: { userId: true, track: true, level: true },
      }),
    ]);
    for (const u of users) nameById.set(u.id, u.username?.trim() || "—");
    for (const lp of levels) {
      const cur = levelByUser.get(lp.userId) ?? { standard: 1, worldCup: 1 };
      if (lp.track === LevelTrack.STANDARD) cur.standard = lp.level;
      else if (lp.track === LevelTrack.WORLD_CUP) cur.worldCup = lp.level;
      levelByUser.set(lp.userId, cur);
    }
  }

  const rows: Row[] = grouped
    .map((g) => {
      const lvl = levelByUser.get(g.userId) ?? { standard: 1, worldCup: 1 };
      return {
        userId: g.userId,
        username: nameById.get(g.userId) ?? "—",
        entries: g._count._all,
        bestRank: g._min.rank ?? null,
        lastEntryAt: g._max.paidAt ?? null,
        standardLevel: lvl.standard,
        worldCupLevel: lvl.worldCup,
      };
    })
    .sort((a, b) => {
      // Best finish first (nulls last), then most entries.
      const ra = a.bestRank ?? Number.POSITIVE_INFINITY;
      const rb = b.bestRank ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return b.entries - a.entries;
    });

  if (asJson) {
    console.log(JSON.stringify({ totalPlayers: rows.length, players: rows }, null, 2));
    return;
  }

  if (asCsv) {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    console.log("username,entries,bestRank,standardLevel,worldCupLevel,lastEntryAt,userId");
    for (const r of rows) {
      console.log(
        [
          esc(r.username),
          r.entries,
          r.bestRank ?? "",
          r.standardLevel,
          r.worldCupLevel,
          r.lastEntryAt?.toISOString() ?? "",
          r.userId,
        ].join(","),
      );
    }
    return;
  }

  // Aligned table.
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  const padL = (s: string, n: number) => s.padStart(n);
  console.log(`MiniPay tournament players: ${rows.length}\n`);
  console.log(
    `${pad("PLAYER", 22)} ${padL("ENTRIES", 7)} ${padL("BEST", 5)} ${padL("STD", 4)} ${padL("WC", 4)}`,
  );
  console.log("-".repeat(22 + 1 + 7 + 1 + 5 + 1 + 4 + 1 + 4));
  for (const r of rows) {
    console.log(
      `${pad(r.username, 22)} ${padL(String(r.entries), 7)} ${padL(r.bestRank ? `#${r.bestRank}` : "—", 5)} ${padL(String(r.standardLevel), 4)} ${padL(String(r.worldCupLevel), 4)}`,
    );
  }
}

const timeout = setTimeout(() => {
  console.error(`[tournament-players-levels] Timed out after ${TIMEOUT_MS}ms while waiting for the database`);
  process.exit(1);
}, TIMEOUT_MS);

main()
  .catch((error) => {
    console.error("[tournament-players-levels]", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(timeout);
    await prisma.$disconnect();
  });
