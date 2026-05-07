"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
    duration?: number;
    onComplete?: () => void;
}

export function SplashScreen({ duration = 2000, onComplete }: SplashScreenProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            onComplete?.();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-9999 overflow-hidden app-background"
                >
                    <div
                        className="absolute flex flex-col items-center"
                        style={{
                            width: "40vw",
                            maxWidth: "157px",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            gap: "5px",
                        }}
                    >
                        <Image
                            src="/logo-small.png"
                            alt="Waffles"
                            width={55}
                            height={43}
                            priority
                            className="w-[54] max-w-[55px] h-[42]"
                        />
                        <span
                            className="font-body text-white text-center"
                            style={{
                                fontSize: "clamp(18px, 6vw, 44px)",
                                letterSpacing: "0.05em",
                            }}
                        >
                            WAFFLES
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
