"use client";

import { use, useState, useEffect, useMemo, useRef, useCallback } from "react";
import GameResultCard from "../_component/GameResultCard";
import Top3Leaderboard from "./_components/Top3Leaderboard";
import Image from "next/image";
import { WaffleButton } from "@/components/buttons/WaffleButton";
import { FlashIcon } from "@/components/icons";
import { WaffleLoader } from "@/components/ui/WaffleLoader";
import { BottomNav } from "@/components/BottomNav";
import { playSound } from "@/lib/sounds";
import { notify } from "@/components/ui/Toaster";
import { env } from "@/lib/env";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSendCalls, useCallsStatus, useAccount } from "wagmi";
import { encodeFunctionData } from "viem";

import { waffleGameAbi } from "@/lib/chain/abi";
import { Spinner } from "@/components/ui/spinner";
import confetti from "canvas-confetti";
import { WINNERS_COUNT } from "@/lib/game/prizeDistribution";
import { CLAIM_DELAY_MS } from "@/lib/constants";
import { getWaffleContractAddress } from "@/lib/chain";
import { builderCodeSendCallsCapability } from "@/lib/chain/builderCode";
import { useUser } from "@/hooks/useUser";
import { shareTextOrCopy } from "@/lib/share";
import { authenticatedFetch } from "@/lib/client/runtime";
import type { ChainPlatform } from "@/lib/chain/platform";
import type { GameNetwork } from "@/lib/chain";

// ==========================================
// TYPES
// ==========================================

type ClaimState =
  | "idle"
  | "fetching"
  | "confirming"
  | "success"
  | "error"
  | "pending";

// Entry data type for this specific game (independent of global context)
interface ResultEntryData {
  id: string;
  score: number;
  answered: number;
  paidAt: string | null;
  rank: number | null;
  prize: number | null;
  claimedAt: string | null;
  answeredQuestionIds: string[];
}

// ==========================================
// COMPONENT
// ==========================================

type Top3Entry = {
  score: number;
  rank: number | null;
  user: {
    fid: number | null;
    wallet?: string | null;
    username: string | null;
    pfpUrl: string | null;
  } | null;
};

interface ResultGame {
  id: string;
  gameNumber: number;
  onchainId: string | null;
  platform: ChainPlatform;
  network: GameNetwork;
  title: string;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  prizePool: number;
  playerCount: number;
}

