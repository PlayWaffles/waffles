"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import {
    staggerContainerVariants,
    wordStaggerVariants,
    fadeUpVariants,
    springPresets,
} from "./AnimationContext";
import { LandingNoise } from "./GradientBlobs";

// Split headline for stagger
const headlineWords = ["Compete", "for", "the", "biggest"];
const highlightWords = ["prize", "pool"];
const endWords = ["on", "Farcaster."];

export function CompeteSection() {
    const sectionRef = useRef<HTMLElement>(null);

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });

    // Treasure chest parallax - moves slower than scroll
    const chestY = useTransform(scrollYProgress, [0, 1], [-30, 30]);
    const glowScale = useTransform(scrollYProgress, [0.2, 0.5], [0.8, 1.2]);

    return (
        <section
            ref={sectionRef}
            className="relative z-20 w-full min-h-screen md:h-[930px] bg-[#14B985] overflow-visible"
        >
            {/* Grain texture overlay */}
            <LandingNoise />
            {/* Treasure Chest - with bouncy entrance and floating */}
            <motion.div
                initial={{ opacity: 0, y: -100, scale: 0.8 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    delay: 0.2,
                }}
                className="absolute left-1/2 -translate-x-1/2 -top-14 md:-top-16 lg:-top-20 w-64 sm:w-80 md:w-96 lg:w-[424px] h-auto z-20"
                style={{ y: chestY }}
            >
                {/* Glow effect behind chest */}
                <motion.div
                    className="absolute inset-0 bg-gradient-radial from-[#FFD700]/40 via-[#FFD700]/10 to-transparent rounded-full blur-3xl -z-10 scale-150"
                    style={{ scale: glowScale }}
                    animate={{
                        opacity: [0.4, 0.7, 0.4],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Floating container */}
                <motion.div
                    animate={{
                        y: [-5, 5, -5],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
                    <Image
                        src="/images/illustrations/treasure-chest.webp"
                        alt="Treasure Chest"
                        width={424}
                        height={395}
                        className="object-contain drop-shadow-2xl"
                    />
                </motion.div>

                {/* Sparkle particles around chest */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-yellow-300 rounded-full"
                        style={{
                            left: `${20 + Math.random() * 60}%`,
                            top: `${20 + Math.random() * 60}%`,
                        }}
                        animate={{
                            scale: [0, 1, 0],
                            opacity: [0, 1, 0],
                            y: [-10, -30],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.3,
                            ease: "easeOut",
                        }}
                    />
                ))}
            </motion.div>

            {/* Content Container - centered */}
            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 md:top-[369px] -translate-y-1/2 md:translate-y-0 flex flex-col justify-center items-center gap-5 w-full max-w-[1094px] px-4 md:px-8 pt-48 md:pt-0">
                {/* Headline - Staggered word animation */}
                <motion.h2
                    variants={staggerContainerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="font-body text-4xl sm:text-5xl md:text-7xl lg:text-8xl xl:text-[120px] leading-[0.9] text-center tracking-tight text-white flex flex-wrap justify-center gap-x-3 md:gap-x-5"
                >
                    {headlineWords.map((word, i) => (
                        <motion.span key={`h-${i}`} variants={wordStaggerVariants}>
                            {word}
                        </motion.span>
                    ))}
                    {highlightWords.map((word, i) => (
                        <motion.span
                            key={`p-${i}`}
                            variants={wordStaggerVariants}
                            className="text-[#0A5C42]"
                        >
                            {word}
                        </motion.span>
                    ))}
                    {endWords.map((word, i) => (
                        <motion.span key={`e-${i}`} variants={wordStaggerVariants}>
                            {word}
                        </motion.span>
                    ))}
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                    variants={fadeUpVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="font-display font-medium text-lg sm:text-xl md:text-2xl lg:text-[32px] leading-[1.3] text-center tracking-tight text-[#1E1E1E]/70 max-w-[586px]"
                >
                    Win, lose, or almost — every game earns you a story worth sharing.
                </motion.p>
            </div>
        </section>
    );
}
