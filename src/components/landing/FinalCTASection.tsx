"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import {
    staggerContainerVariants,
    wordStaggerVariants,
    springPresets,
} from "./AnimationContext";
import { useMagneticEffect } from "./useAnimationHooks";
import { TextScramble } from "./TextScramble";
import { FloatingParticles, LandingNoise } from "./GradientBlobs";

// Headline words for stagger
const headlineWords = ["Can", "You", "Name", "The", "Movie?"];

export function FinalCTASection() {
    const router = useRouter();
    const sectionRef = useRef<HTMLElement>(null);
    const magnetic = useMagneticEffect(0.25);

    // Parallax for watermark
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });
    const watermarkX = useTransform(scrollYProgress, [0, 1], [-50, 50]);

    return (
        <section
            ref={sectionRef}
            className="relative w-full min-h-[763px] overflow-hidden flex flex-col items-center justify-center py-20"
            style={{
                backgroundColor: "#FFC931",
            }}
        >
            {/* Grain texture overlay */}
            <LandingNoise />

            {/* Floating particles */}
            <FloatingParticles count={15} color="#493601" className="opacity-20" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center gap-[60px] text-center max-w-[1200px] px-4 md:px-8">
                {/* Logo - Breathing animation */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-[112px] h-[85px]"
                >
                    <motion.div
                        animate={{
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    >
                        <svg width="112" height="85" viewBox="0 0 112 85" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.1108 64.8675H40.2216V84.9998H0V20.1313H20.1108V64.8675Z" fill="#493601" />
                            <path d="M91.1692 85H71.0586V64.8677H91.1692V85Z" fill="#493601" />
                            <path d="M111.279 64.8676H91.1686V20.1314H20.1104V0H111.279V64.8676Z" fill="#493601" />
                            <path fillRule="evenodd" clipRule="evenodd" d="M42.241 39.1888H49.5251V47.4756H42.241V54.1083H34.2918V47.4756H27.0488V39.1888H34.2918V31.7324H42.241V39.1888Z" fill="#493601" />
                            <path d="M73.0692 32.8813C78.6223 32.8813 83.1234 37.3878 83.1234 42.9471C83.1234 48.5061 78.6223 53.0128 73.0692 53.0128C67.516 53.0128 63.0137 48.5061 63.0137 42.9471C63.0137 37.3878 67.516 32.8813 73.0692 32.8813Z" fill="#493601" />
                        </svg>
                    </motion.div>
                    {/* Subtle glow */}
                    <motion.div
                        className="absolute inset-0 bg-[#493601]/20 blur-xl -z-10"
                        animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.3, 0.5, 0.3],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                </motion.div>

                {/* Headline - Staggered word reveal with scramble */}
                <motion.h2
                    variants={staggerContainerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="font-body text-4xl sm:text-6xl md:text-8xl lg:text-[120px] leading-[0.9] tracking-[-0.03em] text-[#493601] uppercase flex flex-wrap justify-center gap-x-3 md:gap-x-5"
                >
                    {headlineWords.map((word, index) => (
                        <motion.span
                            key={index}
                            variants={wordStaggerVariants}
                            className="inline-block"
                        >
                            <TextScramble
                                text={word}
                                trigger="inView"
                                revealDelay={index * 100}
                                scrambleSpeed={40}
                            />
                        </motion.span>
                    ))}
                </motion.h2>

                {/* CTA Button with magnetic effect */}
                <motion.div
                    ref={magnetic.ref}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    style={{
                        x: magnetic.x,
                        y: magnetic.y,
                    }}
                    data-cursor-hover
                    data-cursor-text="Enter"
                >
                    <motion.button
                        className="relative w-[337px] h-[54px] bg-white rounded-xl flex items-center justify-center font-body text-[26px] tracking-[-0.02em] text-[#493601] overflow-hidden"
                        style={{
                            borderRight: "5px solid #493601",
                            borderBottom: "5px solid #493601",
                        }}
                        whileHover={{
                            scale: 1.05,
                            y: -3,
                            boxShadow: "0 15px 40px rgba(73, 54, 1, 0.25)",
                        }}
                        whileTap={{
                            scale: 0.98,
                            y: 0,
                        }}
                        transition={springPresets.snappy}
                        onClick={() => {
                            router.push("https://farcaster.xyz/miniapps/sbpPNle-R2-V/waffles");
                        }}
                    >
                        {/* Animated shine effect */}
                        <motion.div
                            className="absolute inset-0 bg-linear-to-r from-transparent via-[#493601]/10 to-transparent"
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
                        />
                        <span className="relative z-10">INVITE CODE</span>
                    </motion.button>
                </motion.div>
            </div>

            {/* Footer Watermark Text with parallax */}
            <motion.div
                className="absolute bottom-[10px] left-0 w-full text-center pointer-events-none overflow-hidden"
                style={{ x: watermarkX }}
            >
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 0.1 }}
                    viewport={{ once: true }}
                    className="font-input text-4xl md:text-[80px] leading-[1.3] tracking-[-0.03em] text-[#1E1E1E] uppercase whitespace-nowrap"
                >
                    Lights, camera, compete • Lights, camera, compete • Lights, camera, compete
                </motion.p>
            </motion.div>
        </section>
    );
}
