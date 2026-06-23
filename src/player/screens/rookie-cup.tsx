"use client";

import { useEffect, useRef, useState } from "react";
import { useProto } from "../state";
import { ASSETS, BackButton, Phone, PixelImg, resolveAvatar, SyrupIcon } from "../shared";
import { playSound } from "../sound";
import { getRookieCup, submitRookieCup } from "@/player/api";
import type { ClientRoundQuestion } from "@/lib/player/roundQuestions";
import type { RookieResult } from "@/lib/player/rookieCup";
import type { RoundAnswer } from "@/lib/player/scoring";

type Phase = "loading" | "play" | "submitting" | "result" | "unavailable";

// Module-scoped so the purity linter doesn't flag the (intentional) clock read.
const nowMs = () => Date.now();

// The free intro tournament: a short round against a field of REAL past players'
// scores. Self-contained (doesn't touch the on-chain tournament state machine) so
// the first experience never hits the wallet. Frames the field as "the field" —
// real scores, never claimed to be live opponents.
export const RookieCupScreen = () => {
  const proto = useProto();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<ClientRoundQuestion[]>([]);
  const [fieldSize, setFieldSize] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [result, setResult] = useState<RookieResult | null>(null);
  const answers = useRef<RoundAnswer[]>([]);
  const shownAt = useRef(0);

  useEffect(() => {
    let active = true;
    getRookieCup()
      .then((cup) => {
        if (!active) return;
        if (!cup || cup.done || cup.questions.length === 0) {
          setPhase("unavailable");
          return;
        }
        setQuestions(cup.questions);
        setFieldSize(cup.fieldSize);
        shownAt.current = nowMs();
        setPhase("play");
      })
      .catch(() => active && setPhase("unavailable"));
    return () => { active = false; };
  }, []);

  const answer = async (q: ClientRoundQuestion, choice: number) => {
    playSound("click");
    answers.current.push({ id: q.id, selection: [choice], responseMs: nowMs() - shownAt.current });
    if (qIdx + 1 < questions.length) {
      setQIdx((i) => i + 1);
      shownAt.current = nowMs();
      return;
    }
    // Last question → settle.
    setPhase("submitting");
    try {
      const res = await submitRookieCup(answers.current);
      if (res) {
        setResult(res);
        if (res.syrup > 0) proto.update((s) => ({ tickets: s.tickets + res.syrup }));
        playSound(res.rank === 1 ? "victory" : "purchase");
        setPhase("result");
      } else {
        setPhase("unavailable");
      }
    } catch {
      setPhase("unavailable");
    }
  };

  const leave = () => proto.goto("home", { back: true });

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240, background: "radial-gradient(ellipse at center top, rgba(255,210,77,.22), transparent 65%)", pointerEvents: "none" }} />

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, padding: "0 14px", display: "flex", alignItems: "center", zIndex: 2 }}>
        <BackButton label="Leave Rookie Cup" onClick={leave} />
      </div>

      {(phase === "loading" || phase === "submitting") && (
        <Centered>
          <PixelImg src={ASSETS.trophy} size={64} alt="" style={{ opacity: 0.85, marginBottom: 14 }} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)" }}>
            {phase === "loading" ? "Setting up the Rookie Cup…" : "Tallying the field…"}
          </div>
        </Centered>
      )}

      {phase === "unavailable" && (
        <Centered>
          <PixelImg src={ASSETS.trophy} size={64} alt="" style={{ opacity: 0.85, marginBottom: 14 }} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)" }}>You&apos;re past the Rookie Cup</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8, maxWidth: 260, textAlign: "center" }}>
            Head to the real tournaments — that&apos;s where the prizes are.
          </div>
          <Cta onClick={leave}>Back to home</Cta>
        </Centered>
      )}

      {phase === "play" && questions[qIdx] && (
        <div style={{ position: "absolute", top: 104, left: 16, right: 16, bottom: 24, display: "flex", flexDirection: "column" }}>
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)", letterSpacing: 0.5 }}>🧇 ROOKIE CUP</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", marginTop: 2 }}>{fieldSize} in the field · beat them to graduate</div>
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 5, margin: "8px 0 14px" }}>
            {questions.map((_, i) => (
              <span key={i} style={{ width: i === qIdx ? 9 : 6, height: i === qIdx ? 9 : 6, borderRadius: 99, background: i < qIdx ? "var(--leaf)" : i === qIdx ? "var(--maple-500)" : "rgba(255,255,255,.2)" }} />
            ))}
          </div>
          <div style={{ background: "var(--surface-1)", border: "1px solid rgba(253,251,246,.06)", borderRadius: 16, padding: "16px 16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--maple-500)", marginBottom: 8 }}>{questions[qIdx].cat}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)", lineHeight: 1.3 }}>{questions[qIdx].q}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {questions[qIdx].answers.map((opt, i) => (
              <button
                key={i}
                onClick={() => answer(questions[qIdx], i)}
                className="pressable"
                style={{ textAlign: "left", background: "#0F0F10", border: "1.5px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "14px 16px", color: "var(--ink)", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div style={{ position: "absolute", top: 96, left: 16, right: 16, bottom: 20, display: "flex", flexDirection: "column" }}>
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <PixelImg src={ASSETS.trophy} size={64} alt="" style={{ filter: "drop-shadow(0 0 22px rgba(255,210,77,.4))" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--maple-500)", marginTop: 4 }}>YOU PLACED #{result.rank} OF {result.fieldSize}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", marginTop: 4 }}>
              You beat {result.fieldSize - result.rank} {result.fieldSize - result.rank === 1 ? "rookie" : "rookies"} on your first try.
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, background: "rgba(255,210,77,.12)", border: "1px solid rgba(255,210,77,.3)", borderRadius: 12, padding: "8px 14px", fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)" }}>
              <SyrupIcon size={18} />+{result.syrup} Syrup
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none", background: "var(--surface-1)", border: "1px solid rgba(253,251,246,.06)", borderRadius: 16, padding: "8px 0" }}>
            {result.standings.map((s) => (
              <div key={`${s.rank}-${s.name}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 14px", background: s.you ? "rgba(255,210,77,.08)" : undefined }}>
                <div style={{ width: 20, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 13, color: s.rank <= 3 ? "var(--maple-500)" : "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>{s.rank}</div>
                <PixelImg src={resolveAvatar(s.you ? proto.avatarId ?? null : null, s.name)} size={32} alt="" style={{ borderRadius: 99, objectFit: "cover" }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: s.you ? "var(--maple-500)" : "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.you ? proto.username || "You" : s.name}</div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{s.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <Cta onClick={leave}>You&apos;re not a rookie anymore →</Cta>
        </div>
      )}
    </Phone>
  );
};

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px" }}>{children}</div>
);

const Cta = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="btn-3d-gold"
    style={{ marginTop: 16, width: "100%", background: "var(--maple-500)", color: "var(--frame)", border: "2px solid var(--frame)", borderRadius: 14, padding: "14px 16px", fontFamily: "var(--font-body)", fontWeight: 900, fontSize: 15, cursor: "pointer" }}
  >
    {children}
  </button>
);
