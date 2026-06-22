"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, SyrupIcon } from "../shared";
import { LegalSheet, type LegalTab } from "../legal";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";

// First-launch onboarding. New players were dropped on Home with no idea what
// the core loop is (live tournaments vs. the solo level path vs. tickets). This
// is a short, mandatory intro — four orientation slides then a create-account
// step (username + wallet) that drops them straight into their first level, so
// the first thing they do is *play*. There is intentionally no skip: every step
// forward is the only path forward, ending at the account gate.
//
// Dismissal is persisted by the caller (Stage) via localStorage, so it only
// shows on the very first open. `onPlay` is the single exit — it dismisses +
// starts a level.

type Slide = {
  key: string;
  // Eyebrow / kicker above the title.
  kicker: string;
  kickerColor: string;
  title: string;
  body: string;
  visual: ReactNode;
};

const LiveStack = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 9, height: 9, borderRadius: 99, background: "var(--live-red)", boxShadow: "0 0 0 5px rgba(252,25,25,.2)", animation: "waffles-v2-pulse 1.5s infinite" }} />
      <div className="chip" style={{ background: "rgba(252,25,25,.15)", color: "var(--live-red)", border: "1px solid rgba(252,25,25,.3)", fontSize: 12 }}>LIVE EVERY HOUR</div>
    </div>
    <div style={{ display: "flex", alignItems: "center" }}>
      {[ASSETS.avatarFox, ASSETS.avatarBear, ASSETS.avatarFrog, ASSETS.avatarPanda, ASSETS.avatarOwl].map((src, i) => (
        <PixelImg key={i} src={src} size={62} alt="" style={{ marginLeft: i ? -20 : 0 }} />
      ))}
      <div aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 99, background: "var(--maple-500)", color: "var(--frame)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, marginLeft: -16, fontFamily: "var(--font-display)", border: "2px solid var(--frame)" }}>+2k</div>
    </div>
  </div>
);

const LevelVisual = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {[0, 1, 2].map((i) => (
        <PixelImg key={i} src={ASSETS.heartFull} size={40} alt="" />
      ))}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <PixelImg src={ASSETS.flame} size={44} alt="" />
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "#fff", lineHeight: 1 }}>
        12
        <span style={{ fontSize: 14, color: "var(--ink-mute)", marginLeft: 6 }}>day streak</span>
      </div>
    </div>
  </div>
);

// A miniature of the real global leaderboard — same visual language (top-3 gold
// rank, avatar, trophy + points, and the maple-tinted "you" row pinned at the
// bottom) so the slide previews exactly where players are headed.
const LEADER_PREVIEW: { rank: number; name: string; pts: number; avatar: string; you?: boolean }[] = [
  { rank: 1, name: "swiftfox42", pts: 6543, avatar: ASSETS.avatarFox },
  { rank: 2, name: "maplewhiz", pts: 5150, avatar: ASSETS.avatarBear },
  { rank: 3, name: "owlsage", pts: 5050, avatar: ASSETS.avatarOwl },
  { rank: 12, name: "you", pts: 1320, avatar: ASSETS.wally, you: true },
];

