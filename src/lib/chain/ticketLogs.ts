/**
 * Low-level reads of the contract's `TicketPurchased` event log. Kept free of
 * any player/DB imports so both the indexer (src/lib/chain/indexer.ts) and the
 * player entry path (tournamentGames.ts) can use it without a circular import.
 */
import { parseAbiItem } from "viem";
import { getPublicClient } from "@/lib/chain/client";
import { getWaffleContractAddress } from "@/lib/chain/config";
import type { GameNetwork } from "@/lib/chain/network";
import type { ChainPlatform } from "@/lib/chain/platform";

export const TICKET_PURCHASED_EVENT = parseAbiItem(
  "event TicketPurchased(bytes32 indexed gameId, address indexed player, uint256 amount)",
);

/** `eth_getLogs` chunk size — bounds a single RPC call over a wide (backfill) range. */
const MAX_BLOCK_RANGE = 5_000n;

export type IndexTarget = { platform: ChainPlatform; network: GameNetwork };

/** One decoded `TicketPurchased` log, with typed `args` (gameId, player, amount). */
async function getPurchaseLogsChunk(target: IndexTarget, fromBlock: bigint, toBlock: bigint) {
  return getPublicClient(target).getLogs({
    address: getWaffleContractAddress(target),
    event: TICKET_PURCHASED_EVENT,
    fromBlock,
    toBlock,
  });
}
export type TicketPurchasedLog = Awaited<ReturnType<typeof getPurchaseLogsChunk>>[number];

/** Fetch `TicketPurchased` logs for a target over [fromBlock, toBlock], chunked
 *  so a wide (backfill) range never asks the RPC for too much at once. */
export async function scanTicketPurchasedLogs(
  target: IndexTarget,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<TicketPurchasedLog[]> {
  const logs: TicketPurchasedLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += MAX_BLOCK_RANGE) {
    const end = start + MAX_BLOCK_RANGE - 1n > toBlock ? toBlock : start + MAX_BLOCK_RANGE - 1n;
    logs.push(...(await getPurchaseLogsChunk(target, start, end)));
  }
  return logs;
}

/** Find the tx hash of a specific wallet's `TicketPurchased` for one game, using
 *  the two indexed topics (gameId + player) so the RPC filter is cheap. Returns
 *  the most recent match, or null if the wallet never bought on this contract. */
export async function findTicketPurchaseTx(
  target: IndexTarget,
  onchainId: `0x${string}`,
  wallet: `0x${string}`,
): Promise<`0x${string}` | null> {
  const logs = await getPublicClient(target).getLogs({
    address: getWaffleContractAddress(target),
    event: TICKET_PURCHASED_EVENT,
    args: { gameId: onchainId, player: wallet },
    fromBlock: "earliest",
    toBlock: "latest",
  });
  return logs[logs.length - 1]?.transactionHash ?? null;
}
