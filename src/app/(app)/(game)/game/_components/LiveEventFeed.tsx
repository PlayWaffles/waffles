"use client";

import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { springs } from "@/lib/animations";

// ==========================================
// TYPES
// ==========================================

interface FeedItem {
  id: string;
  type: "chat" | "join";
  username: string;
  pfp: string | null;
  text: string;
  ts: number;
}

// ==========================================
// FEED ITEM COMPONENT
// ==========================================

const FeedRow = memo(function FeedRow({ item }: { item: FeedItem }) {
  return (
    <motion.div
      layout
      initial={false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.9 }}
      transition={springs.snappy}
      className="flex items-center gap-2"
    >
      {/* Avatar */}
      <motion.div
        initial={false}
        animate={{ scale: 1 }}
        transition={{ ...springs.bouncy, delay: 0.1 }}
      >
        {item.pfp ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.pfp}
            alt={item.username}
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-white/20 shrink-0 flex items-center justify-center">
            <span className="text-[10px] text-white/80">
              {item.username?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
        )}
      </motion.div>

      {/* Content - max-w prevents overlap with online indicator */}
      <span
        className={`text-white/70 text-sm truncate max-w-[calc(100%-100px)] ${item.type === "join" ? "italic" : ""
          }`}
      >
        <span className="text-white font-medium">{item.username}</span>{" "}
        <span className="font-display">{item.text}</span>
      </span>
    </motion.div>
  );
});

// ==========================================
// CONNECTION INDICATOR
// ==========================================

function ConnectionIndicator({
  isConnected,
  onlineCount,
}: {
  isConnected: boolean;
  onlineCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-2 right-4 flex items-center gap-1.5 z-20"
    >
      <motion.div
        animate={
          isConnected
            ? { scale: [1, 1.2, 1], opacity: 1 }
            : { scale: [0.8, 1, 0.8], opacity: [0.5, 1, 0.5] }
        }
        transition={{ duration: isConnected ? 2 : 1, repeat: Infinity }}
        className={`w-2 h-2 rounded-full ${isConnected ? "bg-success" : "bg-waffle-gold-warm"
          }`}
      />
      <span className="text-[10px] text-white/50 font-display">
        {isConnected ? `${onlineCount} online` : "connecting..."}
      </span>
    </motion.div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

interface LiveEventFeedProps {
  maxEvents?: number;
}

export function LiveEventFeed({ maxEvents = 5 }: LiveEventFeedProps) {
  const {
    messages,
    entrants,
    connected: isConnected,
    onlineCount,
  } = useRealtime().state;

  // Combine chat messages and join events into a unified feed
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [
      // Chat messages
      ...messages.map((m) => ({
        id: m.id,
        type: "chat" as const,
        username: m.username,
        pfp: m.pfp,
        text: m.text,
        ts: m.ts,
      })),
      // Join events from entrants
      ...entrants.map((p) => ({
        id: `join-${p.username}-${p.timestamp}`,
        type: "join" as const,
        username: p.username,
        pfp: p.pfpUrl,
        text: "joined the game",
        ts: p.timestamp,
      })),
    ];

    // Sort by timestamp and take most recent
    return items.sort((a, b) => a.ts - b.ts).slice(-maxEvents);
  }, [messages, entrants, maxEvents]);

  if (feedItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative w-full max-w-full mx-auto flex flex-col justify-center items-center"
        style={{ height: "clamp(60px, 12vh, 140px)" }}
      >
        <ConnectionIndicator
          isConnected={isConnected}
          onlineCount={onlineCount}
        />
        <motion.p
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-white/30 text-sm font-display"
        >
          Waiting for activity...
        </motion.p>
      </motion.div>
    );
  }

  return (
    <div
      className="relative w-screen -mx-4 overflow-hidden"
      style={{ height: "clamp(60px, 12vh, 140px)" }}
    >
      <ConnectionIndicator
        isConnected={isConnected}
        onlineCount={onlineCount}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        className="absolute inset-0 py-2 px-4 flex flex-col justify-end overflow-hidden"
        style={{
          maskImage: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.8) 35%, black 55%)`,
          WebkitMaskImage: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.8) 35%, black 55%)`,
        }}
      >
        <div className="flex flex-col gap-1 pt-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {feedItems.map((item) => (
              <FeedRow key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default LiveEventFeed;
