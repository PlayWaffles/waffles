"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { GameSummaryCard } from "../_components/GameSummary";
import { BottomNav } from "@/components/BottomNav";
import confetti from "canvas-confetti";
import {
    createGameCalendarEvent,
    getGoogleCalendarUrl,
    downloadICS
} from "@/lib/calendar";
import { shareTextOrCopy } from "@/lib/share";
import { useUser } from "@/hooks/useUser";
import { authenticatedFetch } from "@/lib/client/runtime";

interface TicketSuccessClientProps {
    gameId: string;
    theme: string;
    coverUrl: string;
    prizePool: number;
    startsAt: string;
    endsAt: string;
    ticketCode?: string;
}

export function TicketSuccessClient({
    gameId,
    theme,
    coverUrl,
    prizePool,
    startsAt,
    endsAt,
    ticketCode,
}: TicketSuccessClientProps) {
    const { user } = useUser();
    const [showCalendarOptions, setShowCalendarOptions] = useState(false);
    const hasCelebrated = useRef(false);
    const [userInfo, setUserInfo] = useState<{
        fid: number | null;
        username: string | null;
        pfpUrl: string | null;
    } | null>(null);

    // Celebration confetti on mount
    useEffect(() => {
        if (hasCelebrated.current) return;
        hasCelebrated.current = true;

        // Fire confetti burst
        const fireConfetti = () => {
            // Center burst
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#FFC931", "#14B985", "#FB72FF", "#00CFF2"],
            });

            // Side bursts with delay
            setTimeout(() => {
                confetti({
                    particleCount: 40,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.7 },
                    colors: ["#FFC931", "#14B985"],
                });
                confetti({
                    particleCount: 40,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.7 },
                    colors: ["#FB72FF", "#00CFF2"],
                });
            }, 200);
        };

        fireConfetti();
    }, []);

    // Fetch user info on mount
    useEffect(() => {
        async function fetchUser() {
            try {
                const res = await authenticatedFetch(`/api/v1/users/me`);
                if (res.ok) {
                    setUserInfo(await res.json());
                }
            } catch (error) {
                console.error("Error fetching user:", error);
            }
        }
        fetchUser();
    }, [user?.id]);

    // Create calendar event
    const calendarEvent = createGameCalendarEvent(
        theme,
        prizePool,
        new Date(startsAt),
        new Date(endsAt),
        `${env.rootUrl}/game`
    );

    // Calendar handlers
    const handleAddToGoogle = useCallback(() => {
        const url = getGoogleCalendarUrl(calendarEvent);
        window.open(url, "_blank", "noopener,noreferrer");
        setShowCalendarOptions(false);
    }, [calendarEvent]);

    const handleAddToApple = useCallback(() => {
        downloadICS(calendarEvent);
        setShowCalendarOptions(false);
    }, [calendarEvent]);

    const shareTicket = useCallback(async () => {
        try {
            const result = await shareTextOrCopy({
                title: "Waffles",
                text: `I just joined the next Waffles game! Theme: ${theme}. Prize Pool: $${prizePool.toLocaleString()}.`,
                url: `${env.rootUrl}/game/${gameId}`,
            });

            if (!result.shared && !result.copied) {
                console.log("User cancelled the share action");
            }
        } catch (error) {
            console.error("Error sharing cast:", error);
        }
    }, [theme, prizePool, ticketCode, gameId]);

    return (
        <>
            <div className="min-h-dvh flex flex-col items-center justify-center overflow-y-auto px-5 pb-24">
                <motion.div
                    className="flex flex-col items-center w-full max-w-[420px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* Waffle Image */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{
                            duration: 0.6,
                            ease: [0.34, 1.56, 0.64, 1],
                        }}
                    >
                        <Image
                            src="/images/illustrations/waffles.svg"
                            alt="Pixel waffle"
                            width={200}
                            height={100}
                            priority
                            className="mb-5 h-auto w-[150px]"
                        />
                    </motion.div>

                    {/* Title */}
                    <motion.h1
                        className="text-foreground text-center font-body"
                        style={{
                            fontSize: "42px",
                            lineHeight: "0.92",
                            letterSpacing: "-0.03em",
                        }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
                    >
                        WAFFLE SECURED!
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        className="mt-3 text-center text-base font-display text-[#99A0AE]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                    >
                        You&apos;re in! Good luck 🍀
                    </motion.p>

                    {/* Game Summary Card */}
                    <GameSummaryCard theme={theme} coverUrl={coverUrl} prizePool={prizePool} />

                    {/* Share Button */}
                    <motion.button
                        onClick={shareTicket}
                        className={cn(
                            "mt-8 w-full rounded-[14px] bg-white px-6 py-4 text-center font-body text-2xl text-[#FB72FF]",
                            "border-r-[5px] border-b-[5px] border-[#FB72FF]"
                        )}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.4 }}
                        whileHover={{
                            scale: 1.02,
                            boxShadow: "0 10px 30px rgba(251, 114, 255, 0.3)",
                        }}
                        whileTap={{ scale: 0.98, x: 2, y: 2 }}
                    >
                        SHARE TICKET
                    </motion.button>

                    {/* Add to Calendar & Back to Home row */}
                    <motion.div
                        className="flex flex-row items-start gap-3 w-full mt-4"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.7 }}
                    >
                        {/* Add to Calendar Button */}
                        <motion.div
                            className="relative flex-1"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ duration: 0.2 }}
                        >
                            <button
                                onClick={() => setShowCalendarOptions(!showCalendarOptions)}
                                className="flex flex-row justify-center items-center p-3 gap-2 w-full bg-white/9 border-2 border-white/40 rounded-[12px] hover:bg-white/15 hover:border-white/60 transition-colors duration-200"
                            >
                                <span className="font-body font-normal text-[18px] leading-[115%] tracking-[-0.02em] text-white whitespace-nowrap">
                                    📅 ADD TO CAL
                                </span>
                            </button>

                            {/* Calendar Options Dropdown */}
                            <AnimatePresence>
                                {showCalendarOptions && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-[#2A2A2A] rounded-xl border border-white/20 overflow-hidden z-50"
                                    >
                                        <button
                                            onClick={handleAddToGoogle}
                                            className="w-full px-4 py-3 text-left font-body text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                                        >
                                            <span className="text-xl">📆</span>
                                            Google Calendar
                                        </button>
                                        <div className="h-px bg-white/10" />
                                        <button
                                            onClick={handleAddToApple}
                                            className="w-full px-4 py-3 text-left font-body text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                                        >
                                            <span className="text-xl">🍎</span>
                                            Apple / Outlook
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

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
                </motion.div>
            </div>
            <BottomNav />
        </>
    );
}
