"use client";

import dynamic from "next/dynamic";
import { OnchainKitProvider } from "./OnchainKitProvider";
import { SoundProvider } from "./SoundProvider";
import GlobalToaster from "../ui/Toaster";
import { AppInitializer } from "./AppInitializer";
import { SplashProvider } from "./SplashProvider";

const StreakModal = dynamic(
  () => import("../StreakModal").then((mod) => mod.StreakModal),
  { ssr: false },
);

/**
 * Root Providers - Wraps entire app with necessary providers.
 *
 * Provider order matters:
 * 1. OnchainKitProvider (wallet, MiniKit context)
 * 2. SplashProvider (must be OUTSIDE AppInitializer so splash shows during init)
 * 3. AppInitializer (handles onboarding — returns null while loading)
 * 4. SoundProvider (Audio)
 *
 * Note: RealtimeProvider is at the game layout level, not root.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OnchainKitProvider>
      <SplashProvider>
        <AppInitializer>
          <SoundProvider>
            {children}
            <StreakModal />
            <GlobalToaster />
          </SoundProvider>
        </AppInitializer>
      </SplashProvider>
    </OnchainKitProvider>
  );
}
