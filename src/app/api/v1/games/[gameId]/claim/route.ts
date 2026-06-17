import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthResult, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendToUser } from "@/lib/notifications";
import { env } from "@/lib/env";
import { verifyClaim } from "@/lib/chain";
import { isGameVisibleToPlatform } from "@/lib/platform/query";
import { resolvePlatformGameVisibility } from "@/lib/platform/server";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";

const SERVICE = "claim-api";

type Params = { gameId: string };

interface ClaimRequest {
  txHash: string;
  wallet: string;
}

interface ClaimResponse {
  success: true;
  message: string;
  claimedAt: string;
}

/**
 * POST /api/v1/games/[gameId]/claim
 * Sync prize claim with backend after on-chain transaction.
 *
 * FLOW:
 * 1. Validate entry exists and is eligible
 * 2. Check if already claimed (idempotent - return success)
 * 3. Verify claim on-chain (3-layer verification)
 * 4. Mark as claimed in DB
 * 5. Send notification
 */
export const POST = withAuth<Params>(
  async (request: NextRequest, auth: AuthResult, params) => {
    try {
      const { gameId } = params;
      const visibility = await resolvePlatformGameVisibility(auth.platform, request);
      await trackServerEvent({
        name: "legacy_game_claim_started",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(gameId),
          platform: auth.platform,
        },
      });

      if (!gameId) {
        await trackServerEvent({
          name: "legacy_game_claim_failed",
          userId: auth.userId,
          properties: { reason: "invalid_id" },
        });
        return NextResponse.json<ApiError>(
          { error: "Invalid Game ID", code: "INVALID_ID" },
          { status: 400 },
        );
      }

      // Parse request body
      let body: ClaimRequest;
      try {
        body = await request.json();
      } catch {
        await trackServerEvent({
          name: "legacy_game_claim_failed",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            reason: "invalid_input",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "Invalid request body", code: "INVALID_INPUT" },
          { status: 400 },
        );
      }

      const { txHash, wallet } = body;

      if (!txHash || !wallet) {
        await trackServerEvent({
          name: "legacy_game_claim_failed",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            tx_present: Boolean(txHash),
            wallet_connected: Boolean(wallet),
            reason: "invalid_input",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "txHash and wallet are required", code: "INVALID_INPUT" },
          { status: 400 },
        );
      }

      // Find game with onchainId
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: {
          id: true,
          platform: true,
          network: true,
          onchainId: true,
          isTestnet: true,
        },
      });

      if (!game || !isGameVisibleToPlatform(game, auth.platform, visibility) || !game.onchainId) {
        await trackServerEvent({
          name: "legacy_game_claim_failed",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            tx_present: true,
            wallet_connected: true,
            reason: "not_found",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "Game not found or not on-chain", code: "NOT_FOUND" },
          { status: 404 },
        );
      }

      // Find game entry
      const entry = await prisma.gameEntry.findUnique({
        where: { gameId_userId: { gameId, userId: auth.userId } },
        select: {
          id: true,
          claimedAt: true,
          rank: true,
          paidAt: true,
          prize: true,
          user: {
            select: {
              id: true,
              wallet: true,
              hasGameAccess: true,
              isBanned: true,
            },
          },
        },
      });

      if (!entry) {
        await trackServerEvent({
          name: "legacy_game_claim_failed",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            reason: "entry_not_found",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "Game entry not found", code: "NOT_FOUND" },
          { status: 404 },
        );
      }

      // =========================================================================
      // IDEMPOTENT: If already claimed, return success
      // =========================================================================
      if (entry.claimedAt) {
        console.log("["+SERVICE+"]", "claim_already_recorded", {
          gameId,
          userId: entry.user.id,
        });
        await trackServerEvent({
          name: "legacy_game_claim_succeeded",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            idempotent: true,
            prize_amount: entry.prize,
            rank: entry.rank,
          },
        });
        return NextResponse.json<ClaimResponse>({
          success: true,
          message: "Prize already claimed",
          claimedAt: entry.claimedAt.toISOString(),
        });
      }

      // Check if paid
      if (!entry.paidAt) {
        await trackServerEvent({
          name: "legacy_game_claim_failed",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            reason: "not_paid",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "Entry not paid", code: "NOT_PAID" },
          { status: 400 },
        );
      }

      // Check eligibility
      const isEligible =
        entry.prize !== null &&
        entry.prize > 0;

      if (!isEligible) {
        await trackServerEvent({
          name: "legacy_game_claim_failed",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            prize_amount: entry.prize,
            rank: entry.rank,
            reason: "not_eligible",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "Not eligible for a prize", code: "NOT_ELIGIBLE" },
          { status: 400 },
        );
      }

      // =========================================================================
      // VERIFY ON-CHAIN: 3-layer verification
      // =========================================================================
      const verification = await verifyClaim({
        txHash: txHash as `0x${string}`,
        platform: game.platform,
        network: game.network,
        expectedGameId: game.onchainId as `0x${string}`,
        expectedClaimer: wallet as `0x${string}`,
      });

      if (!verification.verified) {
        console.error("["+SERVICE+"]", "claim_verification_failed", {
          gameId,
          userId: entry.user.id,
          txHash,
          wallet,
          error: verification.error,
        });
        await trackServerEvent({
          name: "legacy_game_claim_failed",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            tx_present: true,
            wallet_connected: true,
            prize_amount: entry.prize,
            rank: entry.rank,
            reason: "verification_failed",
          },
        });
        return NextResponse.json<ApiError>(
          {
            error: verification.error || "Claim verification failed",
            code: "VERIFICATION_FAILED",
          },
          { status: 400 },
        );
      }

      console.log("["+SERVICE+"]", "claim_verified", {
        gameId,
        userId: entry.user.id,
        txHash,
        amount: verification.details?.amountFormatted,
      });

      // =========================================================================
      // MARK CLAIMED IN DB
      // =========================================================================
      const claimedAt = new Date();
      await prisma.gameEntry.update({
        where: { id: entry.id },
        data: { claimedAt },
      });

      // Send congratulations notification (async, don't wait)
      if (entry.user.hasGameAccess && !entry.user.isBanned) {
        const prizeAmount = entry.prize ?? 0;
        sendToUser(entry.user.id, {
          title: "💰 Prize Claimed!",
          body: `Congratulations! $${prizeAmount.toFixed(2)} has been sent to your wallet.`,
          targetUrl: `${env.rootUrl}/profile`,
        }).catch((err: Error) =>
          console.error("["+SERVICE+"]", "notification_error", { error: err.message }),
        );
      }

      console.log("["+SERVICE+"]", "claim_recorded", {
        gameId,
        userId: entry.user.id,
        prize: entry.prize,
      });

      await trackServerEvent({
        name: "legacy_game_claim_succeeded",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(gameId),
          platform: auth.platform,
          tx_present: true,
          wallet_connected: true,
          idempotent: false,
          prize_amount: entry.prize,
          rank: entry.rank,
        },
      });

      return NextResponse.json<ClaimResponse>({
        success: true,
        message: "Prize claimed successfully!",
        claimedAt: claimedAt.toISOString(),
      });
    } catch (error) {
      console.error("["+SERVICE+"]", "claim_error", {
        error: (error instanceof Error ? error.message : String(error)),
      });
      await trackServerEvent({
        name: "legacy_game_claim_failed",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(params.gameId),
          platform: auth.platform,
          reason: error instanceof Error ? error.name : "unknown",
        },
      });
      return NextResponse.json<ApiError>(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 },
      );
    }
  },
);
