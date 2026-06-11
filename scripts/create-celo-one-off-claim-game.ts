import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const ENV_FILE = ".env.production";

if (!existsSync(ENV_FILE)) {
  throw new Error(`${ENV_FILE} is required for this script.`);
}

loadEnvFile(ENV_FILE);

const { parseUnits } = await import("viem");
const { prisma } = await import("@/lib/db");
const { CLAIM_DELAY_MS } = await import("@/lib/constants");
const {
  closeSalesOnChain,
  createGameOnChain,
  generateOnchainGameId,
  getPublicClient,
} = await import("@/lib/chain");
const { initGameRoom } = await import("@/lib/partykit");
const { recalculateGameRounds } = await import("@/lib/game/rounds");
const { processPendingPurchases } = await import("@/lib/game/pending-purchases");
const { publishResults } = await import("@/lib/game/lifecycle");
const { formatGameLabel } = await import("@/lib/game/labels");
const { PAYMENT_TOKEN_DECIMALS } = await import("@/lib/chain/config");
const { GameTheme, Prisma, UserPlatform } = await import("@prisma");

const PLATFORM = UserPlatform.MINIPAY;
const NETWORK = "CELO_MAINNET" as const;
const TICKET_PRICE = 1;
const CLAIM_AMOUNT_USDC = 9.296;
const QUESTION_COUNT = 9;
const POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const GAME_COVER_URL = "/images/movies-cover.png";

