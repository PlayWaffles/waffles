"use client";

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatComment } from "./ChatComment";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import type { ChatItem } from "@shared/protocol";
import { springs } from "@/lib/animations";
import { playSound } from "@/lib/sounds";
import { useUser } from "@/hooks/useUser";

// ==========================================
// TYPES
// ==========================================

interface ChatMessageListProps {
  className?: string;
}

export interface ChatMessageListRef {
  scrollToBottom: () => void;
}

interface CommentType {
  id: string;
  name: string;
  time: string;
  message: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
  status: "sent" | "pending" | "error";
}

// ==========================================
// HELPERS
// ==========================================

const mapMessageToComment = (
  msg: ChatItem,
  currentUsername?: string
): CommentType => ({
  id: msg.id,
  name: msg.username,
  time: new Date(msg.ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  message: msg.text,
  avatarUrl: msg.pfp,
  isCurrentUser: msg.username === currentUsername,
  status: "sent",
});

// ==========================================
// COMPONENT
// ==========================================

export const ChatMessageList = forwardRef<
  ChatMessageListRef,
  ChatMessageListProps
>(function ChatMessageList({ className = "" }, ref) {
  const listRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showNewMessages, setShowNewMessages] = useState(false);

  const { user } = useUser();
  const username = user?.username ?? "Player";

  const { messages: storeMessages } = useRealtime().state;
  const comments = storeMessages.map((m) => mapMessageToComment(m, username));
  const prevMessageCount = useRef(storeMessages.length);

  // Play sound when new message from others arrives
  useEffect(() => {
    if (storeMessages.length > prevMessageCount.current) {
      const latestMessage = storeMessages[storeMessages.length - 1];
      // Only play sound for messages from others
      if (latestMessage && latestMessage.username !== username) {
        playSound("chatReceive");
      }
    }
    prevMessageCount.current = storeMessages.length;
  }, [storeMessages, username]);

  // Expose scrollToBottom via ref
  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (listRef.current) {
        listRef.current.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
        setShouldAutoScroll(true);
        setShowNewMessages(false);
      }
    },
  }));

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    } else if (!shouldAutoScroll && comments.length > 0) {
      setShowNewMessages(true);
    }
  }, [comments, shouldAutoScroll]);

  // Handle scroll events
  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isNearBottom);
    if (isNearBottom) {
      setShowNewMessages(false);
    }
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
      setShouldAutoScroll(true);
      setShowNewMessages(false);
    }
  };

  return (
    <div
      className={`relative flex-1 flex flex-col min-w-0 overflow-hidden ${className}`}
    >
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="scrollbox-transparent flex-1 overflow-y-auto px-4"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          touchAction: "pan-y",
        }}
      >
        <div className="flex flex-col gap-2 py-4 min-w-0">
          {comments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center h-full text-white/40 text-sm py-8"
            >
              No messages yet. Start the conversation!
            </motion.div>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {comments.map((comment, index) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    ...springs.gentle,
                    delay: index === comments.length - 1 ? 0 : 0,
                  }}
                  layout
                >
                  <ChatComment
                    name={comment.name}
                    time={comment.time}
                    message={comment.message}
                    avatarUrl={comment.avatarUrl}
                    isCurrentUser={comment.isCurrentUser}
                    status={comment.status}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* New messages indicator with bounce animation */}
      <AnimatePresence>
        {showNewMessages && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            whileTap={{ scale: 0.95 }}
            transition={springs.bouncy}
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-full shadow-lg"
          >
            <motion.span
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ↓ New messages
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

export default ChatMessageList;
