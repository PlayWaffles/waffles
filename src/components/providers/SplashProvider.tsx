"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { SplashScreen } from "../SplashScreen";

const MIN_SPLASH_MS = 2000;

interface SplashContextValue {
    showSplash: boolean;
    hideSplash: () => void;
}

const SplashContext = createContext<SplashContextValue | null>(null);

export function useSplash() {
    const context = useContext(SplashContext);
    if (!context) {
        throw new Error("useSplash must be used within SplashProvider");
    }
    return context;
}

/**
 * SplashProvider - Shows splash screen until explicitly dismissed or timeout.
 *
 * The splash is dismissed when:
 * 1. AppInitializer calls hideSplash() after initialization AND at least 2s have passed, OR
 * 2. The max duration (5s) elapses as a safety fallback
 */
export function SplashProvider({ children }: { children: ReactNode }) {
    const [showSplash, setShowSplash] = useState(true);
    const mountedAt = useRef(Date.now());

    const hideSplash = useCallback(() => {
        const elapsed = Date.now() - mountedAt.current;
        const remaining = MIN_SPLASH_MS - elapsed;

        if (remaining <= 0) {
            setShowSplash(false);
        } else {
            setTimeout(() => setShowSplash(false), remaining);
        }
    }, []);

    return (
        <SplashContext.Provider value={{ showSplash, hideSplash }}>
            {showSplash && <SplashScreen onComplete={hideSplash} duration={5000} />}
            {children}
        </SplashContext.Provider>
    );
}
