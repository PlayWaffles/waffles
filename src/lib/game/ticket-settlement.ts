/**
 * Ticket settlement module — one interface for turning a verified on-chain
 * buyTicket into a GameEntry + prize pool increment.
 *
 * v1 purchase and v2 tournament entry are adapters over recordPaidEntry();
 * platform-specific behavior lives in TicketSettlementHooks, not at call sites.
 */

import { formatUnits, parseUnits } from "viem";
import { Prisma, TicketPurchaseSource, type UserPlatform } from "@prisma";

import { prisma } from "@/lib/db";
import { PAYMENT_TOKEN_DECIMALS, verifyTicketPurchase } from "@/lib/chain";
import { calculatePrizePoolContribution } from "@/lib/admin-utils";
import { normalizeAddress } from "@/lib/auth";
import type { GameNetwork } from "@/lib/chain/network";

// ============================================================================
// Types
// ============================================================================

export interface TicketSettlementUser {
  id: string;
  platform: UserPlatform;
  username: string | null;
  pfpUrl: string | null;
  wallet: string | null;
}

export interface TicketSettlementInput {
  gameId: string;
  txHash: string;
  /** Client-claimed amount; adapters may derive the authoritative value from the game. */
  paidAmount: number;
  payerWallet: string;
}

export type TicketSettlementResult =
  | {
      success: true;
      entryId: string;
      entryWasCreated: boolean;
      userId: string;
    }
  | {
      success: false;
      error: string;
      code?: string;
      retryable?: boolean;
    };

export type SettlementGame = {
  id: string;
  platform: UserPlatform;
  network: GameNetwork;
  isTestnet: boolean;
  onchainId: string | null;
  startsAt: Date;
  endsAt: Date;
  ticketsOpenAt: Date | null;
  prizePool: number;
  playerCount: number;
  maxPlayers: number;
  tierPrices: number[];
  gameNumber: number;
};

export type SettlementContext = {
  game: SettlementGame;
  user: TicketSettlementUser;
  input: TicketSettlementInput;
  normalizedPayerWallet: string;
};

export type CreatedEntryContext = SettlementContext & {
  entryId: string;
  verifiedAmount: number;
  prizePoolContribution: number;
  updatedPlayerCount: number;
};

export interface TicketSettlementHooks {
  logTag?: string;
  /** Abort with an error, or return null to continue. */
  validateAccess?: (ctx: SettlementContext) => TicketSettlementResult | null;
  /** Canonicalize the user before writing (e.g. Farcaster wallet linking). */
  resolveUser?: (
    ctx: SettlementContext,
  ) => Promise<{ user: TicketSettlementUser } | TicketSettlementResult>;
  /** Resolve the amount to verify on-chain. Return an error result to abort. */
  resolveVerifyAmount?: (
    ctx: SettlementContext,
  ) => TicketSettlementResult | { verifyAmount: number };
  /** Extra GameEntry fields beyond the shared paid-entry shape. */
  entryExtras?: (
    ctx: SettlementContext & { verifiedAmount: number },
  ) => Record<string, unknown>;
  /** Runs inside the entry-create transaction (referrals, analytics, etc.). */
  onCreateInTx?: (
    tx: Prisma.TransactionClient,
    ctx: CreatedEntryContext,
  ) => Promise<void>;
  /** Best-effort side effects after a new entry is committed. */
  onEntryCreated?: (ctx: CreatedEntryContext) => Promise<void>;
  /** Fires for both fresh and idempotent hits. */
  onSuccess?: (result: {
    entryId: string;
    entryWasCreated: boolean;
    userId: string;
  }) => Promise<void> | void;
}

const GAME_SELECT = {
  id: true,
  platform: true,
  network: true,
  isTestnet: true,
  onchainId: true,
  startsAt: true,
  endsAt: true,
  ticketsOpenAt: true,
  prizePool: true,
  playerCount: true,
  maxPlayers: true,
  tierPrices: true,
  gameNumber: true,
} as const;

function fail(
  error: string,
  code?: string,
  retryable?: boolean,
): TicketSettlementResult {
  return { success: false, error, code, retryable };
}

// ============================================================================
// Core
// ============================================================================

/**
 * Verify an on-chain ticket purchase and record a paid GameEntry.
 * Idempotent on (gameId, userId) and replay-safe on txHash uniqueness.
 */
