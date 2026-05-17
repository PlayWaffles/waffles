"use client";

import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import Image from "next/image";
import { useRef, useState } from "react";
import { PixelButton } from "@/components/ui/PixelButton";
import { LandingNoise } from "./GradientBlobs";

// Theme card component - no border, button extends beyond right edge
function ThemeCard({
    image,
    label,
    color,
    index,
}: {
    image: string;
    label: string;
    color: "purple" | "cyan";
    index: number;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Mouse position for tilt effect
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth spring animation for tilt
    const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [3, -3]), { stiffness: 300, damping: 30 });
    const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-3, 3]), { stiffness: 300, damping: 30 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        mouseX.set(x);
        mouseY.set(y);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
        setIsHovered(false);
    };

    return (
        <motion.div
            ref={cardRef}
            className="relative shrink-0 overflow-visible"
            style={{
                width: 338,
                height: 243,
                perspective: 1000,
                zIndex: 50 - index, // Decreasing z-index so previous cards stack on top of next ones
            }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.08 * index }}
        >
            {/* Card with 3D tilt effect - NO BORDER */}
            <motion.div
                className="relative w-full h-full overflow-hidden"
                style={{
                    rotateX: isHovered ? rotateX : 0,
                    rotateY: isHovered ? rotateY : 0,
                    transformStyle: "preserve-3d",
                }}
            >
                {/* Background Image with zoom on hover */}
                <motion.div
                    className="absolute inset-0"
                    animate={{
                        scale: isHovered ? 1.05 : 1,
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    <Image
                        src={image}
                        alt={label}
                        fill
                        className="object-cover"
                    />
                </motion.div>

                {/* Subtle vignette overlay */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.3) 100%)",
                    }}
                />
            </motion.div>

            {/* Pixel Button Label - positioned at left: 97px, top: 167px per Figma */}
            {/* This makes button extend 27px beyond the card's right edge */}
            <motion.div
                className="absolute z-50"
                style={{
                    left: 97,
                    top: 167,
                    width: 268,
                    height: 48,
                }}
                animate={{
                    y: isHovered ? -2 : 0,
                    scale: isHovered ? 1.02 : 1,
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
            >
                <PixelButton
                    variant="filled"
                    colorTheme={color}
                    width={268}
                    height={48}
                    fontSize={20}
                    className="font-body"
                >
                    <span className="font-body">
                        {label}
                    </span>

                </PixelButton>
            </motion.div>
        </motion.div>
    );
}

const themes = [
    { image: "/images/themes/movie-scenes.webp", label: "MOVIE SCENES", color: "purple" as const },
];

export function ThemesSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);

    // Parallax scroll effect
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });

    const carouselX = useTransform(scrollYProgress, [0, 1], [50, -50]);

    return (
        <section
            ref={sectionRef}
            className="relative w-full min-h-screen py-20 md:py-32 overflow-hidden"
            style={{
                background: "linear-gradient(180deg, #FFFEFE 0%, #B01BF5 100%)",
            }}
        >
            {/* Grain texture overlay */}
            <LandingNoise />
            {/* Content Container */}
            <div className="flex flex-col items-center gap-10 md:gap-16">
                {/* Headline Group */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col items-center gap-[60px] text-center max-w-[1100px] px-4 md:px-8"
                >
                    {/* Logo - Frame 1618869185 */}
                    <div className="relative w-[108px] h-[84px]">
                        <Image
                            src="/logo.webp"
                            alt="Waffles Logo"
                            fill
                            className="object-contain"
                        />
                    </div>

                    {/* Text Content - Frame 1618869268 */}
                    <div className="flex flex-col items-center gap-5">
                        <h2 className="font-body text-5xl sm:text-6xl md:text-8xl lg:text-[120px] leading-[0.9] tracking-[-0.03em] text-[#470149] uppercase">
                            MOVIE SCENES
                        </h2>
                        <p className="font-display font-medium text-lg sm:text-xl md:text-2xl lg:text-[32px] leading-[1.3] tracking-[-0.03em] text-[#470149]/70 max-w-[786px]">
                            From blockbusters to cult classics — every game serves up scenes you know and love. Whoever names the film fastest, wins.
                        </p>
                    </div>
                </motion.div>

                {/* Theme Cards - Edge-to-edge carousel with overflow visible for buttons */}
                <div className="w-full overflow-x-auto overflow-y-visible scrollbar-hide">
                    <motion.div
                        ref={carouselRef}
                        className="flex flex-row items-start"
                        style={{
                            gap: 12,
                            // No padding - cards start from edge
                            paddingLeft: 0,
                            paddingRight: 60, // Extra space for last button overflow
                            paddingBottom: 40, // Space for button that extends below
                            x: carouselX,
                        }}
                        drag="x"
                        dragConstraints={{ left: -1000, right: 50 }}
                        dragElastic={0.1}
                        dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
                    >
                        {themes.map((theme, index) => (
                            <ThemeCard
                                key={theme.label}
                                image={theme.image}
                                label={theme.label}
                                color={theme.color}
                                index={index}
                            />
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
