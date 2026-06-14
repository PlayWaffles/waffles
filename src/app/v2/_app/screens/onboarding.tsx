"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useProto } from "../state";
import { ASSETS, Phone, PixelImg } from "../shared";
import { LegalSheet, type LegalTab } from "../legal";

// First-launch onboarding. New players were dropped on Home with no idea what
// the core loop is (live tournaments vs. the solo level path vs. tickets). This
// is a short, skippable intro — three orientation slides then a CTA that drops
// them straight into their first level so the first thing they do is *play*.
//
// Dismissal is persisted by the caller (Stage) via localStorage, so it only
// shows on the very first open. `onPlay` dismisses + starts a level; `onSkip`
// dismisses to Home.

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

const RewardVisual = () => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 18 }}>
    <PixelImg src={ASSETS.ticket} size={84} alt="" />
    <PixelImg src={ASSETS.trophy} size={104} alt="" style={{ marginBottom: 4 }} />
  </div>
);

// Sign-up step illustration — a wallet card (the account) with a coin, since
// "sign up" here means connecting a wallet.
const WalletVisual = () => (
  <div style={{ position: "relative", width: 200, height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: 168, height: 108, borderRadius: 18, background: "linear-gradient(135deg, #2a2a2e, #141418)", border: "2px solid rgba(255,255,255,.12)", boxShadow: "0 14px 30px rgba(0,0,0,.45)", transform: "rotate(-7deg)", position: "relative" }}>
      <div aria-hidden style={{ position: "absolute", top: 18, left: 18, width: 34, height: 26, borderRadius: 6, background: "var(--maple-500)" }} />
      <div aria-hidden style={{ position: "absolute", top: 22, right: 18, width: 10, height: 10, borderRadius: 99, background: "var(--leaf)" }} />
      <div aria-hidden style={{ position: "absolute", bottom: 18, left: 18, right: 40, height: 9, borderRadius: 99, background: "rgba(255,255,255,.14)" }} />
    </div>
    <PixelImg src={ASSETS.coin} size={72} alt="" style={{ position: "absolute", right: 18, bottom: 10, animation: "waffles-v2-tile-bob 3s ease-in-out infinite" }} />
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
    key: "rewards",
    kicker: "WHAT YOU PLAY FOR",
    kickerColor: "var(--maple-500)",
    title: "Win real rewards",
    body: "Finish near the top to earn tickets, rise through the leagues, and unlock the shop.",
    visual: <RewardVisual />,
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

export const OnboardingScreen = ({
  onPlay,
  onSkip,
}: {
  onPlay: () => void;
  onSkip: () => void;
}) => {
  const proto = useProto();
  const [step, setStep] = useState(0);
  const [username, setUsernameInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const STEPS = SLIDES.length + 2; // intro slides + sign-up + username
  const signupStep = step === SLIDES.length;
  const usernameStep = step === SLIDES.length + 1;
  const slide = SLIDES[step]; // undefined on the sign-up & username steps
  const canContinue = usernameStep ? username.trim().length >= 2 : !connecting;

  const next = () => {
    if (usernameStep) {
      proto.setUsername(username.trim());
      onPlay();
      proto.startLevel();
      return;
    }
    if (signupStep) {
      // "Sign up" = connect wallet (simulated in the prototype). Show a brief
      // connecting state, then advance to the username step.
      setConnecting(true);
      setTimeout(() => {
        setConnecting(false);
        setStep((s) => s + 1);
      }, 850);
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <Phone>
      <div className="bg-deep" />
      <div className="glow-top" style={{ height: 320, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.18), transparent 65%)" }} />

      {/* Tilted oversized wordmark watermark, matching Home. */}
      <div aria-hidden="true" style={{ position: "absolute", top: 30, left: -10, right: -10, fontFamily: "var(--font-display)", fontSize: 110, color: "var(--maple-500)", opacity: 0.04, letterSpacing: 4, transform: "rotate(-6deg)", textAlign: "center", pointerEvents: "none", whiteSpace: "nowrap" }}>WAFFLES</div>

      {/* Skip — hidden on the sign-up step: connecting a wallet is required. */}
      {!signupStep && (
        <button
          type="button"
          className="pressable"
          onClick={onSkip}
          style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", right: 18, zIndex: 10, fontSize: 13, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 0.5, padding: 6 }}
        >
          Skip
        </button>
      )}

      {/* Content — re-keyed on step so each slide fades/slides in. */}
      <div
        key={usernameStep ? "username" : signupStep ? "signup" : slide.key}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 184, padding: "0 26px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", animation: "waffles-v2-onb-in .45s var(--ease-out-quart)" }}
      >
        {signupStep ? (
          <>
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <WalletVisual />
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--leaf)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              CREATE YOUR ACCOUNT
            </div>
            <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 38, lineHeight: 1.05, color: "var(--ink)", marginBottom: 14 }}>
              Sign up to play
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600, color: "var(--ink-mute)", maxWidth: 320 }}>
              Connect your wallet to save your progress and cash out real USDT prizes. It&apos;s your account — and your payout.
            </div>
          </>
        ) : usernameStep ? (
          <>
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <PixelImg src={ASSETS.wally} size={150} alt="" style={{ animation: "waffles-v2-wally-idle 4s ease-in-out infinite" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              ONE LAST THING
            </div>
            <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 38, lineHeight: 1.05, color: "var(--ink)", marginBottom: 14 }}>
              Pick a username
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600, color: "var(--ink-mute)", maxWidth: 320, marginBottom: 22 }}>
              This is how you&apos;ll show up on the leaderboard.
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
              onClick={() => setStep(i)}
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
        <div className="cta-row">
          <button
            className={"cta" + (usernameStep || signupStep ? " maple" : "")}
            onClick={next}
            disabled={!canContinue}
            style={!canContinue ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            {usernameStep ? "PLAY MY FIRST LEVEL" : signupStep ? (connecting ? "CONNECTING…" : "SIGN UP") : "NEXT"}
          </button>
        </div>
        <button
          type="button"
          className="pressable"
          onClick={onSkip}
          style={{ fontSize: 13, fontWeight: 800, color: usernameStep ? "var(--ink-mute)" : "transparent", textAlign: "center", letterSpacing: 0.3, height: 18, pointerEvents: usernameStep ? "auto" : "none" }}
        >
          {usernameStep ? "Explore on my own" : ""}
        </button>

        {/* Terms consent — both the CTA and Skip proceed into the app, so this
            stays visible on every slide. */}
        <div style={{ fontSize: 9.5, lineHeight: 1.45, fontWeight: 600, color: "var(--ink-faint)", textAlign: "center", margin: "0 auto", whiteSpace: "nowrap" }}>
          By continuing you agree to our{" "}
          <button type="button" onClick={() => setLegalTab("terms")} style={legalLinkStyle}>
            Terms of Service
          </button>{" "}
          &amp;{" "}
          <button type="button" onClick={() => setLegalTab("privacy")} style={legalLinkStyle}>
            Privacy Policy
          </button>
          .
        </div>
      </div>

      {legalTab && <LegalSheet initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </Phone>
  );
};