function getArg(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeAddress(address: string | undefined) {
  const value = address?.trim().toLowerCase();
  return value && /^0x[a-f0-9]{40}$/.test(value) ? value : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createCeloGame() {
  const now = new Date();
  const startsAt = new Date(now.getTime() + 10 * 60 * 1000);
  const endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const templates = await prisma.questionTemplate.findMany({
    where: { theme: GameTheme.MOVIES },
    orderBy: [
      { usageCount: "asc" },
      { updatedAt: "asc" },
      { createdAt: "asc" },
    ],
    take: QUESTION_COUNT,
  });

  if (templates.length < QUESTION_COUNT) {
    throw new Error(
      `Need at least ${QUESTION_COUNT} movie question templates before creating a game.`,
    );
  }

  const lastGame = await prisma.game.findFirst({
    where: { network: NETWORK },
    orderBy: { gameNumber: "desc" },
    select: { gameNumber: true },
  });

  const gameNumber = (lastGame?.gameNumber ?? 0) + 1;
  const onchainId = generateOnchainGameId();
  const game = await prisma.game.create({
    data: {
      title: `${formatGameLabel(gameNumber)} ONE-OFF`,
      gameNumber,
      platform: PLATFORM,
      network: NETWORK,
      isTestnet: false,
      description: "One-off Celo claim test",
      theme: GameTheme.MOVIES,
      coverUrl: GAME_COVER_URL,
      startsAt,
      endsAt,
      ticketsOpenAt: now,
      tierPrices: [TICKET_PRICE],
      prizePool: 0,
      playerCount: 0,
      roundBreakSec: 15,
      maxPlayers: 1,
      onchainId,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.question.createMany({
      data: templates.map((template, index) => ({
        gameId: game.id,
        content: template.content,
        options: template.options,
        correctIndex: template.correctIndex,
        durationSec: template.durationSec,
        mediaUrl: template.mediaUrl,
        soundUrl: template.soundUrl,
        roundIndex: 1,
        orderInRound: index,
        templateId: template.id,
      })),
    });

    await Promise.all(
      templates.map((template) =>
        tx.questionTemplate.update({
          where: { id: template.id },
          data: { usageCount: { increment: 1 } },
        }),
      ),
    );
  });

  await recalculateGameRounds(game.id);
  await initGameRoom(game.id, startsAt, endsAt);

  const createTxHash = await createGameOnChain(
    PLATFORM,
    NETWORK,
    onchainId,
    TICKET_PRICE,
  );
  await getPublicClient({ platform: PLATFORM, network: NETWORK })
    .waitForTransactionReceipt({ hash: createTxHash });

  return { ...game, onchainId, createTxHash };
}

async function waitForIndexedEntry(gameId: string, wallet: string | null, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await processPendingPurchases(10);

    const entries = await prisma.gameEntry.findMany({
      where: {
        gameId,
        paidAt: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            wallet: true,
          },
        },
      },
      orderBy: { paidAt: "asc" },
    });

    const matchingEntries = wallet
      ? entries.filter((entry) => {
          const payerWallet = normalizeAddress(entry.payerWallet ?? undefined);
          const userWallet = normalizeAddress(entry.user.wallet ?? undefined);
          return payerWallet === wallet || userWallet === wallet;
        })
      : entries;

    if (matchingEntries.length === 1) return matchingEntries[0];
    if (!wallet && matchingEntries.length > 1) {
      throw new Error(
        "Multiple paid entries were indexed. Re-run with --wallet 0x... to choose the claim recipient.",
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    wallet
      ? `Timed out waiting for an indexed ticket from ${wallet}.`
      : "Timed out waiting for a single indexed ticket.",
  );
}

async function settleOneOffClaim(gameId: string, entryId: string) {
  const settledEndsAt = new Date(Date.now() - CLAIM_DELAY_MS - 60_000);
  const amount = parseUnits(
    CLAIM_AMOUNT_USDC.toFixed(PAYMENT_TOKEN_DECIMALS),
    PAYMENT_TOKEN_DECIMALS,
  );

  await prisma.$transaction(async (tx) => {
    await tx.gameEntry.updateMany({
      where: { gameId },
      data: {
        rank: null,
        prize: null,
        merkleProof: Prisma.DbNull,
        merkleAmount: null,
        claimedAt: null,
      },
    });

    await tx.gameEntry.update({
      where: { id: entryId },
      data: {
        rank: 1,
        score: 1,
        prize: CLAIM_AMOUNT_USDC,
        merkleAmount: amount.toString(),
      },
    });

    await tx.game.update({
      where: { id: gameId },
      data: {
        endsAt: settledEndsAt,
        rankedAt: new Date(),
        onChainAt: null,
        onChainTxHash: null,
        merkleRoot: null,
      },
    });
  });

  await closeSalesOnChain(PLATFORM, NETWORK, (await getGameOnchainId(gameId)));
  return publishResults(gameId);
}

async function getGameOnchainId(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { onchainId: true },
  });

  if (!game?.onchainId) {
    throw new Error(`Game ${gameId} has no on-chain id.`);
  }

  return game.onchainId as `0x${string}`;
}

async function main() {
  const wallet = normalizeAddress(
    getArg("--wallet") ?? process.env.CLAIM_WALLET,
  );
  const timeoutMs = Number(getArg("--timeout-ms") ?? DEFAULT_TIMEOUT_MS);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number.");
  }

  const game = await createCeloGame();
  const gameUrl = `${process.env.NEXT_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/game/${game.id}`;

  console.log(
    JSON.stringify(
      {
        step: "game_created",
        gameId: game.id,
        title: game.title,
        gameNumber: game.gameNumber,
        platform: PLATFORM,
        network: NETWORK,
        onchainId: game.onchainId,
        ticketPrice: TICKET_PRICE,
        createTxHash: game.createTxHash,
        gameUrl,
        waitingForWallet: wallet ?? "first indexed paid entry",
      },
      null,
      2,
    ),
  );

  const entry = await waitForIndexedEntry(game.id, wallet, timeoutMs);
  const result = await settleOneOffClaim(game.id, entry.id);

  console.log(
    JSON.stringify(
      {
        success: true,
        gameId: game.id,
        gameUrl,
        entryId: entry.id,
        userId: entry.userId,
        username: entry.user.username,
        payerWallet: entry.payerWallet,
        claimAmount: CLAIM_AMOUNT_USDC,
        merkleRoot: result.merkleRoot,
        submitResultsTxHash: result.txHash,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
