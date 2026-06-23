/**
 * Backfill: grandfather existing streaks into the claim-driven model.
 *
 * The daily streak used to advance on every app-open (login). It now advances
 * only when the daily reward is CLAIMED — the streak is reconstructed from the
 * most recent DailyRewardClaim (see src/lib/player/dailyStreak.ts). Users whose
 * `currentStreak` was built up by logging in (but who haven't *claimed* recently)
 * would otherwise reset to 1 on their next claim.
 *
 * To preserve their streak, this seeds ONE synthetic DailyRewardClaim dated
 * YESTERDAY (UTC) with `streak = currentStreak`, so that:
 *   • displayStreak() treats their streak as intact (claimed yesterday), and
 *   • their next claim continues to currentStreak + 1 instead of resetting.
 *
 * ADDITIVE + IDEMPOTENT:
 *   • Only INSERTS rows — never updates or deletes anything.
 *   • Skips users who already have a claim today or yesterday (already safe).
 *   • createMany(skipDuplicates) + the (userId, dayKey) unique guard make re-runs
 *     a no-op.
 *
 * RUN ORDER: deploy the claim-driven code FIRST (so loadState/auth stop bumping
 * currentStreak), then run this once, close to the deploy.
 *
 * SAFE BY DEFAULT: dry-run unless `--commit` is passed.
 *   bunx tsx scripts/backfill-streak-claims.ts            # preview only
 *   bunx tsx scripts/backfill-streak-claims.ts --commit   # write
 */
import { prisma } from "@/lib/db";
import { dayKeyUTC } from "@/lib/player/dailyStreak";

const isCommit = process.argv.includes("--commit");
const isVerbose = process.argv.includes("--verbose");
const TIMEOUT_MS = Number(process.env.BACKFILL_TIMEOUT_MS ?? 120_000);

// Only grandfather streaks worth preserving. A 1-day streak isn't meaningfully
// "lost" (the next claim starts a fresh streak of 1 either way).
const MIN_STREAK = Number(process.env.BACKFILL_MIN_STREAK ?? 2);
const CHUNK = 1_000;

// Marks the row as a synthetic streak-continuity seed, not a real reward grant
// (no tickets/XP were credited for it).
const BACKFILL_REWARD = { kind: "backfill", amount: 0 };

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function main() {
  const now = new Date();
  const today = dayKeyUTC(now);
  const yesterday = dayKeyUTC(new Date(now.getTime() - 86_400_000));

  const candidates = await prisma.user.findMany({
    where: { currentStreak: { gte: MIN_STREAK } },
    select: { id: true, currentStreak: true },
  });

  // Users who already have a claim today or yesterday are already preserved by
  // the new logic — exclude them (and avoid a duplicate yesterday row).
  const recent = new Set<string>();
  for (const ids of chunk(candidates.map((c) => c.id), CHUNK)) {
    const rows = await prisma.dailyRewardClaim.findMany({
      where: { userId: { in: ids }, dayKey: { in: [today, yesterday] } },
      select: { userId: true },
    });
    for (const r of rows) recent.add(r.userId);
  }

  const eligible = candidates.filter((c) => !recent.has(c.id));
  const seedRows = eligible.map((c) => ({
    userId: c.id,
    dayKey: yesterday,
    streak: c.currentStreak,
    reward: BACKFILL_REWARD,
    usedFreeze: false,
  }));

  let inserted = 0;
  if (isCommit) {
    for (const batch of chunk(seedRows, CHUNK)) {
      const res = await prisma.dailyRewardClaim.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += res.count;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: isCommit ? "commit" : "dry-run",
        yesterdayKey: yesterday,
        minStreak: MIN_STREAK,
        candidatesWithStreak: candidates.length,
        alreadyRecent: recent.size,
        eligibleToSeed: eligible.length,
        inserted: isCommit ? inserted : 0,
        sample: seedRows.slice(0, 20).map((r) => ({ userId: r.userId, streak: r.streak })),
        ...(isVerbose ? { allUserIds: seedRows.map((r) => r.userId) } : {}),
      },
      null,
      2,
    ),
  );
}

const timeout = setTimeout(() => {
  console.error(
    `[backfill-streak-claims] Timed out after ${TIMEOUT_MS}ms while waiting for the database`,
  );
  process.exit(1);
}, TIMEOUT_MS);

main()
  .catch((error) => {
    console.error(
      "[backfill-streak-claims]",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(timeout);
    await prisma.$disconnect();
  });
