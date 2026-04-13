import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog, formatUnits } from "viem";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getPublicClient } from "@/lib/chain/client";
import { getWaffleContractAddress, PAYMENT_TOKEN_DECIMALS } from "@/lib/chain";
import { waffleGameAbi } from "@/lib/chain/abi";
import { logAdminAction, EntityType } from "@/lib/audit";
import { safeRevalidateGamePaths } from "@/lib/game/cache";
import { notifyGameStatsUpdated } from "@/lib/partykit";
import { sendBatch } from "@/lib/notifications";
import { buildPayload, preGame } from "@/lib/notifications/templates";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const { gameId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { txHash?: `0x${string}` };

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        onchainId: true,
        gameNumber: true,
        title: true,
        platform: true,
        network: true,
        prizePool: true,
      },
    });

    if (!game || !game.onchainId) {
      return NextResponse.json({ error: "Game not found or not on-chain" }, { status: 404 });
    }

    const target = { platform: game.platform, network: game.network } as const;
    const publicClient = getPublicClient(target);
    const contractAddress = getWaffleContractAddress(target);

    let sponsoredNetAmount: bigint | null = null;

    if (body.txHash) {
      const receipt = await publicClient.getTransactionReceipt({ hash: body.txHash });
      if (receipt.status !== "success") {
        return NextResponse.json({ error: "Sponsorship transaction failed" }, { status: 400 });
      }

      const matchingEvent = receipt.logs.find((log) => {
        if (log.address.toLowerCase() !== contractAddress.toLowerCase()) {
          return false;
        }

        try {
          const decoded = decodeEventLog({
            abi: waffleGameAbi,
            eventName: "PrizePoolSponsored",
            data: log.data,
            topics: log.topics,
          });

          const args = decoded.args as {
            gameId?: `0x${string}`;
            amount?: bigint;
            fee?: bigint;
          };

          if (args.gameId !== game.onchainId) {
            return false;
          }

          if (typeof args.amount === "bigint" && typeof args.fee === "bigint") {
            sponsoredNetAmount = args.amount - args.fee;
          }

          return true;
        } catch {
          return false;
        }
      });

      if (!matchingEvent) {
        return NextResponse.json(
          { error: "No PrizePoolSponsored event found for this game in the provided transaction" },
          { status: 400 },
        );
      }
    }

    const onchainGame = (await publicClient.readContract({
      address: contractAddress,
      abi: waffleGameAbi,
      functionName: "getGame",
      args: [game.onchainId as `0x${string}`],
    })) as {
      ticketRevenue: bigint;
      sponsoredAmount: bigint;
    };

    const onchainTotalPrizePool = (await publicClient.readContract({
      address: contractAddress,
      abi: waffleGameAbi,
      functionName: "getTotalPrizePool",
      args: [game.onchainId as `0x${string}`],
    })) as bigint;

    const syncedGrossPrizePool = Number(
      formatUnits(
        onchainGame.ticketRevenue + onchainGame.sponsoredAmount,
        PAYMENT_TOKEN_DECIMALS,
      ),
    );
    const syncedNetPrizePool = Number(
      formatUnits(onchainTotalPrizePool, PAYMENT_TOKEN_DECIMALS),
    );

    const updatedGame = await prisma.game.update({
      where: { id: game.id },
      data: { prizePool: syncedNetPrizePool },
      select: {
        id: true,
        prizePool: true,
        playerCount: true,
      },
    });

    safeRevalidateGamePaths("admin/sponsorship-sync");
    void notifyGameStatsUpdated(updatedGame.id, {
      prizePool: updatedGame.prizePool,
      playerCount: updatedGame.playerCount,
    });

    let notificationResults: Awaited<ReturnType<typeof sendBatch>> | null = null;

    if (sponsoredNetAmount && sponsoredNetAmount > BigInt(0)) {
      try {
        const usersToNotify = await prisma.user.findMany({
          where: {
            isBanned: false,
          },
          select: { id: true },
        });

        if (usersToNotify.length > 0) {
          const boostAmount = Number(formatUnits(sponsoredNetAmount, PAYMENT_TOKEN_DECIMALS)).toFixed(2);
          const payload = buildPayload(
            preGame.prizePoolBoost(
              game.gameNumber,
              boostAmount,
              syncedNetPrizePool.toFixed(2),
            ),
            game.id,
            "pregame",
          );

          notificationResults = await sendBatch(
            payload,
            usersToNotify.map((user) => user.id),
          );
        }
      } catch (notificationError) {
        console.error("[admin-sponsorship-sync] Notification failed:", notificationError);
      }
    }

    await logAdminAction({
      adminId: auth.session!.userId,
      action: "SYNC_SPONSORED_PRIZE_POOL",
      entityType: EntityType.GAME,
      entityId: game.id,
      details: {
        gameTitle: game.title,
        txHash: body.txHash ?? null,
        previousPrizePool: game.prizePool,
        syncedPrizePool: syncedNetPrizePool,
        syncedGrossPrizePool,
        syncedNetPrizePool,
        sponsoredNetAmount:
          typeof sponsoredNetAmount === "bigint" ? String(sponsoredNetAmount) : null,
        notificationResults,
      },
    });

    return NextResponse.json({
      success: true,
      gameId: game.id,
      prizePool: syncedNetPrizePool,
      grossPrizePool: syncedGrossPrizePool,
      netPrizePool: syncedNetPrizePool,
      previousPrizePool: game.prizePool,
      txHash: body.txHash ?? null,
      notified: notificationResults?.success ?? 0,
    });
  } catch (error) {
    console.error("[admin-sponsorship-sync] Failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync sponsorship",
      },
      { status: 500 },
    );
  }
}
