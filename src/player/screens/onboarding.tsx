"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useProto } from "../state";
import { ASSETS, Phone, PixelImg } from "../shared";
import { LegalSheet, type LegalTab } from "../legal";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import { getDemoQuestion, type DemoQuestion } from "@/actions/onboarding";
import { skipRookieCup } from "@/player/api";

// First-launch onboarding — money-first, v1-lean. The previous (v1) onboarding
// converted browsers into *paying* players far better than v2's free-play
// orientation did, because it planted the paid mental model immediately and let
// people *play* before committing. This flow brings that DNA into v2's shell:
//
//   1. Pitch (money-forward): "win the pot", real USDT, live-now social proof
//      + scarcity. CTA → TRY A QUESTION.
//   2. Demo question (interactive): a real question (getDemoQuestion), styled
//      exactly like the live quiz, with branching feedback. Builds investment
//      before the account ask. Skipped gracefully if the demo template is
//      missing (→ a 2-slide flow), exactly as v1 degraded.
//   3. Account (the username slide): headline branches on the demo result, then
//      username + wallet sign-in. On success a money-forward welcome card
//      funnels straight into the LIVE PAID TOURNAMENT (not a free level): it
//      sets `pendingTournamentJoin` so Home opens the buy sheet, buy-primed.
//
// Three slides total incl. the username slide, matching v1's lean shape. There
// is intentionally no skip: every step forward is the only path forward.
//
// Dismissal is persisted by the caller (Stage) via localStorage, so it only
// shows on the very first open. `onPlay` is the single exit.

// One combined social-proof + live signal: an avatar stack with a live count.
// (Was three separate "live" cues — a LIVE EVERY HOUR chip, the stack, and a
// "spots are filling" pill — which read as clutter saying the same thing.)
const LivePlayers = () => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center" }}>
      {[
        ASSETS.avatarFox,
        ASSETS.avatarBear,
        ASSETS.avatarFrog,
        ASSETS.avatarPanda,
      ].map((src, i) => (
        <PixelImg
          key={i}
          src={src}
          size={34}
          alt=""
          style={{
            marginLeft: i ? -12 : 0,
            borderRadius: 99,
            border: "2px solid var(--frame)",
          }}
        />
      ))}
    </div>
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 800,
        color: "var(--ink-soft)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 99,
          background: "var(--live-red)",
          boxShadow: "0 0 0 3px rgba(252,25,25,.2)",
          animation: "waffles-v2-pulse 1.5s infinite",
        }}
      />
      2,000+ playing now
    </span>
  </div>
);

// Money hero for the pitch: a prize chest crowned with a trophy. The pot is the
// promise, so it leads the very first screen the player sees.
const PrizeVisual = () => (
  <div
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <PixelImg
      src={ASSETS.chestRainbow}
      size={160}
      alt=""
      style={{ filter: "drop-shadow(0 14px 26px rgba(0,0,0,.45))" }}
    />
    <PixelImg
      src={ASSETS.trophy}
      size={64}
      alt=""
      style={{
        position: "absolute",
        top: -12,
        right: 2,
        transform: "rotate(8deg)",
        filter: "drop-shadow(0 6px 12px rgba(0,0,0,.4))",
      }}
    />
  </div>
);

type Slide = {
  key: string;
  kicker: string;
  kickerColor: string;
  title: ReactNode;
  body: ReactNode;
  visual: ReactNode;
};

// The single money-forward pitch slide. Everything paid players need to *want*
// in: the pot, that it's real USDT, that it's live now, and that it's cheap to
// enter — with scarcity to nudge action.
const PITCH: Slide = {
  key: "pitch",
  kicker: "REAL-MONEY TRIVIA",
  kickerColor: "var(--maple-500)",
  title: (
    <>
      Answer fast.
      <br />
      <span style={{ color: "var(--maple-500)" }}>Win the pot.</span>
    </>
  ),
  body: (
    <>
      Buy in for a few cents, race thousands through 6 questions, and the top
      players{" "}
      <strong style={{ color: "var(--ink)" }}>
        split the prize pool in real USDT
      </strong>
      .
    </>
  ),
  visual: <PrizeVisual />,
};

