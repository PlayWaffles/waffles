"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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
        isVisible && (
            <div className="fixed inset-0 z-9999 overflow-hidden app-background">
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
                        className="h-[42px] w-[54px] max-w-[55px]"
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
            </div>
        )
    );
}
