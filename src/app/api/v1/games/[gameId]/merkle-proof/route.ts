import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CLAIM_DELAY_MS } from "@/lib/constants";
import { getAuthFromRequest, type ApiError } from "@/lib/auth";
import {
  resolvePlatformGameVisibility,
  resolveRuntimePlatform,
} from "@/lib/platform/server";
import { isGameVisibleToPlatform } from "@/lib/platform/query";

type Params = { gameId: string };

interface MerkleProofApiError extends ApiError {
  claimOpensAt?: string;
  remainingMs?: number;
}

interface MerkleProofResponse {
  gameId: string;
  address: string;
  amount: string;
  amountUSDC: number;
  proof: string[];
  claimedAt: string | null;
}

/**
 * GET /api/v1/games/[gameId]/merkle-proof
 * Returns the stored Merkle proof for a user's prize claim (public endpoint)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const requestPlatform = await resolveRuntimePlatform(request);
    const { gameId } = await params;
    if (!gameId) {
      return NextResponse.json<ApiError>(
        { error: "Invalid game ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    const auth = await getAuthFromRequest(request);
    const expectedPlatform = auth?.platform ?? requestPlatform;
    const visibility = await resolvePlatformGameVisibility(expectedPlatform, request);
    const fidParam = new URL(request.url).searchParams.get("fid");
    const legacyFid = fidParam ? parseInt(fidParam, 10) : NaN;
    const user = auth
      ? await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { id: true },
        })
      : !isNaN(legacyFid)
        ? await prisma.user.findUnique({
            where: { fid: legacyFid },
            select: { id: true },
          })
        : null;

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        platform: true,
        isTestnet: true,
        merkleRoot: true,
        onChainAt: true,
        endsAt: true,
      },
    });

    if (!game || !isGameVisibleToPlatform(game, expectedPlatform, visibility)) {
      return NextResponse.json<ApiError>(
        { error: "Game not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!game.merkleRoot || !game.onChainAt) {
      return NextResponse.json<ApiError>(
        {
          error: "Game has not been published on-chain yet",
          code: "NOT_PUBLISHED",
        },
        { status: 400 }
      );
    }

    // Check if claim window has opened
    const claimOpensAt = new Date(game.endsAt.getTime() + CLAIM_DELAY_MS);
    const now = new Date();
    if (now < claimOpensAt) {
      return NextResponse.json<MerkleProofApiError>(
        {
          error: "Claim window not yet open",
          code: "CLAIM_NOT_OPEN",
          claimOpensAt: claimOpensAt.toISOString(),
          remainingMs: claimOpensAt.getTime() - now.getTime(),
        },
        { status: 400 }
      );
    }

    const entry = await prisma.gameEntry.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId: user.id,
        },
      },
      select: {
        rank: true,
        prize: true,
        merkleProof: true,
        merkleAmount: true,
        payerWallet: true,
        claimedAt: true,
        user: {
          select: { wallet: true },
        },
      },
    });

    if (!entry) {
      return NextResponse.json<ApiError>(
        { error: "You do not have an entry in this game", code: "NO_ENTRY" },
        { status: 400 }
      );
    }

    if (!entry.merkleProof || !entry.merkleAmount) {
      return NextResponse.json<ApiError>(
        { error: "You are not a winner in this game", code: "NOT_WINNER" },
        { status: 400 }
      );
    }

    // Use payerWallet or fallback to user.wallet
    const claimAddress = entry.payerWallet || entry.user.wallet;
    if (!claimAddress) {
      return NextResponse.json<ApiError>(
        { error: "No wallet address to claim with", code: "NO_WALLET" },
        { status: 400 }
      );
    }

    return NextResponse.json<MerkleProofResponse>({
      gameId,
      address: claimAddress,
      amount: entry.merkleAmount,
      amountUSDC: entry.prize ?? 0,
      proof: entry.merkleProof as string[],
      claimedAt: entry.claimedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("GET /api/v1/games/[gameId]/merkle-proof Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
