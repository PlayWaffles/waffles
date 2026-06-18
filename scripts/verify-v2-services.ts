/**
 * End-to-end smoke test of the v2 service layer against the live DB.
 * Creates a throwaway user, exercises every economy path, prints results,
 * and cleans up. Proves Phase 4 service logic actually works (not just types).
 *
 *   node --env-file=.env --import tsx scripts/verify-v2-services.ts
 */
const { prisma } = await import("@/lib/db");
const { UserPlatform, TicketLedgerReason } = await import("@prisma");
const ps = await import("@/lib/player/playerState");
const econ = await import("@/lib/player/economy");
const missions = await import("@/lib/player/missions");
const leagues = await import("@/lib/player/leagues");
const partners = await import("@/lib/player/partnerOffers");
const seasonPass = await import("@/lib/player/seasonPass");
const roundQ = await import("@/lib/player/roundQuestions");
const scoring = await import("@/lib/player/scoring");

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

  // Server-authoritative scoring: the issued question set is deterministic, and
  // scores are recomputed from submitted answers (never client-posted).
  const rid = Math.floor(Date.now() / (60 * 60 * 1000)) * 60 * 60 * 1000;
  const issued = await roundQ.getRoundScorableSet(rid);
  check("round issues an authoritative question set", issued.length > 0, `issued=${issued.length}`);
  const perfectMax = issued.reduce((s, q) => s + scoring.maxScoreForQuestion(q), 0);

  // Answer every question correctly, instantly (responseMs 0) → theoretical max.
  const perfectAnswers = issued.map((q) => ({
    id: q.id,
    responseMs: 0,
    selection:
      q.kind === "multi" ? q.correctSet
      : q.kind === "order" ? q.correctOrder
      : [q.correct],
  }));
  // Anti-cheat: an inflated/forged submission can't beat the honest max.
  const forged = scoring.scoreRound(issued, [
    { id: "does-not-exist", selection: [0], responseMs: 0 }, // unknown id → ignored
    ...perfectAnswers,
    ...perfectAnswers, // replayed duplicates → counted once
  ]);
  check("scoreRound caps at max + ignores forged/replayed answers", forged === perfectMax, `forged=${forged} max=${perfectMax}`);

  // Wrong/timeout answers score 0 (and never go negative on non-minefield).
  const zeroed = scoring.scoreRound(issued, issued.map((q) => ({ id: q.id, selection: [], responseMs: 0 })));
  check("scoreRound floors empty answers at >= 0", zeroed >= 0, `zeroed=${zeroed}`);

  // Solo level questions also come from the DB now (no local bank).
  const lvlStd = await roundQ.getLevelClientQuestions("standard", 1);
  check("level questions served from DB (standard)", lvlStd.length > 0 && lvlStd.every((q) => q.id && q.answers.length > 0), `n=${lvlStd.length}`);
  const lvlWc = await roundQ.getLevelClientQuestions("world-cup", 1);
  check("level questions served from DB (world-cup)", lvlWc.length > 0, `n=${lvlWc.length}`);

  // 7. resolve winning (convert → tickets)
  const w = await prisma.winning.create({ data: { userId: uid, rank: 1, tickets: 10 }, select: { id: true, tickets: true } });
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

  // 12. announcement read/dismiss (FK to seeded Announcement — must not throw)
  await ps.setAnnouncementRead(uid, ["world-cup-season"]);
  await ps.setAnnouncementDismissed(uid, "prize-wallet");
  const st = await ps.loadPlayerState(uid);
  check("announcement read/dismiss persists (FK ok)", st.annRead.includes("world-cup-season") && st.annDismissed.includes("prize-wallet"));

  // 13. streak freeze purchase
  const fz = await econ.buyStreakFreeze(uid);
  check("buy streak freeze (tickets + freeze)", fz !== null && fz.freezes >= 1, `freezes=${fz?.freezes} tickets=${fz?.tickets}`);

  // 14. bundle top-up
  const bb = await econ.buyBundle(uid, "bundle-25");
  check("bundle top-up credits tickets", bb !== null && (bb?.tickets ?? 0) > 0, `tickets=${bb?.tickets}`);

  // 15. badge unlock persistence
  await ps.recordBadge(uid, "first-win");
  const badges = await prisma.userBadge.count({ where: { userId: uid } });
  check("badge unlock persists", badges === 1);

  // 16. power-ups: load + consume (FIFTY_FIFTY was granted by the pu-5050 purchase)
  const pu = await econ.loadPowerUps(uid);
  check("load power-ups (50/50 owned)", pu.FIFTY_FIFTY === 1, `5050=${pu.FIFTY_FIFTY}`);
  const c1 = await econ.consumePowerUp(uid, "FIFTY_FIFTY");
  check("consume power-up decrements", c1.ok === true && c1.remaining === 0, `ok=${c1.ok} left=${c1.remaining}`);
  const c2 = await econ.consumePowerUp(uid, "FIFTY_FIFTY");
  check("consume when empty fails", c2.ok === false);

  // 17. league ladder: DB-backed tiers + reward chests + season end
  check("league ladder returns 11 tiers", lg.tiers.length === 11, `n=${lg.tiers.length}`);
  const appr1 = lg.tiers.find((t) => t.key === "apprentice1");
  check("league tier carries reward chests", !!appr1 && appr1.rewards.length === 3, `rewards=${appr1?.rewards.length}`);
  check("league season ends in the future", lg.seasonEndsAt > Date.now());

  // 18. partner offers: load + one-time claim credits tickets
  const offers0 = await partners.loadPartnerOffers(uid);
  check("partner offers load (>=6)", offers0.length >= 6, `n=${offers0.length}`);
  const beforeOffer = (await prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { ticketBalance: true } })).ticketBalance;
  const pc1 = await partners.claimPartnerOffer(uid, "duolingo-lesson");
  check("partner claim credits tickets", pc1.ok === true && pc1.tickets === beforeOffer + 3, `ok=${pc1.ok} bal=${pc1.tickets}`);
  const pc2 = await partners.claimPartnerOffer(uid, "duolingo-lesson");
  check("partner re-claim rejected", pc2.ok === false && pc2.reason === "already");
  const offers1 = await partners.loadPartnerOffers(uid);
  check("partner offer marked claimed", offers1.find((o) => o.slug === "duolingo-lesson")?.claimed === true);

  // 19. season pass: load + free-reward claim (tier 1 free = +50 XP)
  const sp0 = await seasonPass.loadSeasonPass(uid);
  check("season pass level >= 1", sp0.level >= 1, `lvl=${sp0.level}`);
  const xpBefore = (await prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { xp: true } })).xp;
  const sc1 = await seasonPass.claimSeasonReward(uid, 1, false);
  check("season free claim ok (xp credited)", sc1.ok === true && sc1.xp === xpBefore + 50, `ok=${sc1.ok} xp=${sc1.xp}`);
  const sc2 = await seasonPass.claimSeasonReward(uid, 1, false);
  check("season re-claim rejected", sc2.ok === false && sc2.reason === "already");
  const sc3 = await seasonPass.claimSeasonReward(uid, 1, true);
  check("season premium claim rejected (VIP)", sc3.ok === false && sc3.reason === "premium");
  const sp1 = await seasonPass.loadSeasonPass(uid);
  check("season claim persists", sp1.claimed.some((c) => c.tier === 1 && !c.premium));
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
