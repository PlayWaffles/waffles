"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import {
    staggerContainerVariants,
    wordStaggerVariants,
    fadeUpVariants,
    slideFromLeftVariants,
    slideFromRightVariants,
} from "./AnimationContext";
import { LandingNoise } from "./GradientBlobs";

// Split headline for stagger effect
const speedWords = ["Speed.", "Memory.", "Intuition."];

export function SpeedSection() {
    const sectionRef = useRef<HTMLElement>(null);

    // Parallax scroll effect
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });

    // Different parallax speeds for layers
    const imageY = useTransform(scrollYProgress, [0, 1], [-50, 50]);
    const textY = useTransform(scrollYProgress, [0, 1], [30, -30]);
    const marqueeX = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);

    return (
        <section
            ref={sectionRef}
            className="relative z-20 w-full min-h-[930px] bg-[#FFC931] overflow-x-hidden overflow-y-visible py-20"
        >
            {/* Grain texture overlay */}
            <LandingNoise />
            {/* Left Content with parallax */}
            <motion.div
                className="absolute left-[102px] top-[120px] flex flex-col gap-5 max-w-[752px] max-lg:relative max-lg:left-0 max-lg:px-8"
                style={{ y: textY }}
            >
                {/* Headline - Staggered word animation */}
                <motion.h2
                    variants={staggerContainerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    className="font-body text-[120px] leading-[0.9] tracking-[-0.03em] text-white max-md:text-[60px] flex flex-col"
                >
                    {speedWords.map((word, index) => (
                        <motion.span
                            key={index}
                            variants={wordStaggerVariants}
                            className="inline-block"
                            style={{ transformOrigin: "left center" }}
                        >
                            {word}
                        </motion.span>
                    ))}
                </motion.h2>

                {/* Description */}
                <motion.p
                    variants={fadeUpVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="font-display text-[32px] leading-[1.3] tracking-[-0.03em] text-[#1E1E1E]/70 max-w-[556px] max-md:text-xl"
                >
                    This isn&apos;t about luck. It&apos;s about who can name the movie
                    the fastest. Iconic scenes, obscure gems, and everything in between
                    — all reimagined as visual challenges.
                </motion.p>
            </motion.div>

            {/* Movie Poster with Pink Offset - Enhanced parallax */}
            <motion.div
                variants={slideFromRightVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="absolute right-[86px] top-[120px] max-lg:relative max-lg:right-0 max-lg:mx-auto max-lg:mt-12"
                style={{ y: imageY }}
            >
                {/* Pink Background Offset - Animated entrance */}
                <motion.div
                    className="absolute w-[409px] h-[409px] bg-[#FB72FF] max-md:w-[280px] max-md:h-[280px]"
                    initial={{ x: 0, y: 0, opacity: 0 }}
                    whileInView={{ x: -10, y: -10, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                />

                {/* Image with hover effect */}
                <motion.div
                    className="relative w-[409px] h-[409px] max-md:w-[280px] max-md:h-[280px] overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.4 }}
                >
                    <motion.div
                        className="w-full h-full"
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.6 }}
                    >
                        <Image
                            src="/images/godfather.png"
                            alt="Movie Scene"
                            fill
                            className="object-cover"
                        />
                    </motion.div>

                    {/* Subtle shine on hover */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "200%" }}
                        transition={{ duration: 0.8 }}
                    />
                </motion.div>
            </motion.div>

            {/* Right Side Text */}
            <motion.p
                variants={slideFromRightVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="absolute right-[86px] top-[600px] w-[443px] font-display text-[32px] leading-[1.3] tracking-[-0.03em] text-[#1E1E1E]/70 max-lg:relative max-lg:right-0 max-lg:w-auto max-lg:px-8 max-lg:mt-8 max-md:text-xl"
            >
                You have seconds to name the film. The fastest eyes
                win the biggest share of the pot.
            </motion.p>

            {/* Scrolling Marquee - Enhanced with continuous animation */}
            <div className="absolute bottom-0 left-0 w-full overflow-hidden max-lg:relative max-lg:bottom-0 max-lg:mt-12">
                <motion.div
                    className="flex whitespace-nowrap"
                    style={{ x: marqueeX }}
                >
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 0.1 }}
                        viewport={{ once: true }}
                        className="font-input text-[80px] leading-[1.3] tracking-[-0.03em] text-[#1E1E1E] whitespace-nowrap text-center max-md:text-[40px] pr-8"
                    >
                        How fast can you name the movie? • How fast can you name the movie? •
                    </motion.p>
                </motion.div>
            </div>
        </section>
    );
}
