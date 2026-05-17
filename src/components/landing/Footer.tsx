"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
    staggerContainerVariants,
    staggerItemVariants,
    springPresets,
} from "./AnimationContext";

// Arrow icon component with rotation on hover
function ArrowIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.000207146 11.9484L1.49377 13.442L10.4551 4.48066L11.9487 5.97421L13.4422 4.48066L11.9487 2.9871L13.4422 1.49354L11.9487 -2.15201e-05L10.4551 1.49354L8.96156 -2.11829e-05L7.468 1.49354L8.96156 2.9871L0.000207146 11.9484ZM4.48088 1.49354L5.97444 -2.10143e-05L7.468 1.49354L5.97444 2.9871L4.48088 1.49354ZM4.48088 1.49354L2.98733 2.9871L1.49377 1.49354L2.98733 -2.08457e-05L4.48088 1.49354ZM11.9487 8.96133L13.4422 7.46777L11.9487 5.97421L10.4551 7.46777L11.9487 8.96133ZM11.9487 8.96133L10.4551 10.4549L11.9487 11.9484L13.4422 10.4549L11.9487 8.96133Z" fill="currentColor" />
        </svg>
    );
}

export function Footer() {
    return (
        <motion.footer
            variants={staggerContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="w-full h-[153px] flex items-center justify-center"
            style={{
                background: "linear-gradient(180deg, #1E1E1E 0%, #000000 100%)",
            }}
        >
            <div className="w-full max-w-[1440px] px-4 md:px-[158px] flex justify-between items-center">
                {/* Logo Section with hover animation */}
                <motion.div variants={staggerItemVariants}>
                    <Link href="/" className="flex items-center gap-[9px] group">
                        <motion.div
                            className="relative w-[38px] h-[30px]"
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={springPresets.snappy}
                        >
                            <Image
                                src="/logo.webp"
                                alt="Waffles Logo"
                                fill
                                className="object-contain"
                            />
                            {/* Glow on hover */}
                            <motion.div
                                className="absolute inset-0 bg-[#FFC931]/0 blur-xl -z-10 transition-colors duration-300 group-hover:bg-[#FFC931]/30"
                            />
                        </motion.div>
                        <motion.span
                            className="font-body text-[25px] leading-none text-white tracking-[-0.03em] mt-1 transition-colors group-hover:text-[#FFC931]"
                            whileHover={{ x: 3 }}
                            transition={springPresets.gentle}
                        >
                            WAFFLES
                        </motion.span>
                    </Link>
                </motion.div>

                {/* Social Links */}
                <motion.div
                    variants={staggerItemVariants}
                    className="flex items-center gap-[30px]"
                >
                    {/* X (Twitter) */}
                    <SocialLink
                        href="https://twitter.com"
                        label="X"
                    />

                    {/* Farcaster */}
                    <SocialLink
                        href="https://farcaster.xyz/miniapps/sbpPNle-R2-V/waffles"
                        label="FARCASTER"
                    />
                </motion.div>
            </div>
        </motion.footer>
    );
}

// Animated social link component
function SocialLink({ href, label }: { href: string; label: string }) {
    return (
        <motion.a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 group"
            whileHover={{ y: -2 }}
            transition={springPresets.gentle}
        >
            <span className="font-body text-[25px] leading-none text-white tracking-[-0.03em] transition-colors group-hover:text-[#FFC931] mt-1">
                {label}
            </span>
            <motion.span
                className="text-white transition-colors group-hover:text-[#FFC931]"
                whileHover={{ rotate: 45, scale: 1.1 }}
                transition={springPresets.snappy}
            >
                <ArrowIcon />
            </motion.span>
        </motion.a>
    );
}
