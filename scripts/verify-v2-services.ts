/**
 * End-to-end smoke test of the v2 service layer against the live DB.
 * Creates a throwaway user, exercises every economy path, prints results,
 * and cleans up. Proves Phase 4 service logic actually works (not just types).
 *
 *   node --env-file=.env --import tsx scripts/verify-v2-services.ts
 */
const { prisma } = await import("@/lib/db");
const { UserPlatform, TicketLedgerReason } = await import("@prisma");
const ps = await import("@/lib/v2/playerState");
const rounds = await import("@/lib/v2/rounds");
const econ = await import("@/lib/v2/economy");
const missions = await import("@/lib/v2/missions");
const leagues = await import("@/lib/v2/leagues");

const tag = `v2verify-${Date.now()}`;
const user = await prisma.user.create({
  data: {
    platform: UserPlatform.FARCASTER,
    fid: Math.floor(Math.random() * 2_000_000_000),
    inviteCode: tag.slice(0, 24),
    username: "verifier",
  },
  select: { id: true },
});
const uid = user.id;
const ok: string[] = [];
const fail: string[] = [];
const check = (name: string, cond: boolean, detail = "") =>
  (cond ? ok : fail).push(`${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);

try {
  // 1. defaults + load
  const s0 = await ps.loadPlayerState(uid);
  check("load defaults", s0.tickets === 3 && s0.lives === 5 && s0.levelByTrack.standard === 1, `tickets=${s0.tickets} lives=${s0.lives}`);

  // 2. tickets ledger
  const bal = await ps.adjustTickets(uid, 5, TicketLedgerReason.ADMIN_ADJUST);
  check("adjustTickets +5", bal === 8, `balance=${bal}`);
  const ledger = await prisma.ticketLedger.count({ where: { userId: uid } });
  check("ledger row written", ledger === 1);

  // 3. level advance to a milestone (level 5 awards a ticket)
  let last = { level: 1, ticketAwarded: false };
  for (let i = 0; i < 4; i++) last = await ps.advanceLevel(uid, "standard", 10);
  check("advance to L5", last.level === 5 && last.ticketAwarded === true, `level=${last.level} awarded=${last.ticketAwarded}`);

  // 4. lives
  const ll = await ps.loseLife(uid);
  check("loseLife", ll.lives === 4 && ll.nextLifeAt !== null, `lives=${ll.lives}`);
  const rf = await ps.refillLives(uid);
  check("refillLives", rf?.lives === 5, `lives=${rf?.lives} tickets=${rf?.tickets}`);

  // 5. daily reward
  const daily = await econ.claimDailyReward(uid);
  check("claimDaily", daily.claimed === true, daily.claimed ? `roll=${daily.roll.type}:${daily.roll.amount} streak=${daily.streak}` : daily.reason);
  const daily2 = await econ.claimDailyReward(uid);
  check("claimDaily idempotent (same day)", daily2.claimed === false);

  // 6. round: enter, score, settle
  const rid = rounds.roundIdFor(Date.now());
  const enter = await rounds.enterRound(uid, rid, false);
  check("enterRound charges + creates entry", !enter.alreadyEntered && enter.tickets !== null, `tickets=${enter.tickets}`);
  const reenter = await rounds.enterRound(uid, rid, false);
  check("re-enter no double charge", reenter.alreadyEntered === true);
  await rounds.submitRoundScore(uid, rid, 1500);
  const settle = await rounds.settleRound(rid);
  check("settleRound (rank 1 → prize)", settle.settled === 1 && settle.prizes === 1, `settled=${settle.settled} prizes=${settle.prizes}`);
  const winnings = await prisma.winning.count({ where: { userId: uid } });
  check("winning written to prize wallet", winnings === 1);

  // 7. resolve winning (convert → tickets)
  const w = await prisma.winning.findFirstOrThrow({ where: { userId: uid }, select: { id: true, tickets: true } });
  const before = (await prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { ticketBalance: true } })).ticketBalance;
  const res = await ps.resolveWinning(uid, w.id, "convert");
  check("convert winning → tickets", res.tickets === before + w.tickets, `before=${before} +${w.tickets} → ${res.tickets}`);

  // 8. shop purchase (requires seeded catalog: node scripts/seed-v2-shop.ts)
  const balBefore = (await prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { ticketBalance: true } })).ticketBalance;
  const buy = await econ.purchaseShopItem(uid, "pu-5050");
  check("purchase power-up debits tickets", buy.ok === true && buy.tickets === balBefore - 1, buy.ok ? `bal=${buy.tickets}` : `reason=${buy.reason}`);
  const inv = await prisma.powerUpInventory.findUnique({ where: { userId_kind: { userId: uid, kind: "FIFTY_FIFTY" } }, select: { count: true } });
  check("power-up granted to inventory", inv?.count === 1);
  const bundle = await econ.purchaseShopItem(uid, "bundle-5");
  check("bundle purchase blocked (fiat-only)", bundle.ok === false && bundle.reason === "fiat-only");

  // 9. missions (requires seeded quests: scripts/seed-v2-missions-leagues.ts)
  await missions.recordMissionProgress(uid, "daily-answer-3", 3);
  const ms = await missions.loadMissions(uid);
  const m3 = ms.find((m) => m.slug === "daily-answer-3");
  check("mission progress accrues + completes", m3?.done === true && m3?.count === 3, `count=${m3?.count} done=${m3?.done}`);

  // 10. leagues
  const lg = await leagues.loadLeague(uid);
  const member = await prisma.leagueMember.findUnique({ where: { userId_season: { userId: uid, season: lg.season } }, select: { id: true } });
  check("league tier resolved + membership persisted", typeof lg.key === "string" && !!member, `tier=${lg.key} season=${lg.season} pts=${lg.points}`);

  // 11. claim winning → on-chain USDT payout amount recorded (10 tickets = 1 USDT = 1e6 units)
  const w2 = await prisma.winning.create({ data: { userId: uid, rank: 1, tickets: 10 }, select: { id: true } });
  await ps.resolveWinning(uid, w2.id, "claim");
  const claimed = await prisma.winning.findUniqueOrThrow({ where: { id: w2.id }, select: { status: true, merkleAmount: true } });
  check("claim records USDT payout units", claimed.status === "CLAIMED" && claimed.merkleAmount === "1000000", `amount=${claimed.merkleAmount}`);
} finally {
  // Cascade-deletes ledger, progress, entries, winnings, daily claims, etc.
  await prisma.user.delete({ where: { id: uid } });
}

console.log(`\n${ok.join("\n")}`);
if (fail.length) console.log(`\nFAILURES:\n${fail.join("\n")}`);
console.log(`\n${fail.length ? "❌" : "✅"} ${ok.length}/${ok.length + fail.length} checks passed`);

await prisma.$disconnect();
if (fail.length) process.exit(1);

export {};
