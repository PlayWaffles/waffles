import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { closeSalesOnChain, getOnChainGame } from "@/lib/chain";
import { updateGame } from "@/lib/partykit";

export const maxDuration = 60;

interface EndCurrentMiniPayCeloResult {
  success: boolean;
  gameId?: string;
  gameNumber?: number;
  previousEndsAt?: string;
  endedAt?: string;
  closeSalesTxHash?: string;
  error?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<EndCurrentMiniPayCeloResult>> {
  if (request.headers.get("Authorization") !== `Bearer ${env.partykitSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const endedAt = new Date(now.getTime() - 1000);

  try {
    const game = await prisma.game.findFirst({
      where: {
        platform: "MINIPAY",
        network: "CELO_MAINNET",
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: { endsAt: "desc" },
      select: {
        id: true,
        gameNumber: true,
        startsAt: true,
        endsAt: true,
        onchainId: true,
        platform: true,
        network: true,
      },
    });

    if (!game) {
      return NextResponse.json(
        { success: false, error: "No live MiniPay Celo mainnet game found" },
        { status: 404 },
      );
    }

    let closeSalesTxHash: string | undefined;
    if (game.onchainId) {
      const onChainGame = await getOnChainGame(
        game.platform,
        game.network,
        game.onchainId as `0x${string}`,
      );

      if (onChainGame && !onChainGame.salesClosed) {
        closeSalesTxHash = await closeSalesOnChain(
          game.platform,
          game.network,
          game.onchainId as `0x${string}`,
        );
      }
    }

    const updatedGame = await prisma.game.update({
      where: { id: game.id },
      data: { endsAt: endedAt },
      select: { id: true, gameNumber: true, startsAt: true, endsAt: true },
    });

    await updateGame(updatedGame.id, updatedGame.startsAt, updatedGame.endsAt);

    return NextResponse.json({
      success: true,
      gameId: updatedGame.id,
      gameNumber: updatedGame.gameNumber,
      previousEndsAt: game.endsAt.toISOString(),
      endedAt: updatedGame.endsAt.toISOString(),
      closeSalesTxHash,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
