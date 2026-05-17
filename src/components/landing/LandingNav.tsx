"use client";

import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useScrollDirection, useScrollBlur } from "./useAnimationHooks";
import { springPresets } from "./AnimationContext";

export function LandingNav() {
    const { isVisible, scrollY } = useScrollDirection();
    const blur = useScrollBlur(24);

    // Magnetic effect for CTA button
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springX = useSpring(mouseX, springPresets.magnetic);
    const springY = useSpring(mouseY, springPresets.magnetic);

    const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        mouseX.set(x * 0.15);
        mouseY.set(y * 0.15);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.nav
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed top-4 md:top-[30px] left-1/2 -translate-x-1/2 z-50 w-[95%] md:w-[1160px] max-w-full h-16 md:h-20 flex justify-between items-center gap-2.5 pl-6 md:pl-8 pr-3 md:pr-4 py-3 md:py-4 rounded-full"
                    style={{
                        backgroundColor: scrollY > 50 ? "rgba(30, 30, 30, 0.8)" : "rgba(255, 255, 255, 0.1)",
                        backdropFilter: `blur(${blur}px)`,
                        WebkitBackdropFilter: `blur(${blur}px)`,
                        transition: "background-color 0.3s ease",
                    }}
                >
                    {/* Logo + Waffles Text with hover animation */}
                    <Link href="/" className="flex items-center gap-1.5 group">
                        <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={springPresets.snappy}
                        >
                            <Image
                                src="/logo.webp"
                                alt="Waffles"
                                width={30}
                                height={22}
                                className="h-5 w-auto"
                            />
                        </motion.div>
                        <motion.span
                            className="font-body text-white text-xl md:text-2xl tracking-tight"
                            whileHover={{ x: 2 }}
                            transition={springPresets.gentle}
                        >
                            WAFFLES
                        </motion.span>
                    </Link>

                    {/* Navigation Links + CTA */}
                    <div className="flex items-center justify-end gap-4 md:gap-6 h-10 md:h-12">
                        {/* Nav Links - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-6">
                            <NavLink href="https://x.com/playwaffles" external>How to play</NavLink>
                            <NavLink href="#faqs">FAQs</NavLink>
                        </div>

                        {/* CTA Button with magnetic effect */}
                        <motion.div
                            style={{ x: springX, y: springY }}
                        >
                            <Link
                                href="https://farcaster.xyz/miniapps/sbpPNle-R2-V/waffles"
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                                className="relative flex items-center justify-center px-4 md:px-6 py-2.5 md:py-3 bg-[#FFC931] rounded-full font-body text-base md:text-xl leading-tight tracking-tight text-[#1E1E1E] text-center overflow-hidden"
                            >
                                <motion.span
                                    className="relative z-10"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Play on Farcaster
                                </motion.span>
                                {/* Shine effect */}
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full"
                                    animate={{ translateX: ["100%", "-100%"] }}
                                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                                />
                            </Link>
                        </motion.div>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
    );
}

// Animated nav link component
function NavLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
    return (
        <Link
            href={href}
            className="relative group"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
            <span className="font-display font-medium text-base leading-tight tracking-tight text-white text-center transition-colors group-hover:text-white/80">
                {children}
            </span>
            {/* Animated underline */}
            <motion.span
                className="absolute -bottom-1 left-0 h-0.5 bg-[#FFC931] origin-left"
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: "100%" }}
            />
        </Link>
    );
}
