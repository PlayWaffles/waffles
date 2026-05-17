"use client";

import { useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { WaffleButton } from "@/components/buttons/WaffleButton";
import { useEffect, useRef } from "react";
import { playSound } from "@/lib/sounds";
import { env } from "@/lib/env";
import { FlashIcon } from "@/components/icons";
import { shareTextOrCopy } from "@/lib/share";
import { useUser } from "@/hooks/useUser";
import posthog from "posthog-js";

interface GameCompleteScreenProps {
    score: number;
    gameTheme: string;
    gameId: string;
    gameNumber: number;
}

export default function GameCompleteScreen({
    score,
    gameTheme,
    gameId,
    gameNumber,
}: GameCompleteScreenProps) {
    const hasPlayedSound = useRef(false);
    const { user } = useUser();

    // Play victory sound
    useEffect(() => {
        if (!hasPlayedSound.current) {
            hasPlayedSound.current = true;
            playSound("victory");
        }
    }, []);

    const handleShare = useCallback(async () => {
        try {
            const shareParams = new URLSearchParams({
                score: score.toString(),
                username: user?.username || "Player",
                ...(user?.pfpUrl && { pfpUrl: user.pfpUrl }),
            });
            const embedUrl = `${env.rootUrl}/game/${gameId}/result?${shareParams.toString()}`;

            const result = await shareTextOrCopy({
                title: "Waffles",
                text: `Just dropped ${score.toLocaleString()} pts in Waffles #${String(gameNumber).padStart(3, "0")} 🧇\n\nLive trivia, real prizes — who's next?`,
                url: embedUrl,
            });
            if (result.shared || result.copied) {
                posthog.capture("score_shared", {
                    game_id: gameId,
                    game_number: gameNumber,
                    score,
                    method: result.shared ? "share" : "copy",
                    source: "game_complete",
                });
            }
        } catch (e) {
            console.error("Share failed:", e);
        }
    }, [gameId, gameNumber, score, user?.pfpUrl, user?.username]);

    return (
        <div className="w-full px-4 text-white flex flex-col items-center flex-1 overflow-y-auto pb-8">
            {/* Header: Waffle + Title + Theme */}
            <motion.div
                className="flex flex-col justify-center items-center gap-2 w-[315px]"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                >
                    WAFFLES #{String(gameNumber).padStart(3, "0")}
                </motion.h1>

                <motion.div
                    className="flex flex-row justify-center items-center gap-2.5 w-full font-display"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                >
                    <p className="font-body font-medium text-[16px] leading-[130%] text-center tracking-[-0.03em] text-[#99A0AE] capitalize">
                        {gameTheme?.toLowerCase() ?? "trivia"}
                    </p>
                </motion.div>
            </motion.div>

            {/* Points Card with gradient border */}
            <motion.div
                className="relative w-full max-w-[361px] mt-[27px] rounded-[24px]"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
                {/* Gradient border layer */}
                <div
                    className="absolute inset-0 rounded-[24px] pointer-events-none"
                    style={{
                        padding: "1px",
                        background: "linear-gradient(104.25deg, rgba(20, 185, 133, 0.09) 11.91%, #14B985 120.13%)",
                        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                        maskComposite: "exclude",
                    }}
                />

                {/* Content with transparent gradient background */}
                <div
                    className="relative flex flex-col justify-center items-center p-3 gap-2.5 w-full rounded-[24px]"
                    style={{
                        background: "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(27, 245, 176, 0.12) 100%)",
                    }}
                >
                    {/* Money bag icon */}
                    <motion.div
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{
                            scale: 1,
                            rotate: 0,
                            y: [0, -3, 0],
                        }}
                        transition={{
                            scale: { duration: 0.6, delay: 0.5, ease: [0.34, 1.56, 0.64, 1] },
                            rotate: { duration: 0.6, delay: 0.5, ease: [0.34, 1.56, 0.64, 1] },
                            y: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.1 },
                        }}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                        <Image
                            src="/images/illustrations/money-bag.webp"
                            alt="Money Bag"
                            width={40}
                            height={48}
                            className="object-contain drop-shadow-[0_4px_8px_rgba(20,185,133,0.3)]"
                        />
                    </motion.div>

                    {/* Your Score label */}
                    <motion.div
                        className="flex flex-row justify-between items-center px-2 py-[7px] gap-2.5 w-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.6 }}
                    >
                        <span className="font-display font-medium text-[14px] leading-[130%] tracking-[-0.03em] text-[#99A0AE] mx-auto">
                            Your Score
                        </span>
                    </motion.div>

                    {/* Points amount */}
                    <motion.div
                        className="flex flex-row justify-center items-center gap-1 w-full"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                            duration: 0.5,
                            delay: 0.7,
                            ease: [0.34, 1.56, 0.64, 1],
                        }}
                    >
                        <FlashIcon className="w-7 h-7" />
                        <motion.h2
                            className="font-body text-[48px] leading-[90%] text-white"
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                        >
                            {score.toLocaleString()}
                        </motion.h2>
                    </motion.div>
                </div>
            </motion.div>

            {/* Buttons */}
            <div className="flex flex-col justify-center items-center gap-3 w-full max-w-[361px] mt-6">
                {/* SHARE SCORE button */}
                <motion.div
                    className="w-full"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.85 }}
                    whileHover={{ scale: 1.02, boxShadow: "0 8px 24px rgba(20, 185, 133, 0.25)" }}
                    whileTap={{ scale: 0.98, y: 2 }}
                >
                    <button
                        onClick={handleShare}
                        className="flex flex-col items-center p-3 gap-1 w-full bg-white border-r-[5px] border-b-[5px] border-[#14B985] rounded-[12px] transition-all duration-200 hover:border-r-[3px] hover:border-b-[3px] active:border-r-2 active:border-b-2"
                    >
                        <span className="font-body text-[26px] leading-[115%] tracking-[-0.02em] text-[#14B985] text-center w-full">
                            SHARE SCORE
                        </span>
                    </button>
                </motion.div>

                {/* BACK TO HOME link */}
                <motion.div
                    className="w-full"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.9 }}
                >
                    <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Link
                            href="/game"
                            className="flex flex-row justify-center items-center p-3 gap-2 w-full rounded-[12px] no-underline hover:bg-white/5 transition-colors duration-200"
                        >
                            <span className="font-body text-[18px] leading-[115%] tracking-[-0.02em] text-[#00CFF2]">
                                BACK TO HOME
                            </span>
                        </Link>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
