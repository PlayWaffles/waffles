"use client";

import { useEffect, useState } from "react";
import { getAppRuntime, isMiniPayRuntime, type AppRuntime } from "@/lib/client/runtime";
import { ChatInputBar } from "./ChatInputBar";
import { ChatDrawer } from "./ChatDrawer";

// ==========================================
// MAIN COMPONENT
// ==========================================

/**
 * GameChat - Modular chat component
 *
 * Composes:
 * - ChatInputBar: Inline trigger with active count and input
 * - ChatDrawer: Full-screen slide-up panel with messages
 *
 * Parent component controls layout positioning.
 */
export function GameChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [runtime, setRuntime] = useState<AppRuntime | null>(
    isMiniPayRuntime() ? "minipay" : null,
  );

  useEffect(() => {
    let cancelled = false;

    getAppRuntime()
      .then((nextRuntime) => {
        if (!cancelled) setRuntime(nextRuntime);
      })
      .catch(() => {
        if (!cancelled) setRuntime("browser");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (runtime === "minipay") {
    return null;
  }

  return (
    <>
      <ChatInputBar onOpen={() => setIsOpen(true)} />
      <ChatDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default GameChat;
