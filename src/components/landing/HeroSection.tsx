"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import {
    staggerContainerVariants,
    wordStaggerVariants,
    fadeUpVariants,
    fadeScaleVariants,
    floatingVariants,
    springPresets,
} from "./AnimationContext";
import { useMouseParallax, useMagneticEffect } from "./useAnimationHooks";
import { TextScramble } from "./TextScramble";
import { FloatingParticles, LandingNoise } from "./GradientBlobs";

// Headline lines for explicit line breaks
const headlineLines = [
    ["GUESS", "THE"],
    ["MOVIE", "SCENE"],
];

export function HeroSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const { layer1, layer2 } = useMouseParallax(15);
    const magnetic = useMagneticEffect(0.2);

    // Scroll-based parallax for character
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start start", "end start"],
    });
    const characterY = useTransform(scrollYProgress, [0, 1], [0, 100]);
    const contentY = useTransform(scrollYProgress, [0, 1], [0, 50]);

    return (
        <section
            ref={sectionRef}
            className="relative w-full min-h-screen md:h-[930px] overflow-visible"
            style={{
                background: `linear-gradient(180deg, #1E1E1E 0%, #000000 100%)`,
            }}
        >
            {/* Floating particles for ambient effect */}
            <FloatingParticles count={30} color="#FFC931" className="opacity-40" />

            {/* Grain texture overlay - on background only, behind content */}
            {/* <LandingNoise /> */}

            {/* Subtle ambient layer with parallax */}
            <motion.div
                className="absolute inset-0 pointer-events-none opacity-20 z-[2]"
                style={{ x: layer2.x, y: layer2.y }}
            >
                {/* Gradient orbs for depth */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-radial from-[#FFC931]/10 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-1/3 right-1/3 w-64 h-64 bg-gradient-radial from-[#FF6B6B]/10 to-transparent rounded-full blur-3xl" />
            </motion.div>

            {/* Content Container - centered with parallax */}
            <motion.div
                className="absolute left-1/2 -translate-x-1/2 top-48 md:top-[237px] flex flex-col items-center gap-6 md:gap-8 w-full max-w-[801px] px-4 md:px-0"
                style={{ y: contentY }}
            >
                {/* Main Headline - Two lines with explicit structure */}
                <motion.h1
                    variants={staggerContainerVariants}
                    initial="hidden"
                    animate="visible"
                    className="font-body text-[48px] sm:text-[72px] md:text-[100px] lg:text-[140px] leading-[0.9] text-center tracking-[-0.03em] text-white flex flex-col items-center w-full"
                >
                    {headlineLines.map((line, lineIndex) => (
                        <div key={lineIndex} className="flex justify-center gap-x-4 md:gap-x-6">
                            {line.map((word, wordIndex) => {
                                const globalIndex = lineIndex === 0 ? wordIndex : 2 + wordIndex;
                                return (
                                    <motion.span
                                        key={wordIndex}
                                        variants={wordStaggerVariants}
                                        className="inline-block"
                                        style={{
                                            transformStyle: "preserve-3d",
                                        }}
                                    >
                                        <TextScramble
                                            text={word}
                                            trigger="mount"
                                            revealDelay={300 + globalIndex * 150}
                                            scrambleSpeed={40}
                                        />
                                    </motion.span>
                                );
                            })}
                        </div>
                    ))}
                </motion.h1>

                {/* Subtitle with fade up */}
                <motion.p
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.5 }}
                    className="font-display font-medium text-lg sm:text-xl md:text-2xl lg:text-[28px] leading-[1.3] text-center tracking-[-0.03em] text-white/70 max-w-[453px]"
                >
                    Spot the film from a single scene faster than everyone else and win real prizes
                </motion.p>

                {/* CTA Button with magnetic effect and 3D press */}
                <motion.div
                    ref={magnetic.ref}
                    variants={fadeScaleVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.7 }}
                    className="mt-4"
                    style={{
                        x: magnetic.x,
                        y: magnetic.y,
                    }}
                    data-cursor-hover
                    data-cursor-text="Click"
                >
                    <motion.a
                        href="https://farcaster.xyz/miniapps/sbpPNle-R2-V/waffles"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative flex items-center justify-center w-full sm:w-[337px] h-[54px] p-3 bg-white rounded-xl font-body text-[20px] sm:text-[26px] leading-[1.15] tracking-[-0.02em] text-[#FBB03B] text-center overflow-hidden"
                        style={{
                            borderRight: "5px solid #FBB03B",
                            borderBottom: "5px solid #FBB03B",
                        }}
                        whileHover={{
                            scale: 1.02,
                            y: -2,
                            boxShadow: "0 10px 30px rgba(251, 176, 59, 0.3)",
                        }}
                        whileTap={{
                            scale: 0.98,
                            y: 0,
                            boxShadow: "0 2px 10px rgba(251, 176, 59, 0.2)",
                        }}
                        transition={springPresets.snappy}
                    >
                        {/* Animated shine effect */}
                        <motion.div
                            className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent"
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                repeatDelay: 3,
                                ease: "easeInOut",
                            }}
                        />
                        <span className="relative z-10">PLAY NOW</span>
                    </motion.a>
                </motion.div>
            </motion.div>

            {/* Hero Character/Globe - right-aligned, extending below section */}
            <motion.div
                initial={{ opacity: 0, x: 80, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                    duration: 0.8,
                    delay: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute right-[2.5%] sm:right-[2.5%] md:right-0 -bottom-20 translate-y-[30%] w-[70vw] sm:w-[55vw]  max-w-[700px] h-auto z-20"
                style={{
                    y: characterY,
                }}
            >
                {/* Floating wrapper */}
                <motion.div
                    variants={floatingVariants}
                    initial="initial"
                    animate="animate"
                >
                    <Image
                        src="/images/hero-character.webp"
                        alt="Waffles Character"
                        width={413}
                        height={515}
                        className="object-contain drop-shadow-2xl w-full h-auto"
                        priority
                    />
                </motion.div>

                {/* Subtle glow behind character */}
                <motion.div
                    className="absolute -inset-8 bg-gradient-radial from-[#FFC931]/20 via-transparent to-transparent rounded-full blur-3xl -z-10"
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </motion.div>
        </section>
    );
}
