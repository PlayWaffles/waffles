/**
 * RealtimeProvider - WebSocket and real-time state management
 *
 * Manages:
 * - PartyKit WebSocket connection (via usePartySocket)
 * - Real-time state (entry, stats, chat, online count)
 * - Send functions (chat, answer, cheer)
 *
 * NOTE: Game data is NOT stored here. Game data should be fetched
 * in server components and passed as props to client components.
 *
 * NOTE: Access control is handled by AccessGuard at the layout level,
 * not in this provider.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from "react";
import { useRouter } from "next/navigation";
import usePartySocket from "partysocket/react";
import { env } from "@/lib/env";
import type { Message, ChatItem, Entrant, QuestionAnswerer } from "@shared/protocol";
import { useUser } from "@/hooks/useUser";
import { authenticatedFetch } from "@/lib/client/runtime";

// ==========================================
// TYPES
// ==========================================


export interface GameEntryData {
  id: string;
  score: number;
  answered: number;
  paidAt: Date | null;
  purchaseSource: "PAID" | "DISCOUNTED" | "FREE_ADMIN" | "FREE_PLAYER";
  hasTicket: boolean;
  rank: number | null;
  prize: number | null;
  claimedAt: Date | null;
  answeredQuestionIds: string[];
}

// ==========================================
// STATE
// ==========================================

interface RealtimeState {
  // User's game entry
  entry: GameEntryData | null;
  isLoadingEntry: boolean;

  // Real-time stats from WebSocket
  prizePool: number | null;
  playerCount: number | null;

  // Connection status
  connected: boolean;
  onlineCount: number;

  // Chat
  messages: ChatItem[];

  // Ticket entrants (synced via PartyKit)
  entrants: Entrant[];

  // Live game question tracking
  currentQuestionId: string | null;
  questionAnswerers: QuestionAnswerer[];
}

const initialState: RealtimeState = {
  entry: null,
  isLoadingEntry: true,
  prizePool: null,
  playerCount: null,
  connected: false,
  onlineCount: 0,
  messages: [],
  entrants: [],
  currentQuestionId: null,
  questionAnswerers: [],
};

// ==========================================
// ACTIONS
// ==========================================

type Action =
  | { type: "SET_ENTRY"; payload: GameEntryData | null }
  | { type: "SET_LOADING_ENTRY"; payload: boolean }
  | {
    type: "UPDATE_STATS";
    payload: { prizePool?: number; playerCount?: number };
  }
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_ONLINE_COUNT"; payload: number }
  | { type: "SET_MESSAGES"; payload: ChatItem[] }
  | { type: "ADD_MESSAGE"; payload: ChatItem }
  | { type: "SET_ENTRANTS"; payload: Entrant[] }
  | { type: "ADD_ENTRANT"; payload: Entrant }
  | { type: "SET_CURRENT_QUESTION"; payload: string | null }
  | {
    type: "ADD_ANSWERER";
    payload: { questionId: string; player: QuestionAnswerer };
  }
  | { type: "INCREMENT_ANSWERED" }
  | { type: "SEED_ANSWERERS"; payload: { questionId: string; players: QuestionAnswerer[] } }
  | { type: "RESET" };

function reducer(state: RealtimeState, action: Action): RealtimeState {
  switch (action.type) {
    case "SET_ENTRY":
      return { ...state, entry: action.payload, isLoadingEntry: false };

    case "SET_LOADING_ENTRY":
      return { ...state, isLoadingEntry: action.payload };

    case "UPDATE_STATS":
      return {
        ...state,
        prizePool: action.payload.prizePool ?? state.prizePool,
        playerCount: action.payload.playerCount ?? state.playerCount,
      };

    case "SET_CONNECTED":
      return { ...state, connected: action.payload };

    case "SET_ONLINE_COUNT":
      return { ...state, onlineCount: action.payload };

    case "SET_MESSAGES":
      return { ...state, messages: action.payload };

    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages.slice(-99), action.payload],
      };

    case "SET_ENTRANTS":
      return { ...state, entrants: action.payload };

    case "ADD_ENTRANT":
      return {
        ...state,
        entrants: [
          action.payload,
          ...state.entrants.filter(
            (e) => e.username !== action.payload.username
          ),
        ].slice(0, 20),
      };

    case "SET_CURRENT_QUESTION":
      return {
        ...state,
        currentQuestionId: action.payload,
        questionAnswerers: [],
      };

    case "ADD_ANSWERER":
      if (state.currentQuestionId !== action.payload.questionId) return state;
      return {
        ...state,
        questionAnswerers: [
          action.payload.player,
          ...state.questionAnswerers.filter(
            (p) => p.username !== action.payload.player.username
          ),
        ].slice(0, 10),
      };

    case "INCREMENT_ANSWERED":
      if (!state.entry) return state;
      return {
        ...state,
        entry: { ...state.entry, answered: state.entry.answered + 1 },
      };

    case "SEED_ANSWERERS": {
      if (state.currentQuestionId !== action.payload.questionId) return state;

      // Merge DB backfill with any WebSocket arrivals already in state,
      // keeping existing entries (WS is more recent) and appending new ones.
      const existing = new Set(state.questionAnswerers.map((p) => p.username));
      const newPlayers = action.payload.players.filter(
        (p) => !existing.has(p.username),
      );
      return {
        ...state,
        questionAnswerers: [...state.questionAnswerers, ...newPlayers].slice(0, 20),
      };
    }

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ==========================================
// CONTEXT
// ==========================================

interface RealtimeContextValue {
  // State (no game data - that comes from server components)
  state: RealtimeState;
  dispatch: Dispatch<Action>;

  // The gameId this provider is connected to
  gameId: string | null;

  // Send functions
  sendChat: (text: string) => boolean;
  sendAnswer: (
    questionIndex: number,
    questionId: string,
    answerIndex: number,
    timeMs: number,
    correct: boolean | null
  ) => void;
  sendCheer: () => void;
  refetchEntry: () => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// ==========================================
// PROVIDER
// ==========================================

interface RealtimeProviderProps {
  children: ReactNode;
  /** Game ID to connect WebSocket room. Can be null if no active game. */
  gameId: string | null;
}

