"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRealtime } from "@/components/providers/RealtimeProvider";

const MAX_VISIBLE = 6;

interface PlayerAvatarStackProps {
  actionText?: string;
}

/**
 * PlayerAvatarStack — Round PFP row with pulse-ring entrance animation.
 *
 * Shows the latest players who answered the current question (via WebSocket).
 * Overflow renders as a "+N" circle.
 */
export function PlayerAvatarStack({
  actionText = "just answered",
}: PlayerAvatarStackProps) {
  const { questionAnswerers } = useRealtime().state;

  if (questionAnswerers.length === 0) return null;

  const visible = questionAnswerers.slice(0, MAX_VISIBLE);
  const overflow = questionAnswerers.length - visible.length;

  return (
    <motion.div
      className="relative mx-4 overflow-hidden"
      style={{ minHeight: 65 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex gap-1.5 justify-center flex-nowrap">
        <AnimatePresence>
          {visible.map((player) => (
            <motion.div
              key={player.username}
              className="relative overflow-visible"
              style={{ width: 50, height: 50, flexShrink: 0 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              title={player.username}
            >
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: "2px solid rgba(255,255,255,0.4)" }}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.25, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />

              {/* PFP */}
              <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-waffle-gold-warm to-[#FF6B35]">
                {player.pfpUrl ? (
                  <Image
                    src={player.pfpUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="50px"
                  />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* +N overflow circle */}
        {overflow > 0 && (
          <motion.div
            key={`overflow-${overflow}`}
            className="rounded-full flex items-center justify-center font-body"
            style={{
              width: 50,
              height: 50,
              flexShrink: 0,
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)",
              fontSize: overflow >= 10 ? 18 : 20,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
          >
            +{overflow}
          </motion.div>
        )}
      </div>

      {/* Action text */}
      <motion.p
        className="text-center font-display text-xs text-[#99A0AE] mt-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {questionAnswerers.length}{" "}
        {questionAnswerers.length === 1 ? "player" : "players"} {actionText}
      </motion.p>
    </motion.div>
  );
}

export default PlayerAvatarStack;
