"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useDragControls,
  PanInfo,
} from "framer-motion";
import { ChatIcon } from "@/components/icons";
import Backdrop from "@/components/ui/Backdrop";
import { ChatMessageList } from "./ChatMessageList";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { springs } from "@/lib/animations";
import { playSound } from "@/lib/sounds";
import { useVisualViewport } from "@/hooks/useVisualViewport";

// ==========================================
// ANIMATED SEND ICON - Exact Figma SVG with fun animation
// ==========================================

function AnimatedSendIcon({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.svg
      width="16"
      height="14"
      viewBox="0 0 16 14"
      fill="none"
      animate={
        isHovered ? { x: [0, 2, 0], scale: [1, 1.15, 1] } : { x: 0, scale: 1 }
      }
      transition={{ duration: 0.35, ease: "easeOut" as const }}
    >
      {/* Arrow path with slide + rotate animation */}
      <motion.path
        d="M10 0H8V4H2V6H0V12H2V10H8V14H10V12H12V10H14V8H16V6H14V4H12V2H10V0Z"
        fill="white"
        animate={
          isHovered
            ? {
                x: [0, 4, 2],
                rotate: [0, -5, 0],
              }
            : { x: 0, rotate: 0 }
        }
        transition={{ duration: 0.3, ease: "easeOut" as const }}
        style={{ transformOrigin: "center" }}
      />
    </motion.svg>
  );
}

// ==========================================
// TYPES
// ==========================================

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// ==========================================
// COMPONENT
// ==========================================

export function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendHovered, setIsSendHovered] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<{ scrollToBottom: () => void }>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const {
    state: { connected: isConnected },
    sendChat,
  } = useRealtime();
  const { keyboardHeight, isKeyboardOpen } = useVisualViewport();

  // Max message length
  const MAX_MESSAGE_LENGTH = 500;

  // Focus input when drawer opens (with longer delay for mobile)
  useEffect(() => {
    if (isOpen) {
      // Use longer delay for mobile keyboards
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle keyboard visibility on mobile - scroll to keep input visible
  useEffect(() => {
    if (isKeyboardOpen && drawerRef.current) {
      // Ensure the input stays visible when keyboard opens
      drawerRef.current.style.transform = `translateY(-${keyboardHeight}px)`;
    } else if (drawerRef.current) {
      drawerRef.current.style.transform = "translateY(0)";
    }
  }, [isKeyboardOpen, keyboardHeight]);

  // Handle swipe-to-close gesture
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      // Close if dragged down more than 100px or with fast velocity
      if (info.offset.y > 100 || info.velocity.y > 500) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!message.trim() || isSubmitting) return;

      setIsSubmitting(true);
      const currentMessage = message.trim();
      setMessage("");

      try {
        sendChat(currentMessage);
        playSound("chatSend");
        setTimeout(() => messageListRef.current?.scrollToBottom(), 100);
      } catch (err) {
        console.error("Failed to send:", err);
        setMessage(currentMessage);
      } finally {
        setIsSubmitting(false);
        inputRef.current?.focus();
      }
    },
    [message, isSubmitting, sendChat]
  );

  const hasText = message.trim().length > 0;

  return (
    <>
      <Backdrop isOpen={isOpen} onClose={onClose} />

      {/* Drawer Panel with AnimatePresence for smooth mount/unmount */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={drawerRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
            }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[60dvh] rounded-t-[20px]"
            style={{
              background: "linear-gradient(180deg, #1E1E1E 0%, #000000 100%)",
              touchAction: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {/* Header */}
            <header
              className="relative flex h-[56px] w-full shrink-0 items-center border-b border-white/10 px-6 py-3 rounded-t-[20px]"
              style={{
                background: "linear-gradient(180deg, #1E1E1E 0%, #1A1A1A 100%)",
              }}
            >
              {/* Grabber with hover effect */}
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="absolute top-2 left-1/2 h-3 w-14 -translate-x-1/2 rounded-full group transition-all focus:outline-none"
                aria-label="Close chat"
              >
                <motion.div
                  className="absolute top-1/2 left-1/2 h-[4px] w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40"
                  whileHover={{
                    width: 48,
                    backgroundColor: "rgba(255,255,255,0.6)",
                  }}
                  transition={{ duration: 0.2 }}
                />
              </motion.button>

              {/* Title with entrance animation */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, ...springs.gentle }}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: [0, -5, 5, 0] }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    <ChatIcon className="w-7 h-7 text-[#3795F6] -ml-2" />
                  </motion.div>
                  <span className="font-bold uppercase text-white font-body tracking-[0.04em] text-[1.40rem] select-none">
                    LOBBY&nbsp;CHAT
                  </span>
                </div>

                {!isConnected && (
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-white/40 text-xs"
                  >
                    Connecting...
                  </motion.span>
                )}
              </motion.div>
            </header>

            {/* Messages */}
            <ChatMessageList ref={messageListRef} className="flex-1 min-h-0" />

            {/* Input with slide-up animation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, ...springs.gentle }}
              className="shrink-0 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-white/10"
            >
              <motion.form
                onSubmit={handleSubmit}
                className="flex h-[46px] items-center gap-3 rounded-full bg-white/5 px-4"
                animate={{
                  boxShadow: inputFocused
                    ? "0 0 0 2px rgba(55, 149, 246, 0.3), inset 0 0 20px rgba(55, 149, 246, 0.05)"
                    : "none",
                  backgroundColor: inputFocused
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.05)",
                }}
                transition={{ duration: 0.2 }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  enterKeyHint="send"
                  maxLength={MAX_MESSAGE_LENGTH}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Say something to the lobby"
                  disabled={isSubmitting || !isConnected}
                  className="flex-1 font-display bg-transparent text-sm font-medium text-white placeholder:text-white/40
                                 focus:outline-none disabled:opacity-50"
                  style={{
                    letterSpacing: "-0.03em",
                    fontSize: "16px", // Prevents iOS zoom on focus
                  }}
                />

                {/* Animated send button with glow */}
                <AnimatePresence mode="popLayout">
                  {hasText && !isSubmitting && (
                    <motion.button
                      type="submit"
                      initial={{ scale: 0, opacity: 0, rotate: -45 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0, opacity: 0, x: 20 }}
                      whileHover={{
                        scale: 1.1,
                        boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
                      }}
                      whileTap={{ scale: 0.85 }}
                      transition={springs.bouncy}
                      onHoverStart={() => setIsSendHovered(true)}
                      onHoverEnd={() => setIsSendHovered(false)}
                      onTouchStart={() => setIsSendHovered(true)}
                      onTouchEnd={() => setIsSendHovered(false)}
                      disabled={!hasText || isSubmitting}
                      className="flex items-center justify-center rounded-[38px] transition-colors"
                      style={{
                        width: 50,
                        height: 30,
                        paddingTop: 3,
                        paddingRight: 13,
                        paddingBottom: 3,
                        paddingLeft: 13,
                        gap: 4,
                        background: "#1B8FF5",
                        touchAction: "manipulation",
                        WebkitTapHighlightColor: "transparent",
                      }}
                      aria-label="Send message"
                    >
                      <AnimatedSendIcon isHovered={isSendHovered} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChatDrawer;
