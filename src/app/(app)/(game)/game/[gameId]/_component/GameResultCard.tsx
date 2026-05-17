"use client";

import Image from "next/image";
import { FlashIcon, TrendIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
    prize: number;
    score: number;
    rank: number;
    username: string;
    pfpUrl: string;
    className?: string;
}

export default function GameResultCard({
    prize,
    score,
    rank,
    username,
    pfpUrl,
    className,
}: Props) {
    return (
        <motion.div
            className={cn("relative w-full rounded-[24px]", className)}
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

            {/* Content with correct background gradient */}
            <div
                className="relative flex flex-col justify-center items-start p-3 gap-3 w-full rounded-[24px]"
                style={{
                    background: "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(27, 245, 176, 0.12) 100%)",
                }}
            >
                {/* ─── Top Section: Winnings Label, User, Amount & Trophy ─── */}
                <div className="flex flex-col justify-center items-start gap-3 w-full">
                    {/* Row: Winnings Label & User Profile */}
                    <motion.div
                        className="flex flex-row justify-between items-center px-2 py-[7px] gap-2.5 w-full"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.5 }}
                    >
                        <span className="font-display font-medium text-[14px] leading-[130%] tracking-[-0.03em] text-[#99A0AE]">
                            Prize
                        </span>

                        <div className="flex flex-row items-center gap-2.5">
                            <motion.div
                                className="relative w-[18px] h-[18px] rounded-full overflow-hidden bg-[#D9D9D9] shrink-0"
                                whileHover={{ scale: 1.15 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Image
                                    width={18}
                                    height={18}
                                    unoptimized={true}
                                    src={pfpUrl || "/images/avatars/a.webp"}
                                    alt={username}
                                    className="object-cover w-full h-full"
                                />
                            </motion.div>
                            <span className="font-body text-[18px] leading-[100%] text-white uppercase truncate max-w-[120px]">
                                {username}
                            </span>
                        </div>
                    </motion.div>

                    {/* Row: Big Money & Trophy */}
                    <motion.div
                        className="flex flex-row justify-between items-center gap-3 w-full"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.55 }}
                    >
                        <motion.h2
                            className="font-body text-[40px] sm:text-[48px] leading-[90%] text-[#14B985]"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: 0.6 }}
                        >
                            {rank > 0 ? `$${prize.toLocaleString()}` : "Pending"}
                        </motion.h2>

                        <motion.div
                            className="relative w-[38px] h-[48px] shrink-0"
                            initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{
                                duration: 0.6,
                                delay: 0.65,
                                ease: [0.34, 1.56, 0.64, 1],
                            }}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                        >
                            <Image
                                src="/images/trophies/gold.svg"
                                alt="Winner Trophy"
                                fill
                                className="object-contain"
                            />
                        </motion.div>
                    </motion.div>
                </div>

                {/* ─── Bottom Row: Stats Grid ─── */}
                <div className="flex flex-row items-start gap-3 w-full">
                    {/* Score Box */}
                    <motion.div
                        className="flex flex-col items-start p-3 gap-2 flex-1 min-w-0 bg-white/3 border border-white/8 rounded-[16px]"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.7 }}
                        whileHover={{
                            scale: 1.03,
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                        }}
                    >
                        <span className="font-display font-medium text-[14px] leading-[130%] tracking-[-0.03em] text-[#99A0AE]">
                            Score
                        </span>
                        <div className="flex flex-row items-center gap-1">
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatDelay: 4,
                                    ease: "easeInOut",
                                }}
                            >
                                <FlashIcon className="w-6 h-6 text-[#FFC931] shrink-0" />
                            </motion.div>
                            <span className="font-body text-[20px] leading-[100%] text-white">
                                {score.toLocaleString()}
                            </span>
                        </div>
                    </motion.div>

                    {/* Rank Box */}
                    <motion.div
                        className="flex flex-col items-start p-3 gap-2 flex-1 min-w-0 bg-white/3 border border-white/8 rounded-[16px]"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.8 }}
                        whileHover={{
                            scale: 1.03,
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                        }}
                    >
                        <span className="font-display font-medium text-[14px] leading-[130%] tracking-[-0.03em] text-[#99A0AE]">
                            Rank
                        </span>
                        <div className="flex flex-row items-center gap-1">
                            <motion.div
                                animate={{
                                    y: [0, -3, 0],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    repeatDelay: 3,
                                    ease: "easeInOut",
                                }}
                            >
                                <TrendIcon className="w-6 h-6 text-[#14B985] shrink-0" />
                            </motion.div>
                            <span className="font-body text-[20px] leading-[100%] text-white">
                                {rank > 0 ? rank : "Pending"}
                            </span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}
