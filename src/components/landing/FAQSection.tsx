"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { LandingNoise } from "./GradientBlobs";

// FAQ Data
const faqs = [
    {
        question: "What is Waffles?",
        answer: "Waffles is a real-time movie trivia game where you compete against other players to guess the film from a single scene. The faster you answer, the more you earn.",
    },
    {
        question: "How do I win money?",
        answer: "Buy a ticket to enter a game, then guess movie scenes correctly and quickly to earn points. The faster you answer, the more points you get. At the end of each game, the prize pool is split among the top performers.",
    },
    {
        question: "How much does it cost to play?",
        answer: "Each game has a set ticket price in USDC. The ticket price goes straight into the prize pool, so bigger games mean bigger rewards. You can see the current prize pool before joining.",
    },
    {
        question: "When are games played?",
        answer: "Games run on a regular schedule. Each game has a set start time, and you'll need your ticket before the game begins. Check the app for upcoming game times!",
    },
    {
        question: "What kind of movies are featured?",
        answer: "Everything from blockbusters to cult classics, iconic scenes to deep cuts. Each game serves up a mix of scenes to test both casual fans and movie buffs alike.",
    },
    {
        question: "How do I get started?",
        answer: "Open Waffles on Farcaster or MiniPay, grab a ticket for an upcoming game, and you're in. No setup needed — just bring your movie knowledge.",
    },
];

// Animated plus/minus icon
function ToggleIcon({ isOpen }: { isOpen: boolean }) {
    return (
        <div className="relative w-8 h-8 flex items-center justify-center">
            {/* Horizontal line (always visible) */}
            <motion.div
                className="absolute w-5 h-0.5 bg-white rounded-full"
                initial={false}
            />
            {/* Vertical line (rotates to disappear) */}
            <motion.div
                className="absolute w-5 h-0.5 bg-white rounded-full"
                initial={false}
                animate={{ rotate: isOpen ? 0 : 90 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* Glow effect when open */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="absolute inset-0 bg-[#FFC931]/20 rounded-full blur-lg"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1.5 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.3 }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Single FAQ Item
function FAQItem({
    question,
    answer,
    index,
    isOpen,
    onToggle,
}: {
    question: string;
    answer: string;
    index: number;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="group"
        >
            <motion.button
                onClick={onToggle}
                className="w-full text-left"
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2 }}
            >
                {/* Question Row */}
                <div
                    className={`
                        relative flex items-center justify-between gap-4 py-6 px-6
                        border-b transition-all duration-300
                        ${isOpen
                            ? "border-[#FFC931]/40 bg-white/5"
                            : "border-white/10 hover:border-white/30"
                        }
                    `}
                >
                    {/* Number Badge */}
                    <div className="flex items-center gap-5">
                        <motion.span
                            className={`
                                flex items-center justify-center w-10 h-10 rounded-full
                                font-body text-lg font-medium transition-all duration-300
                                ${isOpen
                                    ? "bg-[#FFC931] text-[#1E1E1E]"
                                    : "bg-white/10 text-white/60 group-hover:bg-white/20"
                                }
                            `}
                            animate={{ scale: isOpen ? 1.1 : 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            {String(index + 1).padStart(2, "0")}
                        </motion.span>

                        {/* Question Text */}
                        <h3 className={`
                            font-display font-medium text-xl md:text-2xl tracking-tight
                            transition-colors duration-300
                            ${isOpen ? "text-[#FFC931]" : "text-white group-hover:text-white/90"}
                        `}>
                            {question}
                        </h3>
                    </div>

                    {/* Toggle Icon */}
                    <ToggleIcon isOpen={isOpen} />

                    {/* Hover glow line */}
                    <motion.div
                        className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#FFC931] to-transparent"
                        initial={{ width: "0%" }}
                        animate={{ width: isOpen ? "100%" : "0%" }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                </div>
            </motion.button>

            {/* Answer (Collapsible) */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                            height: "auto",
                            opacity: 1,
                            transition: {
                                height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                                opacity: { duration: 0.3, delay: 0.1 }
                            }
                        }}
                        exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                                height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                                opacity: { duration: 0.2 }
                            }
                        }}
                        className="overflow-hidden"
                    >
                        <motion.div
                            initial={{ y: -10 }}
                            animate={{ y: 0 }}
                            exit={{ y: -10 }}
                            className="px-6 py-6 pl-[84px] bg-white/[0.02]"
                        >
                            <p className="font-display text-lg leading-relaxed text-white/70 max-w-3xl">
                                {answer}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const handleToggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section
            id="faqs"
            className="relative w-full py-24 md:py-32 overflow-hidden"
            style={{
                background: "linear-gradient(180deg, #0A0A0A 0%, #1E1E1E 50%, #0A0A0A 100%)",
            }}
        >
            {/* Grain texture overlay */}
            {/* <LandingNoise /> */}

            {/* Ambient glow effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FFC931]/5 rounded-full blur-[120px]"
                    animate={{
                        x: [0, 30, 0],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute bottom-1/4 -right-32 w-80 h-80 bg-[#14B985]/5 rounded-full blur-[100px]"
                    animate={{
                        x: [0, -20, 0],
                        opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>

            {/* Content Container */}
            <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16 md:mb-20"
                >
                    {/* Eyebrow */}
                    {/* <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="inline-block px-4 py-2 mb-6 rounded-full bg-white/5 border border-white/10 font-display text-sm tracking-wider text-white/60 uppercase"
                    >
                        Got Questions?
                    </motion.span> */}

                    {/* Title */}
                    <h2 className="font-body text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.9] tracking-tight text-white mb-6">
                        <span className="text-[#FFC931]">FAQ</span>s
                    </h2>

                    {/* Subtitle */}
                    <p className="font-display font-medium text-lg md:text-xl text-white/50 max-w-lg mx-auto">
                        Everything you need to know about Waffles
                    </p>
                </motion.div>

                {/* FAQ Items */}
                <div className="relative">
                    {/* Decorative line on the left */}
                    <div className="absolute left-[42px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block" />

                    {/* FAQ List */}
                    <div className="space-y-0">
                        {faqs.map((faq, index) => (
                            <FAQItem
                                key={index}
                                question={faq.question}
                                answer={faq.answer}
                                index={index}
                                isOpen={openIndex === index}
                                onToggle={() => handleToggle(index)}
                            />
                        ))}
                    </div>
                </div>

                {/* Bottom CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="text-center mt-16"
                >
                    <p className="font-display text-white/40 text-lg mb-4">
                        Still have questions?
                    </p>
                    <a
                        href="https://x.com/playwaffles"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 font-display text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                    >
                        <span>Reach out on X</span>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
