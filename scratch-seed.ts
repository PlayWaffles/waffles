import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserPlatform, GameNetwork, GameTheme, LevelTrack } from "@prisma";

const pool = new PrismaPg({ connectionString: process.env.SEED_DB_URL! });
const prisma = new PrismaClient({ adapter: pool });

const wallet = (n: number) => "0x" + n.toString(16).padStart(40, "0");

async function main() {
  // --- Users (MINIPAY) ---
  const defs = [
    { key: "alice", username: "Trinityy", xp: 3200, std: 7, wc: 4, score: 9785, prize: 4.0 },
    { key: "bob", username: "stacked_blitz", xp: 2600, std: 5, wc: 6, score: 9667, prize: 2.5 },
    { key: "carol", username: "shaddy06", xp: 1500, std: 3, wc: 3, score: 8184, prize: 0 },
    { key: "me", username: "thecyberverse", xp: 740, std: 2, wc: 1, score: 741, prize: 0 },
  ];

  const ids: Record<string, string> = {};
  let i = 1;
  for (const d of defs) {
    const u = await prisma.user.create({
      data: {
        platform: UserPlatform.MINIPAY,
        username: d.username,
        wallet: wallet(i),
        inviteCode: `SEED${i}`,
        xp: d.xp,
        levelProgress: {
          create: [
            { track: LevelTrack.STANDARD, level: d.std },
            { track: LevelTrack.WORLD_CUP, level: d.wc },
          ],
        },
      },
    });
    ids[d.key] = u.id;
    i++;
  }

  // --- Settled tournament game + entries (drives Top earners board) ---
  const game = await prisma.game.create({
    data: {
      gameNumber: 1,
      onchainId: "0x" + "1".padStart(64, "0"),
      platform: UserPlatform.MINIPAY,
      network: GameNetwork.CELO_SEPOLIA,
      title: "WAFFLES #001",
      theme: GameTheme.GENERAL,
      startsAt: new Date(Date.now() - 3 * 86400_000),
      endsAt: new Date(Date.now() - 2 * 86400_000),
      rankedAt: new Date(Date.now() - 2 * 86400_000),
      onChainAt: new Date(Date.now() - 2 * 86400_000),
      merkleRoot: "0x" + "a".padStart(64, "a"),
    },
  });

  const ranked = [...defs].sort((a, b) => b.score - a.score);
  let rank = 1;
  for (const d of ranked) {
    await prisma.gameEntry.create({
      data: {
        gameId: game.id,
        userId: ids[d.key],
        paidAt: new Date(Date.now() - 3 * 86400_000),
        paidAmount: 1,
        score: d.score,
        rank: rank++,
        prize: d.prize > 0 ? d.prize : null,
      },
    });
  }

  console.log("Seeded. me.id =", ids.me);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
