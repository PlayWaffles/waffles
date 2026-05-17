"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useRef } from "react";
import { Cloud1 } from "../icons";
import {
  staggerContainerVariants,
  wordStaggerVariants,
  fadeUpVariants,
  springPresets,
} from "./AnimationContext";
import { LandingNoise } from "./GradientBlobs";

// Cloud configurations with unique parallax speeds
const clouds = [
  { left: "5%", top: "10%", size: 120, speed: 0.3, delay: 0.3 },
  { left: "8%", top: "25%", size: 80, speed: 0.5, delay: 0.5 },
  { left: "15%", top: "35%", size: 60, speed: 0.7, delay: 0.7 },
  { right: "25%", top: "60%", size: 90, speed: 0.4, delay: 0.4 },
  { right: "5%", top: "55%", size: 100, speed: 0.6, delay: 0.6 },
];

export function EarlyPlayersSection() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-based parallax
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Different parallax speeds for elements
  const coinsY = useTransform(scrollYProgress, [0, 1], [-30, 30]);
  const cloudParallax = useTransform(scrollYProgress, [0, 1], [-20, 20]);

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-[930px] overflow-hidden bg-[#00CFF2]"
    >
      {/* Gradient Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "linear-gradient(180deg, #00CFF2 0%, #FFFEFE 100%)",
        }}
      />

      {/* Grain texture overlay */}
      <LandingNoise />

      {/* Decorative Clouds with parallax */}
      {clouds.map((cloud, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: cloud.left ? -30 : 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: cloud.delay }}
          className="absolute z-5 hidden md:block"
          style={{
            left: cloud.left,
            right: cloud.right,
            top: cloud.top,
            y: cloudParallax,
          }}
        >
          {/* Floating animation */}
          <motion.div
            animate={{
              y: [-5 * cloud.speed, 5 * cloud.speed, -5 * cloud.speed],
              x: [-3 * cloud.speed, 3 * cloud.speed, -3 * cloud.speed],
            }}
            transition={{
              duration: 6 + index,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Cloud1 className={`w-[${cloud.size}px] h-auto`} style={{ width: cloud.size }} />
          </motion.div>
        </motion.div>
      ))}

      {/* Content Container - 1440px centered relative */}
      <div className="relative w-full max-w-[1440px] h-full mx-auto z-10">
        {/* Text Block - Positioned per Figma: left: 102px; top: 270px */}
        <div className="absolute top-[200px] lg:top-[270px] left-4 lg:left-[102px] flex flex-col items-start gap-5 w-full max-w-[752px] z-20">
          {/* Headline with stagger */}
          <motion.h2
            variants={staggerContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="font-body font-normal text-[60px] md:text-[90px] lg:text-[120px] leading-[90%] text-white tracking-[-0.03em] self-stretch flex flex-wrap"
          >
            {["EARLY", "PLAYERS", "WIN"].map((word, i) => (
              <motion.span key={i} variants={wordStaggerVariants} className="mr-4">
                {word}
              </motion.span>
            ))}
            <motion.span variants={wordStaggerVariants} className="text-[#006576]">
              TWICE
            </motion.span>
          </motion.h2>

          <motion.p
            variants={fadeUpVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="font-display font-medium text-[20px] md:text-[24px] lg:text-[32px] leading-[130%] text-[#1E1E1E] opacity-70 tracking-[-0.03em] self-stretch"
          >
            It&apos;s conviction rewarded. <br /> It&apos;s how we turn risk
            into reward, and participation into legacy.
          </motion.p>

          {/* Button with pulse and hover effects */}
          <motion.div
            variants={fadeUpVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-col items-start gap-3 w-[337px]"
          >
            <motion.button
              onClick={() =>
                router.push("https://farcaster.xyz/miniapps/sbpPNle-R2-V/waffles")
              }
              className="relative flex items-center justify-center p-3 gap-1 w-full h-[54px] bg-white rounded-xl border-r-[5px] border-b-[5px] border-[#00CFF2] overflow-hidden"
              whileHover={{
                scale: 1.02,
                y: -2,
                boxShadow: "0 10px 30px rgba(0, 207, 242, 0.3)",
              }}
              whileTap={{ scale: 0.98, y: 0 }}
              transition={springPresets.snappy}
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-linear-to-r from-transparent via-[#00CFF2]/10 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              />
              <span className="relative z-10 font-body font-normal text-[26px] leading-[115%] tracking-[-0.02em] text-[#00CFF2] text-center">
                INVITE CODE
              </span>
            </motion.button>
          </motion.div>
        </div>

        {/* Coins and Cloud Group - Enhanced with floating and glint */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: 50 }}
          whileInView={{ opacity: 1, scale: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-[946px] top-[253px] pointer-events-none hidden xl:block"
          style={{ y: coinsY }}
        >
          {/* Large Coin - floating */}
          <motion.div
            className="relative z-10"
            animate={{
              y: [-8, 8, -8],
              rotate: [-2, 2, -2],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Image
              src="/images/illustrations/golden-coin.webp"
              alt="Golden Coin"
              width={381}
              height={379}
              className="object-contain drop-shadow-xl"
            />
            {/* Glint effect */}
            <motion.div
              className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
          </motion.div>

          {/* Small Coin - floating with offset timing */}
          <motion.div
            className="absolute left-[145px] top-[182px] z-20"
            animate={{
              y: [-6, 6, -6],
              rotate: [2, -2, 2],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          >
            <Image
              src="/images/illustrations/golden-coin.webp"
              alt="Golden Coin Small"
              width={240}
              height={239}
              className="object-contain drop-shadow-lg"
            />
            {/* Glint effect */}
            <motion.div
              className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, delay: 1 }}
            />
          </motion.div>

          {/* Cloud - floating gently */}
          <motion.div
            className="absolute left-[-20px] top-[200px] z-30"
            animate={{
              y: [-4, 4, -4],
              x: [-3, 3, -3],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Cloud1 className="w-[173px] h-auto" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