export default function ResultPageClient({
  gamePromise,
  top3Promise,
}: {
  gamePromise: Promise<ResultGame | null>;
  top3Promise: Promise<Top3Entry[]>;
}) {
  const game = use(gamePromise);
  const top3Entries = use(top3Promise);
  const { address } = useAccount();
  const { user } = useUser();
  const gameId = game?.id;
  const gameNumber = game?.gameNumber ?? 0;

  // Local entry state - fetched independently for THIS specific game
  // This ensures result page works regardless of what game is in global context
  const [entry, setEntry] = useState<ResultEntryData | null>(null);
  const [entryLoading, setEntryLoading] = useState(true);

  const hasPlayedSound = useRef(false);

  // Fetch entry data for this specific game (independent of global context)
  const fetchEntry = useCallback(async () => {
    if (!gameId || !user?.id) {
      setEntryLoading(false);
      return;
    }

    try {
      const res = await authenticatedFetch(`/api/v1/games/${gameId}/entry`);
      if (res.ok) {
        const data = await res.json();
        setEntry(data);
      } else {
        // User might not have an entry for this game
        setEntry(null);
      }
    } catch (e) {
      console.error("[ResultPage] Failed to fetch entry:", e);
      setEntry(null);
    } finally {
      setEntryLoading(false);
    }
  }, [gameId, user?.id]);

  // Initial fetch on mount
  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  // Recovery: Check for pending claims that failed to sync
  useEffect(() => {
    if (!gameId || !address) return;

    const key = `pending-claim-${gameId}`;
    const pendingData = localStorage.getItem(key);

    if (!pendingData) return;

    try {
      const pending = JSON.parse(pendingData);

      // Only recover if from within last 24 hours
      if (Date.now() - pending.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return;
      }

      console.log("[Claim Recovery] Found pending claim, attempting sync:", pending);

      // Attempt recovery
      authenticatedFetch(`/api/v1/games/${gameId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: pending.txHash, wallet: pending.wallet }),
      }).then((response) => {
        if (response.ok) {
          console.log("[Claim Recovery] Successfully recovered pending claim!");
          localStorage.removeItem(key);
          fetchEntry(); // Refresh entry data
        }
      }).catch((err) => {
        console.error("[Claim Recovery] Recovery error:", err);
      });
    } catch {
      localStorage.removeItem(key);
    }
  }, [gameId, address, fetchEntry]);

  // Alias for refetchEntry (used in claim flow)
  const refetchEntry = fetchEntry;

  // Claim state
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimCountdown, setClaimCountdown] = useState<string | null>(null);
  const [isClaimWindowOpen, setIsClaimWindowOpen] = useState(false);

  // Check if already claimed from entry
  const hasClaimed =
    entry?.claimedAt !== null && entry?.claimedAt !== undefined;

  // Calculate when claim window opens (1 hour after game ends)
  const claimOpensAt = useMemo(() => {
    if (!game?.endsAt) return null;
    return new Date(new Date(game.endsAt).getTime() + CLAIM_DELAY_MS);
  }, [game?.endsAt]);

  // Countdown timer — also flips isClaimWindowOpen when it reaches zero
  useEffect(() => {
    if (!claimOpensAt || hasClaimed) {
      setClaimCountdown(null);
      return;
    }

    const update = () => {
      const diff = claimOpensAt.getTime() - Date.now();
      if (diff <= 0) {
        setIsClaimWindowOpen(true);
        setClaimCountdown(null);
        return true; // signal to clear interval
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setClaimCountdown(`${minutes}m ${seconds}s`);
      return false;
    };

    if (update()) return; // already open
    const interval = setInterval(() => {
      if (update()) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [claimOpensAt, hasClaimed]);

  // Get onchainId
  const onchainId = game?.onchainId;
  const contractAddress = game
    ? getWaffleContractAddress({
        platform: game.platform,
        network: game.network,
      })
    : null;

  // User score from RealtimeProvider entry
  const userScore = useMemo(() => {
    if (!entry) return null;

    const total = game?.playerCount ?? 0;
    const rank = entry.rank ?? 0;
    const percentile =
      total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100;

    return {
      score: entry.score,
      rank,
      prize: entry.prize ?? 0,
      percentile: Math.max(0, Math.min(100, percentile)),
    };
  }, [entry, game?.playerCount]);

  // Is user a winner (rank 1-10)?
  const isWinner = useMemo(() => {
    return userScore !== null && userScore.prize > 0;
  }, [userScore]);

  // Play sound and confetti on mount (once)
  useEffect(() => {
    if (!hasPlayedSound.current && userScore) {
      hasPlayedSound.current = true;
      const isPaid = entry?.paidAt != null;
      const shouldPlayDefeat = isPaid && userScore.prize === 0 && userScore.score === 0;
      if (shouldPlayDefeat) {
        playSound("defeat");
      } else if (userScore.score > 0) {
        playSound("victory");
      }

      // Fire confetti for winners (rank 1-10)
      if (userScore.prize > 0) {
        // Initial burst
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FFC931", "#14B985", "#FB72FF"],
        });

        // Side bursts
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.7 },
            colors: ["#FFC931", "#14B985"],
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.7 },
            colors: ["#FB72FF", "#00CFF2"],
          });
        }, 250);
      }
    }
  }, [userScore]);

  // If already claimed, set state
  useEffect(() => {
    if (hasClaimed) {
      setClaimState("success");
    }
  }, [hasClaimed]);

  // ==========================================
  // SHARE SCORE
  // ==========================================

  const handleShareScore = useCallback(async () => {
    if (!userScore || !gameId) return;

    try {
      const hasPrize = userScore.prize > 0;
      const username = user?.username ?? "Player";
      const pfpUrl = user?.pfpUrl || "";
      const shareParams = new URLSearchParams({
        username,
        score: userScore.score.toString(),
        rank: userScore.rank.toString(),
        ...(hasPrize && { prizeAmount: userScore.prize.toString() }),
        ...(pfpUrl && { pfpUrl }),
      });
      const embedUrl = `${env.rootUrl}/game/${gameId}/result?${shareParams.toString()}`;
      const shareText = hasPrize
        ? `Just won $${userScore.prize.toLocaleString()} on Waffles! 🧇🏆`
        : `Just scored ${userScore.score.toLocaleString()} points on Waffles #${String(gameNumber).padStart(3, "0")}! 🧇`;

      const result = await shareTextOrCopy({
        title: "Waffles",
        text: shareText,
        url: embedUrl,
      });

      if (result.shared || result.copied) {
        playSound("purchase");
        notify.success(result.shared ? "Shared to Farcaster! 🎉" : "Result link copied!");
      } else {
        notify.info("Share cancelled");
      }
    } catch (error) {
      console.error("[Share] Error:", error);
      notify.error("Failed to share");
    }
  }, [gameId, gameNumber, user?.pfpUrl, user?.username, userScore]);

  // ==========================================
  // CLAIM LOGIC
  // ==========================================

  const {
    sendCalls,
    data: callsId,
    isPending: isSending,
    error: sendError,
    reset: resetSendCalls,
  } = useSendCalls();

  const { data: callsStatus } = useCallsStatus({
    id: callsId?.id ?? "",
    query: {
      enabled: !!callsId?.id,
      refetchInterval: (data) => {
        if (data.state.data?.status === "success") return false;
        if (data.state.data?.status === "failure") return false;
        return 1000;
      },
    },
  });

  // Handle send errors
  useEffect(() => {
    if (sendError) {
      console.error("[Claim] Send error:", sendError);
      const errorMessage = sendError.message.includes("rejected")
        ? "Transaction rejected"
        : "Claim failed";
      setClaimError(errorMessage);
      setClaimState("error");
      notify.error(errorMessage);
    }
  }, [sendError]);

  // Sync claim with backend (with retries)
  const syncClaimWithBackend = useCallback(async (txHash: string) => {
    if (!address) return;

    const MAX_RETRIES = 5;
    let lastError = "Sync failed";

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await authenticatedFetch(
          `/api/v1/games/${gameId}/claim`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txHash, wallet: address }),
          }
        );

        if (response.ok) {
          // Success! Clear any pending recovery data
          localStorage.removeItem(`pending-claim-${gameId}`);
          setClaimState("success");
          refetchEntry();
          playSound("purchase");
          notify.success("Prize claimed! 🎉");
          return;
        }

        const data = await response.json();

        // If already claimed, treat as success (idempotent)
        if (data.code === "ALREADY_CLAIMED" || data.success) {
          localStorage.removeItem(`pending-claim-${gameId}`);
          setClaimState("success");
          refetchEntry();
          return;
        }

        // Verification failed - don't retry
        if (data.code === "VERIFICATION_FAILED") {
          console.error("[Claim] Verification failed:", data.error);
          setClaimError(data.error || "Verification failed");
          setClaimState("error");
          notify.error(data.error || "Claim verification failed");
          return;
        }

        lastError = data.error || "Sync failed";
      } catch (err) {
        console.error(`[Claim] Sync attempt ${attempt + 1} failed:`, err);
        lastError = err instanceof Error ? err.message : "Sync failed";
      }

      // Wait before retry (exponential backoff: 1s, 2s, 4s, 8s, 16s)
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    // All retries failed - save for recovery on page load
    console.error("[Claim] All sync retries failed, saving for recovery");
    localStorage.setItem(`pending-claim-${gameId}`, JSON.stringify({
      txHash,
      wallet: address,
      timestamp: Date.now(),
    }));

    // Still mark as success since on-chain TX succeeded
    // Backend will catch up on retry or admin can verify
    setClaimState("success");
    refetchEntry();
    playSound("purchase");
    notify.success("Prize claimed! Syncing with server...");
  }, [gameId, address, refetchEntry]);

  // Handle calls status
  useEffect(() => {
    if (!callsStatus) return;

    console.log("[Claim] Calls status:", callsStatus.status);

    if (callsStatus.status === "failure") {
      setClaimError("Transaction failed on-chain");
      setClaimState("error");
      notify.error("Claim failed on-chain. Please try again.");
    }

    if (callsStatus.status === "success") {
      // Extract txHash from receipts
      const txHash = callsStatus.receipts?.[callsStatus.receipts.length - 1]?.transactionHash;
      console.log("[Claim] TX confirmed! Hash:", txHash);

      if (txHash) {
        syncClaimWithBackend(txHash);
      } else {
        console.error("[Claim] No txHash found in receipts!");
        // Still mark as success since on-chain worked
        setClaimState("success");
        refetchEntry();
        playSound("purchase");
        notify.success("Prize claimed!");
      }
    }
  }, [callsStatus, syncClaimWithBackend, refetchEntry]);

  // Handle claim button click
  const handleClaim = useCallback(async () => {
    // Already claimed - do nothing
    if (hasClaimed) {
      notify.info("Already claimed!");
      return;
    }

    // Check if claim window is open
    if (!isClaimWindowOpen) {
      notify.info("Claim window opens in " + claimCountdown);
      return;
    }

    if (!onchainId || !address) {
      notify.error("Cannot claim right now");
      return;
    }

    setClaimState("fetching");
    setClaimError(null);

    try {
      // 1. Fetch merkle proof
      console.log("[Claim] Fetching merkle proof...");
      const proofRes = await authenticatedFetch(`/api/v1/games/${gameId}/merkle-proof`);

      if (!proofRes.ok) {
        const errorData = await proofRes.json();
        // Check if game not settled yet
        if (
          errorData.code === "GAME_NOT_ENDED" ||
          errorData.code === "NO_WINNERS"
        ) {
          setClaimState("pending");
          return;
        }
        throw new Error(errorData.error || "Failed to get proof");
      }

      const { amount, proof, claimedAt } = await proofRes.json();
      console.log(
        "[Claim] Got proof, amount:",
        amount,
        "claimedAt:",
        claimedAt
      );

      // Check if already claimed from response
      if (claimedAt) {
        setClaimState("success");
        refetchEntry();
        notify.info("Prize already claimed!");
        return;
      }

      // 2. Send on-chain claim
      setClaimState("confirming");
      resetSendCalls();

      sendCalls({
        calls: [
          {
            to: contractAddress!,
            data: encodeFunctionData({
              abi: waffleGameAbi,
              functionName: "claimPrize",
              args: [onchainId, BigInt(amount), proof],
            }),
          },
        ],
        ...(builderCodeSendCallsCapability
          ? { capabilities: builderCodeSendCallsCapability }
          : {}),
      });
    } catch (error: unknown) {
      console.error("[Claim] Error:", error);
      setClaimError(error instanceof Error ? error.message : "Claim failed");
      setClaimState("error");
      notify.error(
        error instanceof Error ? error.message : "Failed to claim prize"
      );
    }
  }, [
    onchainId,
    contractAddress,
    address,
    gameId,
    sendCalls,
    resetSendCalls,
    hasClaimed,
    refetchEntry,
    isClaimWindowOpen,
    claimCountdown,
  ]);

  // Get button text based on state
  const getClaimButtonText = () => {
    if (entryLoading) return "Loading...";
    if (hasClaimed || claimState === "success") return "CLAIMED ✓";
    if (!isClaimWindowOpen && claimCountdown)
      return `OPENS IN ${claimCountdown}`;
    if (claimState === "pending") return "RESULTS PENDING";
    if (claimState === "fetching") return "Loading...";
    if (claimState === "confirming" || isSending) return "Claiming...";
    if (claimState === "error") return "RETRY";
    return "CLAIM PRIZE";
  };

  const isClaimDisabled =
    entryLoading ||
    hasClaimed ||
    !isClaimWindowOpen ||
    claimState === "success" ||
    claimState === "pending" ||
    claimState === "fetching" ||
    claimState === "confirming" ||
    isSending;

  // ==========================================
  // RENDER
  // ==========================================

  if (entryLoading) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center">
          <WaffleLoader text="LOADING SCORE..." />
        </div>
        <BottomNav />
      </>
    );
  }

  if (!user || !userScore) {
    return (
      <>
        <div className="flex flex-col text-white items-center justify-center min-h-full">
          <p className="text-lg">Score not found.</p>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <div className="w-full px-4 text-white flex flex-col items-center flex-1 overflow-y-auto">
        <div className="flex flex-col justify-center items-center gap-2 w-[315px] mb-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              duration: 0.6,
              ease: [0.34, 1.56, 0.64, 1],
              delay: 0.1,
            }}
          >
            <Image
              src="/images/illustrations/waffles.svg"
              alt="waffle"
              width={228}
              height={132}
            />
          </motion.div>

          <motion.h1
            className="font-body text-[44px] leading-[92%] text-center tracking-[-0.03em] text-white w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            WAFFLES #{String(gameNumber).padStart(3, "0")}
          </motion.h1>

          <motion.div
            className="flex flex-row justify-center items-center gap-2.5 w-full mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <p className="font-display font-medium text-[16px] leading-[130%] text-center tracking-[-0.03em] text-[#99A0AE] capitalize">
              {game?.theme?.toLowerCase() ?? "trivia"}
            </p>
          </motion.div>
        </div>

        <GameResultCard
          prize={userScore.prize}
          score={userScore.score}
          rank={userScore.rank}
          pfpUrl={user.pfpUrl ?? ""}
          username={user.username ?? "Player"}
        />
        <div className="flex flex-col justify-center items-center gap-3 w-[361px] mt-5">
          {/* Percentile row */}
          <motion.div
            className="flex flex-row items-center gap-1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "easeInOut",
              }}
            >
              <FlashIcon className="w-4 h-4 text-[#FFC931]" />
            </motion.div>
            <span className="font-display font-medium text-[12px] leading-[14px] tracking-[-0.03em] text-white">
              You finished faster than {userScore.percentile}% of other players
            </span>
          </motion.div>

          {/* Buttons container */}
          <div className="flex flex-col items-start gap-5 w-full">
            {/* Claim Prize Button - Only show for winners */}
            {isWinner && (
              <motion.div
                className="w-full"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 }}
                whileHover={!isClaimDisabled ? { scale: 1.02 } : undefined}
                whileTap={!isClaimDisabled ? { scale: 0.98 } : undefined}
              >
                <WaffleButton
                  onClick={handleClaim}
                  disabled={isClaimDisabled}
                  className={
                    claimState === "success" || hasClaimed
                      ? "text-[#14B985] border-[#14B985] opacity-80"
                      : !isClaimWindowOpen
                        ? "text-amber-400 border-amber-400 opacity-80"
                        : claimState === "pending"
                          ? "text-amber-400 border-amber-400 opacity-80"
                          : claimState === "error"
                            ? "text-red-400 border-red-400"
                            : "text-[#14B985] border-[#14B985]"
                  }
                >
                  {(claimState === "confirming" || isSending) && (
                    <Spinner className="w-4 h-4 mr-2" />
                  )}
                  {getClaimButtonText()}
                </WaffleButton>
                {claimState === "pending" && (
                  <p className="text-amber-400 text-xs text-center mt-2">
                    Admin is finalizing results. Check back soon!
                  </p>
                )}
              </motion.div>
            )}

            {/* Share Score & Back to Home row */}
            <motion.div
              className="flex flex-row items-start gap-3 w-full"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.8 }}
            >
              {/* Share Score Button */}
              <motion.button
                className="flex flex-row justify-center items-center p-3 gap-2 flex-1 bg-white/9 border-2 border-white/40 rounded-[12px]"
                onClick={handleShareScore}
                whileHover={{
                  scale: 1.03,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  borderColor: "rgba(255, 255, 255, 0.6)",
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <span className="font-body font-normal text-[18px] leading-[115%] tracking-[-0.02em] text-white">
                  SHARE SCORE
                </span>
              </motion.button>

              {/* Back to Home Button */}
              <motion.div
                className="flex-1"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <Link
                  href="/game"
                  className="flex flex-row justify-center items-center p-3 gap-2 w-full bg-white/9 border-2 border-white/40 rounded-[12px] no-underline hover:bg-white/15 hover:border-white/60 transition-colors duration-200"
                >
                  <span className="font-body font-normal text-[18px] leading-[115%] tracking-[-0.02em] text-white">
                    BACK TO HOME
                  </span>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>

        <Top3Leaderboard
          entries={top3Entries.map((e) => ({
            username: e.user?.username ?? "anon",
            pfpUrl: e.user?.pfpUrl ?? "",
            score: e.score,
          }))}
          gameId={gameId}
        />
      </div>
      <BottomNav />
    </>
  );
}