export function RealtimeProvider({
  children,
  gameId,
}: RealtimeProviderProps) {
  const router = useRouter();

  // Get user for entry fetching (access control is handled by AccessGuard)
  const { user } = useUser();

  // Initialize state
  const [state, dispatch] = useReducer(reducer, initialState);

  // Message handler for WebSocket events
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as Message;

        switch (msg.type) {
          case "sync":
            dispatch({ type: "SET_ONLINE_COUNT", payload: msg.connected });
            dispatch({ type: "SET_MESSAGES", payload: msg.chat });
            dispatch({ type: "SET_ENTRANTS", payload: msg.entrants });
            break;

          case "entrant:new":
            dispatch({
              type: "ADD_ENTRANT",
              payload: {
                username: msg.username,
                pfpUrl: msg.pfpUrl,
                timestamp: msg.timestamp,
              },
            });
            break;

          case "connected":
            dispatch({ type: "SET_ONLINE_COUNT", payload: msg.count });
            break;

          case "chat:new":
            dispatch({
              type: "ADD_MESSAGE",
              payload: {
                id: msg.id,
                username: msg.username,
                pfp: msg.pfp,
                text: msg.text,
                ts: msg.ts,
              },
            });
            break;

          case "stats":
            dispatch({
              type: "UPDATE_STATS",
              payload: {
                prizePool: msg.prizePool,
                playerCount: msg.playerCount,
              },
            });
            break;

          case "answered":
            dispatch({
              type: "ADD_ANSWERER",
              payload: {
                  questionId: msg.questionId ?? String(msg.questionIndex),
                  player: {
                    username: msg.username,
                    pfpUrl: msg.pfp,
                  timestamp: msg.ts,
                  correct: msg.correct ?? null,
                },
              },
            });
            break;

          case "cheer":
            import("@/app/(app)/(game)/game/_components/CheerOverlay").then(
              ({ fireCheer }) => fireCheer(false)
            );
            break;

          case "game:starting":
            console.log(`[Socket] Game starting in ${msg.in} seconds`);
            break;

          case "game:live":
            console.log("[Socket] Game is now live");
            break;

          case "game:end":
            router.push(`/game/${msg.gameId}/result`);
            break;
        }
      } catch {
        console.error("Failed to parse message", event.data);
      }
    },
    [router]
  );

  // WebSocket connection using PartyKit's hook
  // - Auto-connects on mount, disconnects on unmount
  // - Auto-reconnects with exponential backoff
  // - Async query function fetches auth token for each connection
  // - startClosed=true when no gameId (don't connect without a game)
  const socket = usePartySocket({
    host: env.partykitHost,
    party: "main",
    room: gameId ? `game-${gameId}` : "none",
    startClosed: !gameId,

    // Async query function - fetches auth token before connection
    query: async () => {
      try {
        const res = await authenticatedFetch("/api/v1/auth/party-token");
        if (res.ok) {
          const data = await res.json();
          return { token: data.token || "" };
        }
      } catch {
        // Continue without token
      }
      return { token: "" };
    },

    // Lifecycle handlers
    onOpen() {
      dispatch({ type: "SET_CONNECTED", payload: true });
    },
    onClose() {
      dispatch({ type: "SET_CONNECTED", payload: false });
    },
    onMessage: handleMessage,
  });

  // Fetch User Entry
  const fetchEntry = useCallback(async () => {
    if (!gameId || !user?.id) return;

    dispatch({ type: "SET_LOADING_ENTRY", payload: true });

    try {
      const res = await authenticatedFetch(`/api/v1/games/${gameId}/entry`);
      if (res.ok) {
        const data = await res.json();
        dispatch({
          type: "SET_ENTRY",
          payload: {
            id: data.id,
            score: data.score ?? 0,
            answered: data.answered ?? 0,
            answeredQuestionIds: data.answeredQuestionIds ?? [],
            paidAt: data.paidAt ? new Date(data.paidAt) : null,
            purchaseSource: data.purchaseSource ?? "PAID",
            hasTicket: Boolean(data.hasTicket),
            rank: data.rank ?? null,
            prize: data.prize ?? null,
            claimedAt: data.claimedAt ? new Date(data.claimedAt) : null,
          },
        });
      } else if (res.status === 404) {
        dispatch({ type: "SET_ENTRY", payload: null });
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (err) {
      console.error("Failed to fetch entry", err);
      dispatch({ type: "SET_LOADING_ENTRY", payload: false });
    }
  }, [gameId, user?.id]);

  // Auto-fetch entry on mount/change
  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  // Send functions use socket directly
  const sendChat = useCallback(
    (text: string): boolean => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          const msg: Message = { type: "chat", text };
          socket.send(JSON.stringify(msg));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    [socket]
  );

  const sendCheer = useCallback(() => {
    if (socket.readyState === WebSocket.OPEN) {
      const msg: Message = { type: "cheer" };
      socket.send(JSON.stringify(msg));
    }
  }, [socket]);

  const sendAnswer = useCallback(
    (
      questionIndex: number,
      questionId: string,
      answerIndex: number,
      timeMs: number,
      correct: boolean | null,
    ) => {
      if (socket.readyState === WebSocket.OPEN) {
        const msg: Message = {
          type: "submit",
          q: questionIndex,
          questionId,
          a: answerIndex,
          ms: timeMs,
          correct,
        };
        socket.send(JSON.stringify(msg));
      }
    },
    [socket]
  );

  return (
    <RealtimeContext.Provider
      value={{
        state,
        dispatch,
        gameId,
        sendChat,
        sendAnswer,
        sendCheer,
        refetchEntry: fetchEntry,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

// ==========================================
// HOOKS
// ==========================================

/**
 * Access real-time state and functions (WebSocket, chat, entry, stats).
 * NOTE: Game data is NOT available here - receive it as props from server components.
 */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return context;
}

// Re-export types for convenience
export type { RealtimeState, RealtimeContextValue };