// Inline "link" button styling for the consent line — looks like a text link
// but opens the in-app legal sheet instead of navigating away.
const legalLinkStyle: CSSProperties = {
  color: "var(--ink-mute)",
  fontWeight: 800,
  textDecoration: "underline",
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  cursor: "pointer",
};

// Pregenerated username suggestions — fun, on-brand, charset-safe (a-z0-9._,
// matches the input filter, ≤ 20 chars). Players can tap one to use it.
const NAME_ADJ = [
  "Swift",
  "Golden",
  "Clever",
  "Lucky",
  "Mighty",
  "Sneaky",
  "Brave",
  "Quick",
  "Sharp",
  "Wild",
  "Royal",
  "Turbo",
  "Witty",
  "Bold",
  "Crispy",
];
const NAME_NOUN = [
  "Fox",
  "Waffle",
  "Owl",
  "Panda",
  "Whiz",
  "Champ",
  "Sage",
  "Ace",
  "Falcon",
  "Maple",
  "Brain",
  "Tiger",
  "Wizard",
  "Otter",
  "Bishop",
];
function generateUsername(): string {
  const adj = NAME_ADJ[Math.floor(Math.random() * NAME_ADJ.length)];
  const noun = NAME_NOUN[Math.floor(Math.random() * NAME_NOUN.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10–99
  return `${adj}${noun}${num}`.slice(0, 20);
}
function generateUsernames(n: number): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < n && guard++ < 50) out.add(generateUsername());
  return [...out];
}