const LeaderboardVisual = () => (
  <div style={{ width: 264, background: "var(--surface-1)", borderRadius: 16, border: "1px solid rgba(253, 251, 246, 0.06)", overflow: "hidden", boxShadow: "0 14px 30px rgba(0,0,0,.4)" }}>
    {LEADER_PREVIEW.map((p) => {
      const rankColor = p.rank === 1 ? "var(--maple-500)" : p.rank === 2 ? "#bfc7d0" : p.rank === 3 ? "#cd7f32" : "var(--ink-faint)";
      return (
        <div
          key={p.rank}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            ...(p.you
              ? { background: "#191507", borderTop: "1.5px solid var(--maple-500)" }
              : null),
          }}
        >
          <div style={{ width: 20, fontFamily: "var(--font-display)", fontSize: 13, color: rankColor, textAlign: "center", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{p.rank}</div>
          <PixelImg src={p.avatar} size={32} alt="" />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{p.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <PixelImg src={ASSETS.trophy} size={20} alt="" />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: p.you ? "var(--maple-500)" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{p.pts.toLocaleString()}</span>
          </div>
        </div>
      );
    })}
  </div>
);

const SLIDES: Slide[] = [
  {
    key: "welcome",
    kicker: "WELCOME TO",
    kickerColor: "var(--leaf)",
    title: "Waffles",
    body: "Real-time trivia where every second counts. Answer fast, climb the ranks, and win.",
    visual: (
      <PixelImg
        src={ASSETS.wally}
        size={184}
        alt="Wally, the Waffles mascot, waving hello"
        style={{ animation: "waffles-v2-wally-idle 4s ease-in-out infinite" }}
      />
    ),
  },
  {
    key: "tournaments",
    kicker: "HOW IT WORKS",
    kickerColor: "var(--live-red)",
    title: "Play live, together",
    body: "Every hour, thousands face the same 6 questions at the same time. The faster you answer, the more points you score.",
    visual: <LiveStack />,
  },
  {
    key: "levels",
    kicker: "AT YOUR OWN PACE",
    kickerColor: "var(--berry)",
    title: "Climb the level path",
    body: "Warm up solo any time. You get 3 lives per level — keep your daily streak alive for bonus XP.",
    visual: <LevelVisual />,
  },
  {
    key: "leaderboard",
    kicker: "WHERE YOU STAND",
    kickerColor: "var(--maple-500)",
    title: "Race to the top",
    body: "Every point you score moves you up the global board. Out-rank the field and take the #1 spot.",
    visual: <LeaderboardVisual />,
  },
];

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
const NAME_ADJ = ["Swift", "Golden", "Clever", "Lucky", "Mighty", "Sneaky", "Brave", "Quick", "Sharp", "Wild", "Royal", "Turbo", "Witty", "Bold", "Crispy"];
const NAME_NOUN = ["Fox", "Waffle", "Owl", "Panda", "Whiz", "Champ", "Sage", "Ace", "Falcon", "Maple", "Brain", "Tiger", "Wizard", "Otter", "Bishop"];
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

export const OnboardingScreen = ({
  onPlay,
}: {
  onPlay: () => void;
}) => {
  const proto = useProto();
  const { signIn } = useWalletSignIn();
  const [step, setStep] = useState(0);
  const [username, setUsernameInput] = useState("");
  // Pregenerated username suggestions (client-only so SSR/first render match).
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNameSuggestions(generateUsernames(3));
  }, []);
  const [connecting, setConnecting] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  // Post-signup confirmation + the sign-in failure message (retry inline).
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [signinError, setSigninError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const trackedUsernameRef = useRef(false);
  const STEPS = SLIDES.length + 1; // intro slides + the combined account step
  // Last step = "create your account": pick a username AND connect the wallet in
  // one go, instead of a standalone sign-up screen before it.
  const accountStep = step === SLIDES.length;
  const slide = SLIDES[step]; // undefined on the account step
  const canContinue = accountStep ? username.trim().length >= 2 && !connecting : !connecting;
  const stepId = accountStep ? "account" : slide.key;

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackClientEvent(AnalyticsEvent.OnboardingStarted, {
        step_index: step,
        step_id: stepId,
        total_steps: STEPS,
      });
    }
    trackClientEvent(AnalyticsEvent.OnboardingSlideViewed, {
      step_index: step,
      step_id: stepId,
      total_steps: STEPS,
    });
  }, [STEPS, step, stepId]);

  useEffect(() => {
    if (!accountStep || trackedUsernameRef.current || username.trim().length < 2) return;
    trackedUsernameRef.current = true;
    trackClientEvent(AnalyticsEvent.OnboardingUsernameEntered, {
      step_index: step,
      step_id: stepId,
      username_length: username.trim().length,
    });
  }, [step, stepId, username, accountStep]);

  const next = () => {
    trackClientEvent(AnalyticsEvent.OnboardingSlideNextClicked, {
      step_index: step,
      step_id: stepId,
      total_steps: STEPS,
      cta: accountStep ? "create_account_and_play" : "next",
    });
    if (accountStep) {
      // The account step authenticates the wallet FIRST (establishing the real
      // session), THEN persists the chosen username — order matters: the
      // setUsername API call needs the session cookie, so saving it before
      // sign-in would silently no-op. On success we show a confirmation moment;
      // on failure we surface a retry instead of pretending the account exists.
      const name = username.trim();
      setSigninError(null);
      setConnecting(true);
      trackClientEvent(AnalyticsEvent.OnboardingSignupClicked, {
        step_index: step,
        step_id: stepId,
      });
      void signIn()
        .then((ok) => {
          setConnecting(false);
          if (!ok) {
            trackClientEvent(AnalyticsEvent.OnboardingFailed, {
              step_index: step,
              step_id: stepId,
              reason: "signin_failed",
            });
            setSigninError("Couldn’t create your account — check your wallet and try again.");
            return;
          }
          // Now authenticated: persist the username, then confirm.
          proto.setUsername(name);
          trackClientEvent(AnalyticsEvent.OnboardingCompleted, {
            step_index: step,
            step_id: stepId,
            username_length: name.length,
          });
          trackClientEvent(AnalyticsEvent.UserOnboarded, {
            step_index: step,
            step_id: stepId,
            username_length: name.length,
          });
          setWelcomeOpen(true);
        })
        .catch(() => {
          setConnecting(false);
          setSigninError("Something went wrong — please try again.");
        });
      return;
    }
    setStep((s) => s + 1);
  };

  const openLegal = (tab: LegalTab) => {
    trackClientEvent(AnalyticsEvent.OnboardingLegalOpened, {
      step_index: step,
      step_id: stepId,
      legal_tab: tab,
    });
    setLegalTab(tab);
  };

  return (
    <Phone>
      <div className="bg-deep" />
      <div className="glow-top" style={{ height: 320, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.18), transparent 65%)" }} />

      {/* Tilted oversized wordmark watermark, matching Home. */}
      <div aria-hidden="true" style={{ position: "absolute", top: 30, left: -10, right: -10, fontFamily: "var(--font-display)", fontSize: 110, color: "var(--maple-500)", opacity: 0.04, letterSpacing: 4, transform: "rotate(-6deg)", textAlign: "center", pointerEvents: "none", whiteSpace: "nowrap" }}>WAFFLES</div>

      {/* Content — re-keyed on step so each slide fades/slides in. */}
      <div
        key={accountStep ? "account" : slide.key}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 184, padding: "0 26px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", animation: "waffles-v2-onb-in .45s var(--ease-out-quart)" }}
      >
        {accountStep ? (
          <>
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <PixelImg src={ASSETS.wally} size={150} alt="" style={{ animation: "waffles-v2-wally-idle 4s ease-in-out infinite" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              CREATE YOUR ACCOUNT
            </div>
            <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 38, lineHeight: 1.05, color: "var(--ink)", marginBottom: 14 }}>
              Pick a username
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600, color: "var(--ink-mute)", maxWidth: 320, marginBottom: 22 }}>
              This is your name on the leaderboard. We&apos;ll connect your wallet so your progress and prizes stay yours.
            </div>
            <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
              <span aria-hidden="true" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-faint)" }}>@</span>
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 20))}
                onKeyDown={(e) => { if (e.key === "Enter" && canContinue) next(); }}
                placeholder="waffleeater"
                aria-label="Username"
                style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px 14px 36px", borderRadius: 14, border: "2px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 0.3, outline: "none" }}
              />
            </div>
            {/* Pregenerated suggestions — tap one to fill the field, or shuffle. */}
            {nameSuggestions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, justifyContent: "center", alignItems: "center", maxWidth: 320 }}>
                <span style={{ width: "100%", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", marginBottom: 2 }}>Tap to use a suggestion</span>
                {nameSuggestions.map((s) => (
                  <button key={s} type="button" onClick={() => setUsernameInput(s)} style={{ background: "rgba(255,255,255,.05)", border: "1.5px solid rgba(255,255,255,.14)", borderRadius: 99, padding: "7px 12px", color: "var(--ink)", fontFamily: "var(--font-display)", fontSize: 13, cursor: "pointer" }}>@{s}</button>
                ))}
                <button type="button" aria-label="Shuffle suggestions" onClick={() => setNameSuggestions(generateUsernames(3))} style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,.14)", borderRadius: 99, width: 34, height: 34, color: "var(--ink-soft)", fontSize: 15, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🎲</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
              {slide.visual}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: slide.kickerColor, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              {slide.kicker}
            </div>
            <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 38, lineHeight: 1.05, color: "var(--ink)", marginBottom: 14 }}>
              {slide.title}
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600, color: "var(--ink-mute)", maxWidth: 320 }}>
              {slide.body}
            </div>
          </>
        )}
      </div>

      {/* Footer: progress dots + CTA */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 18px max(16px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              className="pressable"
              onClick={() => {
                trackClientEvent(AnalyticsEvent.OnboardingSlideDotClicked, {
                  step_index: step,
                  step_id: stepId,
                  target_step_index: i,
                  total_steps: STEPS,
                });
                setStep(i);
              }}
              style={{
                width: i === step ? 26 : 8,
                height: 8,
                borderRadius: 99,
                background: i === step ? "var(--maple-500)" : "rgba(255,255,255,.18)",
                transition: "width .3s var(--ease-out-quart), background .3s",
              }}
            />
          ))}
        </div>
        {signinError && (
          <div role="alert" style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.4, color: "#ff6b6b", textAlign: "center", margin: "0 auto", maxWidth: 320 }}>
            {signinError}
          </div>
        )}
        <div className="cta-row">
          <button
            className={"cta" + (accountStep ? " maple" : "")}
            onClick={next}
            disabled={!canContinue}
            style={!canContinue ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            {accountStep
              ? connecting
                ? "CREATING ACCOUNT…"
                : signinError
                  ? "TRY AGAIN"
                  : "CREATE ACCOUNT & PLAY"
              : "NEXT"}
          </button>
        </div>
        {/* Terms consent — the CTA is the only way into the app, so this
            stays visible on every slide. */}
        <div style={{ fontSize: 9.5, lineHeight: 1.45, fontWeight: 600, color: "var(--ink-faint)", textAlign: "center", margin: "0 auto", whiteSpace: "nowrap" }}>
          By continuing you agree to our{" "}
          <button type="button" onClick={() => openLegal("terms")} style={legalLinkStyle}>
            Terms of Service
          </button>{" "}
          &amp;{" "}
          <button type="button" onClick={() => openLegal("privacy")} style={legalLinkStyle}>
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
          style={{ position: "absolute", inset: 0, zIndex: 95, display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #1a1410 0%, #0a0805 100%)", animation: "waffles-v2-onb-in .35s var(--ease-out-quart)" }}
        >
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.24), transparent 65%)", pointerEvents: "none" }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 28px", position: "relative", zIndex: 1 }}>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <PixelImg src={ASSETS.wally} size={132} alt="" style={{ filter: "drop-shadow(0 0 28px rgba(255,201,49,.5))", animation: "waffles-v2-wally-idle 4s ease-in-out infinite" }} />
              <div style={{ position: "absolute", right: 6, bottom: 6, width: 34, height: 34, borderRadius: 99, background: "var(--leaf)", color: "var(--frame)", display: "grid", placeItems: "center", fontSize: 18, fontFamily: "var(--font-display)", border: "3px solid #0a0805" }}>✓</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: "var(--maple-500)", textTransform: "uppercase", marginBottom: 8 }}>Account created</div>
            <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 34, lineHeight: 1.04, color: "#fff", marginBottom: 8 }}>
              Welcome, @{username.trim()}!
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.6)", maxWidth: 300, marginBottom: 22 }}>
              You’re all set. Here’s a little something to start you off.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "8px 14px", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                <SyrupIcon size={16} /> {proto.tickets} syrup
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "8px 14px", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                ⭐ Level {proto.level}
              </span>
            </div>
          </div>
          <div style={{ padding: "0 18px max(20px, env(safe-area-inset-bottom))", position: "relative", zIndex: 1 }}>
            <button
              type="button"
              className="cta maple"
              style={{ width: "100%", flex: "none" }}
              onClick={() => {
                trackClientEvent(AnalyticsEvent.OnboardingSlideNextClicked, { step_index: step, step_id: "welcome_play", cta: "lets_play" });
                onPlay();
                proto.startLevel();
              }}
            >
              LET’S PLAY
            </button>
          </div>
        </div>
      )}

      {legalTab && <LegalSheet initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </Phone>
  );
};