export async function recordPaidEntry(
  user: TicketSettlementUser,
  input: TicketSettlementInput,
  hooks: TicketSettlementHooks = {},
): Promise<TicketSettlementResult> {
  const logTag = hooks.logTag ?? "ticket-settlement";
  const { gameId, txHash, payerWallet } = input;

  if (!gameId || !txHash || !payerWallet) {
    return fail("Missing required fields", "INVALID_INPUT");
  }

  const normalizedPayerWallet = normalizeAddress(payerWallet);
  if (!normalizedPayerWallet) {
    return fail("Invalid payer wallet", "INVALID_INPUT");
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: GAME_SELECT,
    });

    if (!game) {
      return fail("Game not found", "NOT_FOUND");
    }

    if (!game.onchainId) {
      return fail("Game not deployed on-chain", "NOT_ONCHAIN");
    }

    let settlementUser = user;
    const baseCtx: SettlementContext = {
      game,
      user: settlementUser,
      input,
      normalizedPayerWallet,
    };

    const accessError = hooks.validateAccess?.(baseCtx);
    if (accessError) return accessError;

    if (hooks.resolveUser) {
      const resolved = await hooks.resolveUser(baseCtx);
      if ("success" in resolved) return resolved;
      settlementUser = resolved.user;
    }

    const ctx: SettlementContext = { ...baseCtx, user: settlementUser };

    const verifyAmountResult = hooks.resolveVerifyAmount?.(ctx) ?? {
      verifyAmount: input.paidAmount,
    };
    if ("success" in verifyAmountResult) return verifyAmountResult;

    const { verifyAmount } = verifyAmountResult;
    if (typeof verifyAmount !== "number" || verifyAmount <= 0) {
      return fail("Invalid payment amount", "INVALID_INPUT");
    }

    const verification = await verifyTicketPurchase({
      platform: game.platform,
      network: game.network,
      txHash: txHash as `0x${string}`,
      expectedGameId: game.onchainId as `0x${string}`,
      expectedBuyer: normalizedPayerWallet as `0x${string}`,
      minimumAmount: parseUnits(verifyAmount.toString(), PAYMENT_TOKEN_DECIMALS),
    });

    console.log(`[${logTag}] verification`, {
      gameId,
      txHash,
      verified: verification.verified,
      error: verification.error,
    });

    if (!verification.verified) {
      return fail(
        verification.error || "Payment verification failed",
        verification.retryable ? "CHAIN_RPC_ERROR" : "VERIFICATION_FAILED",
        verification.retryable,
      );
    }

    const verifiedAmount = Number(
      formatUnits(
        verification.details?.amount ??
          parseUnits(verifyAmount.toString(), PAYMENT_TOKEN_DECIMALS),
        PAYMENT_TOKEN_DECIMALS,
      ),
    );

    if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0) {
      return fail(
        "Unable to derive paid amount from on-chain purchase",
        "VERIFICATION_FAILED",
      );
    }

    const existing = await prisma.gameEntry.findUnique({
      where: { gameId_userId: { gameId, userId: settlementUser.id } },
      select: { id: true },
    });

    if (existing) {
      await hooks.onSuccess?.({
        entryId: existing.id,
        entryWasCreated: false,
        userId: settlementUser.id,
      });
      return {
        success: true,
        entryId: existing.id,
        entryWasCreated: false,
        userId: settlementUser.id,
      };
    }

    const prizePoolContribution = calculatePrizePoolContribution(verifiedAmount);
    const extras =
      hooks.entryExtras?.({ ...ctx, verifiedAmount }) ?? {};

    let entryId = "";
    let entryWasCreated = false;
    let updatedPlayerCount = game.playerCount;

    try {
      const txResult = await prisma.$transaction(async (tx) => {
        const raceExisting = await tx.gameEntry.findUnique({
          where: { gameId_userId: { gameId, userId: settlementUser.id } },
          select: { id: true },
        });

        if (raceExisting) {
          return {
            entryId: raceExisting.id,
            playerCount: game.playerCount,
            wasCreated: false,
          };
        }

        const created = await tx.gameEntry.create({
          data: {
            gameId,
            userId: settlementUser.id,
            txHash,
            payerWallet: normalizedPayerWallet,
            paidAmount: verifiedAmount,
            paidAt: new Date(),
            purchaseSource: TicketPurchaseSource.PAID,
            ...extras,
          },
          select: { id: true },
        });

        const updatedGame = await tx.game.update({
          where: { id: gameId },
          data: {
            playerCount: { increment: 1 },
            prizePool: { increment: prizePoolContribution },
          },
          select: { playerCount: true },
        });

        const createdCtx: CreatedEntryContext = {
          ...ctx,
          entryId: created.id,
          verifiedAmount,
          prizePoolContribution,
          updatedPlayerCount: updatedGame.playerCount,
        };

        await hooks.onCreateInTx?.(tx, createdCtx);

        return {
          entryId: created.id,
          playerCount: updatedGame.playerCount,
          wasCreated: true,
        };
      });

      entryId = txResult.entryId;
      entryWasCreated = txResult.wasCreated;
      updatedPlayerCount = txResult.playerCount;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await prisma.gameEntry.findUnique({
          where: { gameId_userId: { gameId, userId: settlementUser.id } },
          select: { id: true },
        });
        if (raced) {
          await hooks.onSuccess?.({
            entryId: raced.id,
            entryWasCreated: false,
            userId: settlementUser.id,
          });
          return {
            success: true,
            entryId: raced.id,
            entryWasCreated: false,
            userId: settlementUser.id,
          };
        }
      }
      throw error;
    }

    await hooks.onSuccess?.({
      entryId,
      entryWasCreated,
      userId: settlementUser.id,
    });

    if (entryWasCreated) {
      const createdCtx: CreatedEntryContext = {
        ...ctx,
        entryId,
        verifiedAmount,
        prizePoolContribution,
        updatedPlayerCount,
      };
      await hooks.onEntryCreated?.(createdCtx);
    }

    console.log(`[${logTag}] entry recorded`, {
      gameId,
      entryId,
      userId: settlementUser.id,
      entryWasCreated,
    });

    return {
      success: true,
      entryId,
      entryWasCreated,
      userId: settlementUser.id,
    };
  } catch (error) {
    console.error(`[${logTag}] error`, {
      gameId,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return fail("Purchase failed", "INTERNAL_ERROR");
  }
}