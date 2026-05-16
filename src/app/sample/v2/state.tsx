"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ScreenName =
  | "home"
  | "levels"
  | "levelIntro"
  | "levelWin"
  | "levelFail"
  | "pass"
  | "shop"
  | "leaderboard"
  | "leagues"
  | "missions"
  | "lobby"
  | "question"
  | "results"
  | "profile";

const SCREEN_ORDER: ScreenName[] = [
  "home",
  "levels",
  "levelIntro",
  "pass",
  "missions",
  "leaderboard",
  "leagues",
  "shop",
  "lobby",
  "question",
  "results",
  "levelWin",
  "levelFail",
  "profile",
];

export type GameMode = "tournament" | "level";

export type Question = {
  cat: string;
  q: string;
  answers: string[];
  correct: number;
};

export const QUESTIONS: Question[] = [
  { cat: "Movies", q: "Which 2010 film features a dream-within-a-dream heist plot?", answers: ["Inception", "The Matrix", "Interstellar", "Tenet"], correct: 0 },
  { cat: "Crypto", q: "What year was Bitcoin's genesis block mined?", answers: ["2008", "2009", "2010", "2011"], correct: 1 },
  { cat: "Geography", q: "Which country has the most natural lakes?", answers: ["Russia", "USA", "Finland", "Canada"], correct: 3 },
  { cat: "Music", q: "Which instrument has 88 keys?", answers: ["Harpsichord", "Piano", "Organ", "Synth"], correct: 1 },
  { cat: "Sports", q: "How many players are on a soccer team on the field?", answers: ["9", "10", "11", "12"], correct: 2 },
];

export type Tweaks = {
  questionTime: number;
  questionsPerRound: number;
  levelQuestions: number;
  lobbyCountdown: number;
  startingTickets: number;
  homeSlot: "both" | "continue" | "missions" | "none";
};

export const DEFAULT_TWEAKS: Tweaks = {
  questionTime: 10,
  questionsPerRound: 5,
  levelQuestions: 3,
  lobbyCountdown: 10,
  startingTickets: 3,
  homeSlot: "both",
};

type State = {
  screen: ScreenName;
  prevScreen: ScreenName | null;
  direction: 1 | -1;
  tickets: number;
  level: number;
  xp: number;
  streak: number;
  mode: GameMode;
  hearts: number;
  qIdx: number;
  score: number;
  qAnswered: number | null;
  countdownSec: number;
  timer: number;
};

const initialState = (tweaks: Tweaks): State => ({
  screen: "home",
  prevScreen: null,
  direction: 1,
  tickets: tweaks.startingTickets,
  level: 23,
  xp: 340,
  streak: 12,
  mode: "tournament",
  hearts: 3,
  qIdx: 0,
  score: 0,
  qAnswered: null,
  countdownSec: tweaks.lobbyCountdown,
  timer: tweaks.questionTime,
});

type GotoOpts = { back?: boolean };

export type Proto = State & {
  tweaks: Tweaks;
  currentQuestion: Question;
  totalQuestions: number;
  goto: (screen: ScreenName, opts?: GotoOpts) => void;
  update: (patch: Partial<State> | ((s: State) => Partial<State>)) => void;
  answerQuestion: (answerIdx: number) => void;
  startTournament: () => void;
  startLevel: () => void;
  beginLevelQuiz: () => void;
  retryLevel: () => void;
  playAgain: () => void;
};

const ProtoContext = createContext<Proto | null>(null);