// The interactive demo. A real question rendered in the *exact* visual language
// of the live quiz (cream tile + frame border; leaf = correct, red = wrong) so
// "try a question" is a faithful preview of the thing they'll pay to play.
// Auto-advances to the account step after a beat, carrying whether they nailed
// it so the next headline can react.
const DemoSlide = ({
  question,
  onResolve,
}: {
  question: DemoQuestion;
  onResolve: (wasCorrect: boolean) => void;
}) => {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = answered && selected === question.correctIndex;

  const pick = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    const correct = idx === question.correctIndex;
    trackClientEvent(AnalyticsEvent.OnboardingSlideNextClicked, {
      step_index: 1,
      step_id: "demo",
      cta: "demo_answered",
      demo_correct: correct,
    });
    window.setTimeout(() => onResolve(correct), correct ? 1100 : 1400);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        width: "100%",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "var(--leaf)",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        TRY IT — GUESS THE ANSWER
      </div>
      <h2
        style={{
          fontFamily: "var(--font-hero)",
          fontWeight: 800,
          fontSize: 24,
          lineHeight: 1.12,
          color: "var(--ink)",
          textAlign: "center",
          margin: 0,
          maxWidth: 320,
        }}
      >
        {question.content}
      </h2>

      {question.mediaUrl && (
        <div
          style={{
            width: "100%",
            maxWidth: 280,
            borderRadius: 12,
            overflow: "hidden",
            border: "2px solid var(--frame)",
            background: "#000",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.mediaUrl}
            alt=""
            loading="lazy"
            style={{
              width: "100%",
              display: "block",
              aspectRatio: "16 / 9",
              objectFit: "cover",
            }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
          maxWidth: 320,
        }}
      >
        {question.options.map((option, idx) => {
          const isSel = selected === idx;
          const isAns = idx === question.correctIndex;
          const state: "idle" | "correct" | "wrong" | "dim" = !answered
            ? "idle"
            : isAns
              ? "correct"
              : isSel
                ? "wrong"
                : "dim";
          const bg = {
            idle: "var(--cream-pure)",
            correct: "var(--correct)",
            wrong: "var(--live-red)",
            dim: "rgba(253,251,246,.4)",
          }[state];
          const color = state === "wrong" ? "#fff" : "#191919";
          return (
            <button
              key={idx}
              type="button"
              onClick={() => pick(idx)}
              disabled={answered}
              style={{
                background: bg,
                color,
                borderRadius: 12,
                padding: "13px 16px",
                minHeight: 52,
                display: "flex",
                alignItems: "center",
                textAlign: "left",
                fontFamily: "var(--font-display)",
                fontSize: 15,
                border: "5px solid var(--frame)",
                borderTop: 0,
                borderLeft: 0,
                cursor: answered ? "default" : "pointer",
                transition:
                  "background .2s var(--ease-out-quart), transform .2s var(--ease-out-quart)",
                transform: state === "correct" ? "scale(1.03)" : "scale(1)",
                opacity: state === "dim" ? 0.5 : 1,
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered && (
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            color: isCorrect ? "var(--correct)" : "var(--ink-mute)",
            animation: "waffles-v2-onb-in .18s var(--ease-out-quart)",
          }}
        >
          {isCorrect
            ? "You're a natural."
            : "Not quite — but you get the idea."}
        </div>
      )}
    </div>
  );
};

export const OnboardingScreen = ({ onPlay }: { onPlay: () => void }) => {
  const proto = useProto();
  const { signIn } = useWalletSignIn();

  // The demo question — fetched once on mount. "loading" until it resolves;
  // null means the template is unavailable, so the flow drops the demo step and
  // runs lean (pitch → account), exactly as v1 degraded.
  const [demo, setDemo] = useState<DemoQuestion | null | "loading">("loading");
  useEffect(() => {
    let live = true;
    getDemoQuestion()
      .then((q) => {
        if (live) setDemo(q);
      })
      .catch(() => {
        if (live) setDemo(null);
      });
    return () => {
      live = false;
    };
  }, []);

  // The ordered step list adapts to whether the demo is available. It's only
  // ever read once the player leaves the pitch (the pitch CTA is disabled until
  // the demo resolves), so the sequence never shifts mid-flow.
  const flow = useMemo<("pitch" | "demo" | "account")[]>(
    () =>
      demo && demo !== "loading"
        ? ["pitch", "demo", "account"]
        : ["pitch", "account"],
    [demo],
  );

  const [idx, setIdx] = useState(0);
  const stepKey = flow[idx] ?? "account";
  const accountStep = stepKey === "account";
  const demoStep = stepKey === "demo";

  const [username, setUsernameInput] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNameSuggestions(generateUsernames(3));
  }, []);
  const [connecting, setConnecting] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [signinError, setSigninError] = useState<string | null>(null);
  // Whether they nailed the demo — branches the account headline + welcome copy.
  const [demoWasCorrect, setDemoWasCorrect] = useState(false);
  const startedRef = useRef(false);
  const trackedUsernameRef = useRef(false);

  const stepId = stepKey;
  const totalSteps = flow.length;
  const canContinue = accountStep
    ? username.trim().length >= 2 && !connecting
    : !connecting;
  // The pitch advances either into the demo or straight to the account ask;
  // until the demo state resolves the CTA waits so the flow can't branch wrong.
  const pitchWaiting = stepKey === "pitch" && demo === "loading";

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackClientEvent(AnalyticsEvent.OnboardingStarted, {
        step_index: idx,
        step_id: stepId,
        total_steps: totalSteps,
      });
    }
    trackClientEvent(AnalyticsEvent.OnboardingSlideViewed, {
      step_index: idx,
      step_id: stepId,
      total_steps: totalSteps,
    });
  }, [idx, stepId, totalSteps]);

  useEffect(() => {
    if (
      !accountStep ||
      trackedUsernameRef.current ||
      username.trim().length < 2
    )
      return;
    trackedUsernameRef.current = true;
    trackClientEvent(AnalyticsEvent.OnboardingUsernameEntered, {
      step_index: idx,
      step_id: stepId,
      username_length: username.trim().length,
    });
  }, [idx, stepId, username, accountStep]);

  // Demo resolved → advance to the account step, remembering the outcome.
  const onDemoResolved = (wasCorrect: boolean) => {
    setDemoWasCorrect(wasCorrect);
    setIdx((i) => i + 1);
  };

  const createAccount = () => {
    // Authenticate the wallet FIRST (establishing the real session), THEN persist
    // the chosen username — order matters: setUsername needs the session cookie.
    const name = username.trim();
    setSigninError(null);
    setConnecting(true);
    trackClientEvent(AnalyticsEvent.OnboardingSignupClicked, {
      step_index: idx,
      step_id: stepId,
    });
    void signIn()
      .then((ok) => {
        setConnecting(false);
        if (!ok) {
          trackClientEvent(AnalyticsEvent.OnboardingFailed, {
            step_index: idx,
            step_id: stepId,
            reason: "signin_failed",
          });
          setSigninError(
            "Couldn’t create your account — check your wallet and try again.",
          );
          return;
        }
        proto.setUsername(name);
        trackClientEvent(AnalyticsEvent.OnboardingCompleted, {
          step_index: idx,
          step_id: stepId,
          username_length: name.length,
          demo_correct: demoWasCorrect,
        });
        trackClientEvent(AnalyticsEvent.UserOnboarded, {
          step_index: idx,
          step_id: stepId,
          username_length: name.length,
        });
        setWelcomeOpen(true);
      })
      .catch(() => {
        setConnecting(false);
        setSigninError("Something went wrong — please try again.");
      });
  };

  const next = () => {
    trackClientEvent(AnalyticsEvent.OnboardingSlideNextClicked, {
      step_index: idx,
      step_id: stepId,
      total_steps: totalSteps,
      cta: accountStep ? "create_account_and_play" : "try_a_question",
    });
    if (accountStep) {
      createAccount();
      return;
    }
    setIdx((i) => i + 1);
  };

  // Finale is a two-way choice (welcome modal): both dismiss onboarding via
  // onPlay(), then either start the FREE Rookie Cup quiz directly, or land on
  // Home with the live-tournament buy sheet primed (pendingTournamentJoin).
  // Whichever they skip stays available later (Home's Rookie Cup card / the
  // live tournament card), so the two complement rather than compete.
  const enterLiveRound = () => {
    trackClientEvent(AnalyticsEvent.OnboardingSlideNextClicked, {
      step_index: idx,
      step_id: "welcome_play",
      cta: "enter_live_round",
    });
    onPlay();
    // Choosing the live round FORFEITS the one-time free Rookie Cup — mark it
    // consumed so the Home card never offers it (optimistic + persisted).
    proto.update({ pendingTournamentJoin: true, rookieDone: true });
    void skipRookieCup();
  };
  const playRookieCup = () => {
    trackClientEvent(AnalyticsEvent.OnboardingSlideNextClicked, {
      step_index: idx,
      step_id: "welcome_play",
      cta: "play_rookie_cup",
    });
    onPlay();
    void proto.enterRookieCup();
  };

  const openLegal = (tab: LegalTab) => {
    trackClientEvent(AnalyticsEvent.OnboardingLegalOpened, {
      step_index: idx,
      step_id: stepId,
      legal_tab: tab,
    });
    setLegalTab(tab);
  };

  // Account-step headline reacts to the demo outcome — turning the little win
  // (or near-miss) into momentum toward the real, paid thing.
  const accountKicker = demoWasCorrect
    ? "YOU'RE A NATURAL"
    : "READY WHEN YOU ARE";
  const accountTitle = demoWasCorrect ? "Now play for real" : "Play for real";

  const ctaLabel = accountStep
    ? connecting
      ? "CREATING ACCOUNT…"
      : signinError
        ? "TRY AGAIN"
        : "CREATE ACCOUNT & PLAY"
    : pitchWaiting
      ? "LOADING…"
      : "TRY A QUESTION";

  return (
    <Phone>
      <div className="bg-deep" />
      <div
        className="glow-top"
        style={{
          height: 320,
          background:
            "radial-gradient(ellipse at center top, rgba(255,210,77,.18), transparent 65%)",
        }}
      />

      {/* Tilted oversized wordmark watermark, matching Home. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 30,
          left: -10,
          right: -10,
          fontFamily: "var(--font-display)",
          fontSize: 110,
          color: "var(--maple-500)",
          opacity: 0.04,
          letterSpacing: 4,
          transform: "rotate(-6deg)",
          textAlign: "center",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        WAFFLES
      </div>

      {/* Content — re-keyed on step so each slide fades/slides in. */}
      <div
        key={stepKey}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 184,
          padding: "0 26px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          animation: "waffles-v2-onb-in .45s var(--ease-out-quart)",
        }}
      >
        {accountStep ? (
          <>
            <div
              style={{
                minHeight: 180,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
              }}
            >
              <PixelImg
                src={ASSETS.wally}
                size={132}
                alt=""
                style={{
                  animation: "waffles-v2-wally-idle 4s ease-in-out infinite",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "var(--maple-500)",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {accountKicker}
            </div>
            <div
              style={{
                fontFamily: "var(--font-hero)",
                fontWeight: 800,
                fontSize: 36,
                lineHeight: 1.05,
                color: "var(--ink)",
                marginBottom: 12,
              }}
            >
              {accountTitle}
            </div>
            <div
              style={{
                fontSize: 15,
                lineHeight: 1.5,
                fontWeight: 600,
                color: "var(--ink-mute)",
                maxWidth: 320,
                marginBottom: 18,
              }}
            >
              Pick a username and we&apos;ll connect your wallet, so your winnings
              stay yours.{" "}
              <strong style={{ color: "var(--maple-500)" }}>
                Your first entry is half price.
              </strong>
            </div>
            <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  color: "var(--ink-faint)",
                }}
              >
                @
              </span>
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) =>
                  setUsernameInput(
                    e.target.value.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 20),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue) next();
                }}
                placeholder="waffleeater"
                aria-label="Username"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "14px 16px 14px 36px",
                  borderRadius: 14,
                  border: "2px solid rgba(255,255,255,.14)",
                  background: "rgba(255,255,255,.05)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  letterSpacing: 0.3,
                  outline: "none",
                }}
              />
            </div>
            {nameSuggestions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 14,
                  justifyContent: "center",
                  alignItems: "center",
                  maxWidth: 320,
                }}
              >
                <span
                  style={{
                    width: "100%",
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ink-faint)",
                    marginBottom: 2,
                  }}
                >
                  Tap to use a suggestion
                </span>
                {nameSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setUsernameInput(s)}
                    style={{
                      background: "rgba(255,255,255,.05)",
                      border: "1.5px solid rgba(255,255,255,.14)",
                      borderRadius: 99,
                      padding: "7px 12px",
                      color: "var(--ink)",
                      fontFamily: "var(--font-display)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    @{s}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Shuffle suggestions"
                  onClick={() => setNameSuggestions(generateUsernames(3))}
                  style={{
                    background: "transparent",
                    border: "1.5px solid rgba(255,255,255,.14)",
                    borderRadius: 99,
                    width: 34,
                    height: 34,
                    color: "var(--ink-soft)",
                    fontSize: 15,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  🎲
                </button>
              </div>
            )}
          </>
        ) : demoStep && demo && demo !== "loading" ? (
          <DemoSlide question={demo} onResolve={onDemoResolved} />
        ) : (
          <>
            <div
              style={{
                minHeight: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 26,
              }}
            >
              {PITCH.visual}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: PITCH.kickerColor,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {PITCH.kicker}
            </div>
            <div
              style={{
                fontFamily: "var(--font-hero)",
                fontWeight: 800,
                fontSize: 38,
                lineHeight: 1.05,
                color: "var(--ink)",
                marginBottom: 14,
              }}
            >
              {PITCH.title}
            </div>
            <div
              style={{
                fontSize: 16,
                lineHeight: 1.5,
                fontWeight: 600,
                color: "var(--ink-mute)",
                maxWidth: 320,
                marginBottom: 18,
              }}
            >
              {PITCH.body}
            </div>
            {/* Single social-proof + live cue. */}
            <LivePlayers />
          </>
        )}
      </div>

      {/* Footer: progress dots + CTA. Hidden CTA on the demo step, where the
          answer buttons themselves drive the advance (like the real quiz). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "16px 18px max(16px, env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              style={{
                width: i === idx ? 26 : 8,
                height: 8,
                borderRadius: 99,
                background:
                  i === idx ? "var(--maple-500)" : "rgba(255,255,255,.18)",
                // width (not scaleX) is intentional: these dots sit in a centered
                // flex row with a gap, so the active dot must reserve real layout
                // width or it overlaps its neighbour. The cost is negligible — a
                // one-shot transition on a few tiny dots, fired on step advance.
                transition: "width .3s var(--ease-out-quart), background .3s",
              }}
            />
          ))}
        </div>
        {signinError && (
          <div
            role="alert"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              lineHeight: 1.4,
              color: "#ff6b6b",
              textAlign: "center",
              margin: "0 auto",
              maxWidth: 320,
            }}
          >
            {signinError}
          </div>
        )}
        {!demoStep && (
          <div className="cta-row">
            <button
              className={"cta" + (accountStep ? " maple" : "")}
              onClick={next}
              disabled={!canContinue || pitchWaiting}
              style={
                !canContinue || pitchWaiting
                  ? { opacity: 0.5, cursor: "not-allowed" }
                  : undefined
              }
            >
              {ctaLabel}
            </button>
          </div>
        )}
        {/* Terms consent — the CTA is the only way into the app, so this
            stays visible on every slide. */}
        <div
          style={{
            fontSize: 9.5,
            lineHeight: 1.45,
            fontWeight: 600,
            color: "var(--ink-faint)",
            textAlign: "center",
            margin: "0 auto",
            whiteSpace: "nowrap",
          }}
        >
          By continuing you agree to our{" "}
          <button
            type="button"
            onClick={() => openLegal("terms")}
            style={legalLinkStyle}
          >
            Terms of Service
          </button>{" "}
          &amp;{" "}
          <button
            type="button"
            onClick={() => openLegal("privacy")}
            style={legalLinkStyle}
          >
            Privacy Policy
          </button>
          .
        </div>
      </div>

      {welcomeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Account created"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 95,
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(180deg, #1a1410 0%, #0a0805 100%)",
            animation: "waffles-v2-onb-in .35s var(--ease-out-quart)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 320,
              background:
                "radial-gradient(ellipse at center top, rgba(255,210,77,.24), transparent 65%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 28px",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ position: "relative", marginBottom: 14 }}>
              <PixelImg
                src={ASSETS.chestRainbow}
                size={140}
                alt=""
                style={{ filter: "drop-shadow(0 0 28px rgba(255,210,77,.5))" }}
              />
              <PixelImg
                src={ASSETS.trophy}
                size={58}
                alt=""
                style={{
                  position: "absolute",
                  top: -10,
                  right: -6,
                  transform: "rotate(8deg)",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2.5,
                color: "var(--maple-500)",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Welcome, @{username.trim()}!
            </div>
            <div
              style={{
                fontFamily: "var(--font-hero)",
                fontWeight: 800,
                fontSize: 32,
                lineHeight: 1.06,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              How do you want to start?
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "rgba(255,255,255,.62)",
                maxWidth: 300,
                marginBottom: 18,
              }}
            >
              Warm up with a free cup, or jump straight into a live cash round.
            </div>
          </div>
          <div
            style={{
              padding: "0 18px max(20px, env(safe-area-inset-bottom))",
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Free Rookie Cup — the gentle, no-risk first taste. */}
            <button
              type="button"
              onClick={playRookieCup}
              style={{
                width: "100%",
                borderRadius: 14,
                border: "none",
                padding: "11px 16px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                fontFamily: "var(--font-display)",
                background: "linear-gradient(180deg, #FFD24D, #F5A91B)",
                color: "#3a2a00",
                boxShadow: "0 4px 0 #b5790f",
              }}
            >
              <span style={{ fontSize: 16, letterSpacing: 0.3 }}>
                PLAY FREE ROOKIE CUP
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>
                Guaranteed win + Syrup · no entry fee
              </span>
            </button>
            {/* Straight into the paid live round (buy sheet primed on Home). */}
            <button
              type="button"
              onClick={enterLiveRound}
              style={{
                width: "100%",
                borderRadius: 14,
                padding: "11px 16px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                fontFamily: "var(--font-display)",
                background: "rgba(255,255,255,.06)",
                border: "1.5px solid rgba(255,255,255,.18)",
                color: "#fff",
              }}
            >
              <span style={{ fontSize: 15, letterSpacing: 0.3 }}>
                ENTER A LIVE ROUND
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>
                Real USDT pot · first entry half price
              </span>
            </button>
          </div>
        </div>
      )}

      {legalTab && (
        <LegalSheet initialTab={legalTab} onClose={() => setLegalTab(null)} />
      )}
    </Phone>
  );
};
