"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { SplashScreen } from "../SplashScreen";

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
 * SplashProvider - Shows a lightweight splash only while runtime detection starts.
 *
 * The splash is dismissed when:
 * 1. AppInitializer calls hideSplash() after initialization, OR
 * 2. The short max duration elapses as a safety fallback.
 */
export function SplashProvider({ children }: { children: ReactNode }) {
    const [showSplash, setShowSplash] = useState(true);

    const hideSplash = useCallback(() => {
        setShowSplash(false);
    }, []);

    return (
        <SplashContext.Provider value={{ showSplash, hideSplash }}>
            {showSplash && <SplashScreen onComplete={hideSplash} duration={800} />}
            {children}
        </SplashContext.Provider>
    );
}