export function ProtoProvider({
  tweaks = DEFAULT_TWEAKS,
  children,
}: {
  tweaks?: Tweaks;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>(() => initialState(tweaks));

  const goto = useCallback((screen: ScreenName, opts: GotoOpts = {}) => {
    setState((s) => {
      if (s.screen === screen) return s;
      const fromIdx = SCREEN_ORDER.indexOf(s.screen);
      const toIdx = SCREEN_ORDER.indexOf(screen);
      const direction: 1 | -1 = opts.back ? -1 : toIdx > fromIdx ? 1 : -1;
      return { ...s, prevScreen: s.screen, screen, direction };
    });
  }, []);

  const update = useCallback<Proto["update"]>((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  // Lobby countdown
  useEffect(() => {
    if (state.screen !== "lobby") return;
    if (state.countdownSec <= 0) {
      update({ qIdx: 0, score: 0, qAnswered: null, timer: tweaks.questionTime });
      goto("question");
      return;
    }
    const t = setTimeout(() => update({ countdownSec: state.countdownSec - 1 }), 1000);
    return () => clearTimeout(t);
  }, [state.screen, state.countdownSec, tweaks.questionTime, goto, update]);

  // Question timer
  useEffect(() => {
    if (state.screen !== "question") return;
    if (state.qAnswered !== null) return;
    if (state.timer <= 0) {
      update({ qAnswered: -1 });
      return;
    }
    const t = setTimeout(() => update({ timer: state.timer - 0.1 }), 100);
    return () => clearTimeout(t);
  }, [state.screen, state.timer, state.qAnswered, update]);

  // Auto-advance after answer
  useEffect(() => {
    if (state.qAnswered === null) return;
    if (state.screen !== "question") return;
    const t = setTimeout(() => {
      const q = QUESTIONS[state.qIdx % QUESTIONS.length];
      const wrong = state.qAnswered !== q.correct;
      const totalQs = state.mode === "level" ? tweaks.levelQuestions : tweaks.questionsPerRound;

      if (state.mode === "level") {
        const newHearts = wrong ? state.hearts - 1 : state.hearts;
        if (newHearts <= 0) {
          update({ hearts: 0 });
          goto("levelFail");
          return;
        }
        if (state.qIdx + 1 >= totalQs) {
          update({ hearts: newHearts, level: state.level + 1, xp: state.xp + state.score });
          goto("levelWin");
          return;
        }
        update({
          hearts: newHearts,
          qIdx: state.qIdx + 1,
          qAnswered: null,
          timer: tweaks.questionTime,
        });
        return;
      }

      if (state.qIdx + 1 >= totalQs) {
        goto("results");
        update({ tickets: state.tickets + 1, xp: state.xp + state.score });
      } else {
        update({
          qIdx: state.qIdx + 1,
          qAnswered: null,
          timer: tweaks.questionTime,
        });
      }
    }, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.qAnswered, state.qIdx]);

  const answerQuestion = (answerIdx: number) => {
    if (state.qAnswered !== null) return;
    const q = QUESTIONS[state.qIdx % QUESTIONS.length];
    const correct = answerIdx === q.correct;
    update({
      qAnswered: answerIdx,
      score: state.score + (correct ? Math.round(100 + state.timer * 20) : 0),
    });
  };

  const startTournament = () => {
    update({
      mode: "tournament",
      countdownSec: tweaks.lobbyCountdown,
      qIdx: 0,
      score: 0,
      qAnswered: null,
      hearts: 3,
      timer: tweaks.questionTime,
    });
    goto("lobby");
  };

  const startLevel = () => {
    update({ mode: "level", qIdx: 0, score: 0, qAnswered: null, hearts: 3, timer: tweaks.questionTime });
    goto("levelIntro");
  };

  const beginLevelQuiz = () => {
    update({ qIdx: 0, score: 0, qAnswered: null, timer: tweaks.questionTime });
    goto("question");
  };

  const retryLevel = () => {
    update({ mode: "level", qIdx: 0, score: 0, qAnswered: null, hearts: 3, timer: tweaks.questionTime });
    goto("levelIntro");
  };

  const playAgain = () => {
    update({
      mode: "tournament",
      qIdx: 0,
      score: 0,
      qAnswered: null,
      hearts: 3,
      timer: tweaks.questionTime,
      countdownSec: tweaks.lobbyCountdown,
    });
    goto("home");
  };

  const value: Proto = {
    ...state,
    tweaks,
    currentQuestion: QUESTIONS[state.qIdx % QUESTIONS.length],
    totalQuestions: state.mode === "level" ? tweaks.levelQuestions : tweaks.questionsPerRound,
    goto,
    update,
    answerQuestion,
    startTournament,
    startLevel,
    beginLevelQuiz,
    retryLevel,
    playAgain,
  };

  return <ProtoContext.Provider value={value}>{children}</ProtoContext.Provider>;
}

export function useProto(): Proto {
  const ctx = useContext(ProtoContext);
  if (!ctx) throw new Error("useProto must be used inside <ProtoProvider>");
  return ctx;
}
