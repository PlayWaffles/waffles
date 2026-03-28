"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { UsersIcon } from "@/components/icons";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { fireCheer } from "../CheerOverlay";
import { springs } from "@/lib/animations";

// ==========================================
// TYPES
// ==========================================

interface ChatInputBarProps {
  onOpen: () => void;
}

interface WaffleBubble {
  id: number;
  x: number;
  scale: number;
  rotation: number;
}

// ==========================================
// LOCAL BUBBLE (for immediate feedback)
// ==========================================

function LocalBubble({
  bubble,
  onComplete,
}: {
  bubble: WaffleBubble;
  onComplete: (id: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, x: 0, scale: 0.5 }}
      animate={{ opacity: 0, y: -80, x: bubble.x, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      onAnimationComplete={() => onComplete(bubble.id)}
      className="absolute pointer-events-none"
      style={{
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <Image
        src="/images/icons/cheer.svg"
        alt=""
        width={24}
        height={18}
        className="object-contain"
        style={{
          transform: `scale(${bubble.scale}) rotate(${bubble.rotation}deg)`,
        }}
      />
    </motion.div>
  );
}

// ==========================================
// ANIMATED COUNTER COMPONENT
// ==========================================

function AnimatedCount({ value }: { value: number }) {
  const prevValue = useRef(value);
  const [direction, setDirection] = useState<"up" | "down">("up");

  useEffect(() => {
    if (value !== prevValue.current) {
      setDirection(value > prevValue.current ? "up" : "down");
      prevValue.current = value;
    }
  }, [value]);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ y: direction === "up" ? 10 : -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: direction === "up" ? -10 : 10, opacity: 0 }}
        transition={springs.snappy}
        className="font-display inline-block"
        style={{
          fontSize: "16px",
          lineHeight: "130%",
          letterSpacing: "-0.03em",
          color: "#B93814",
        }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

// ==========================================
// COMPONENT
// ==========================================

/**
 * ChatInputBar - Trigger button to open chat drawer
 *
 * Shows active count on left, "Type..." placeholder button, and waffle cheer button.
 * Clicking the waffle creates animated bubbles that float up.
 */
export function ChatInputBar({ onOpen }: ChatInputBarProps) {
  const {
    state: { onlineCount: activeCount },
    sendCheer,
  } = useRealtime();
  const [bubbles, setBubbles] = useState<WaffleBubble[]>([]);
  const [bubbleIdCounter, setBubbleIdCounter] = useState(0);

  const handleWaffleClick = useCallback(() => {
    // Create local bubble for immediate feedback
    const newBubble: WaffleBubble = {
      id: bubbleIdCounter,
      x: Math.random() * 40 - 20,
      scale: 0.8 + Math.random() * 0.4,
      rotation: Math.random() * 30 - 15,
    };

    setBubbleIdCounter((prev) => prev + 1);
    setBubbles((prev) => [...prev, newBubble]);

    // Fire cheer event (shows global bubbles)
    fireCheer(true);

    // Broadcast to other players
    sendCheer();
  }, [bubbleIdCounter, sendCheer]);

  const removeBubble = useCallback((id: number) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return (
    <div className="flex items-center gap-2.5">
      {/* Trigger button - opens drawer */}
      <motion.button
        onClick={onOpen}
        whileTap={{ scale: 0.98 }}
        className="flex-1 flex items-center hover:bg-white/[0.07] transition-colors"
        style={{
          height: "46px",
          padding: "14px 16px",
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "900px",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
        aria-label="Open chat"
      >
        <span
          className="flex-1 font-display text-left"
          style={{
            fontSize: "14px",
            lineHeight: "130%",
            letterSpacing: "-0.03em",
            color: "#FFFFFF",
            opacity: 0.4,
          }}
        >
          Talk trash, hype up, or say hi 👋
        </span>
      </motion.button>

      {/* Waffle Cheer Button */}
      <motion.button
        onClick={handleWaffleClick}
        whileTap={{ scale: 0.85, rotate: -10 }}
        whileHover={{ scale: 1.05 }}
        transition={springs.bouncy}
        className="relative shrink-0 flex items-center justify-center overflow-visible"
        style={{
          zIndex: 1,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
        aria-label="Send waffle cheer"
      >
        <Image
          src="/images/icons/cheer.svg"
          alt="cheer"
          width={29}
          height={18}
          className="object-contain relative z-10"
        />

        {/* Local floating bubbles for immediate feedback - originate from button center */}
        <AnimatePresence>
          {bubbles.map((bubble) => (
            <LocalBubble
              key={bubble.id}
              bubble={bubble}
              onComplete={removeBubble}
            />
          ))}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

export default ChatInputBar;
