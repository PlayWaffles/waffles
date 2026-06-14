"use client";

import { useEffect, useState } from "react";
import { Phone, Confetti } from "../../shared";
import type { FormatDef, VQuestion } from "../data";
import { ACCENT, BackBar, Illustration, Kicker, ProgressDots, TimerRing } from "./parts";

export function FormatRunner({ format, onExit }: { format: FormatDef; onExit: () => void }) {
  const questions = format.questions ?? [];
  const total = questions.length;

  const [qIdx, setQIdx] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null); // -1 = timeout
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const q: VQuestion | undefined = questions[qIdx];
  const totalTime = q?.durationSec ?? 10;
  const [timeLeft, setTimeLeft] = useState(totalTime);

  // Tick while the question is live.
  const active = !done && answered === null && timeLeft > 0;
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setTimeLeft((v) => Math.max(0, Math.round((v - 0.1) * 10) / 10)), 100);
    return () => clearTimeout(id);
  }, [active, timeLeft]);

  // Time-up → mark as a timeout answer.
  useEffect(() => {
    if (!done && answered === null && timeLeft <= 0) finalize(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, answered, done]);

  function finalize(pick: number) {
    if (answered !== null) return;
    const isCorrect = pick >= 0 && pick === q!.correctIndex;
    setAnswered(pick);
    if (isCorrect) {
      setScore((s) => s + Math.round(100 + timeLeft * 20));
      setCorrectCount((c) => c + 1);
    }
  }

  function advance() {
    if (qIdx + 1 >= total) {
      setDone(true);
      return;
    }
    const next = qIdx + 1;
    setQIdx(next);
    setAnswered(null);
    setTimeLeft(questions[next].durationSec);
  }

  function replay() {
    setQIdx(0);
    setAnswered(null);
    setScore(0);
    setCorrectCount(0);
    setDone(false);
    setTimeLeft(questions[0].durationSec);
  }

  if (done) return <Summary total={total} correct={correctCount} score={score} onReplay={replay} onExit={onExit} />;
  if (!q) return null;

  const isCorrect = answered != null && answered === q.correctIndex;
  const points = isCorrect ? Math.round(100 + timeLeft * 20) : 0;
  const accent = ACCENT[format.accent];
  const twoUp = q.options.length === 2;

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div className="glow-top" style={{ height: 240 }} />
      <BackBar onExit={onExit} />

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: 14, height: "100%", padding: "56px 16px", paddingBottom: answered != null ? 150 : 24, overflowY: "auto" }}>
        <ProgressDots idx={qIdx} total={total} answered={answered != null} />
        <TimerRing timeLeft={timeLeft} total={totalTime} />

        {q.kicker ? <Kicker color={format.minefield ? "#FC1919" : accent}>{q.kicker}</Kicker> : null}

        {q.clues ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360, margin: "0 auto", width: "100%" }}>
            {q.clues.map((clue, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.88)", animation: `wc-pop .3s var(--ease-out-quart) ${i * 0.12}s both` }}>
                <span style={{ color: accent, fontFamily: "var(--font-display)" }}>{i + 1}.</span>
                {clue}
              </div>
            ))}
          </div>
        ) : null}

        {q.media ? <Illustration media={q.media} /> : null}

        {/* Question card */}
        <div style={{ position: "relative", background: "var(--cream-pure)", borderRadius: 14, padding: "20px 16px 16px", border: "5px solid var(--leaf)", borderTop: 0, borderLeft: 0, maxWidth: 440, margin: "0 auto", width: "100%" }}>
          {q.category ? (
            <div className="chip" style={{ background: accent, color: "var(--frame)", position: "absolute", top: -12, left: 14, border: "2px solid var(--frame)", fontFamily: "var(--font-display)" }}>
              {q.category}
            </div>
          ) : null}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.25, color: "#191919", textAlign: q.content.includes("______") ? "center" : "left" }}>
            <QuestionContent text={q.content} answer={q.options[q.correctIndex]} answered={answered != null} />
          </div>
        </div>

        {/* Options */}
        <div style={{ display: "grid", gridTemplateColumns: twoUp ? "1fr" : "1fr 1fr", gap: 10, maxWidth: 440, margin: "0 auto", width: "100%" }}>
          {q.options.map((text, i) => {
            const letters = ["A", "B", "C", "D"];
            let state: "idle" | "correct" | "wrong" | "dim" = "idle";
            if (answered != null) {
              if (i === q.correctIndex) state = "correct";
              else if (i === answered) state = "wrong";
              else state = "dim";
            }
            const bg = { idle: "var(--cream-pure)", correct: "var(--leaf)", wrong: "var(--live-red)", dim: "rgba(253,251,246,.4)" }[state];
            const color = state === "wrong" ? "var(--ink)" : "#191919";
            return (
              <button
                key={i}
                type="button"
                disabled={answered != null}
                onClick={() => answered == null && finalize(i)}
                aria-label={`Answer ${letters[i]}: ${text}`}
                style={{ background: bg, borderRadius: 12, padding: "12px", minHeight: twoUp ? 60 : 78, display: "flex", flexDirection: twoUp ? "row" : "column", justifyContent: twoUp ? "center" : "space-between", alignItems: twoUp ? "center" : "stretch", textAlign: twoUp ? "center" : "left", color, border: "5px solid var(--frame)", borderTop: 0, borderLeft: 0, font: "inherit", cursor: answered == null ? "pointer" : "default", transition: "background .3s var(--ease-out-quart), transform .2s var(--ease-out-quart)", transform: state === "correct" ? "scale(1.03)" : "scale(1)" }}
              >
                {!twoUp ? <div style={{ fontFamily: "var(--font-display)", fontSize: 11, opacity: 0.6 }}>{letters[i]}</div> : null}
                <div style={{ fontFamily: "var(--font-display)", fontSize: twoUp ? 18 : 15, lineHeight: 1.1 }}>{text}</div>
              </button>
            );
          })}
        </div>
      </div>

      {answered != null ? (
        <div role="status" aria-live="polite" style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10, background: isCorrect ? "linear-gradient(180deg, var(--leaf), var(--leaf-dark))" : "linear-gradient(180deg, var(--live-red), #b30c0c)", padding: "14px 18px", borderTop: "2px solid var(--frame)", animation: "waffles-v2-slideUp .25s var(--ease-out-quart)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: isCorrect ? "var(--frame)" : "var(--ink)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
                {isCorrect ? `Correct! +${points}` : answered === -1 ? "Out of time!" : format.minefield ? "💥 Mine hit!" : "Incorrect"}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.78 }}>
                {isCorrect ? `Speed bonus · ${(totalTime - timeLeft).toFixed(1)}s` : `Answer: ${q.options[q.correctIndex]}`}
              </div>
            </div>
            <button type="button" onClick={advance} className="cta maple" style={{ flex: "0 0 auto", height: 46, padding: "0 18px", fontSize: 15, borderColor: "var(--frame)" }}>
              {qIdx + 1 >= total ? "RESULTS" : "NEXT"}
            </button>
          </div>
        </div>
      ) : null}
    </Phone>
  );
}

/** Missing-word sentence — blank on its own centred line, filled green after answering. */
function QuestionContent({ text, answer, answered }: { text: string; answer: string; answered: boolean }) {
  if (!text.includes("______")) return <>{text}</>;
  const [before, after] = text.split("______");
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <span>{before.trim()}</span>
      <span style={{ display: "inline-flex", minWidth: 150, justifyContent: "center", borderBottom: "5px solid", borderColor: answered ? "var(--leaf)" : "var(--maple-500)", color: answered ? "#0090aa" : "#191919", padding: "0 14px 6px", lineHeight: 1, transition: "color .3s, border-color .3s" }}>
        {answered ? answer : " "}
      </span>
      <span>{after.trim()}</span>
    </span>
  );
}

function Summary({ total, correct, score, onReplay, onExit }: { total: number; correct: number; score: number; onReplay: () => void; onExit: () => void }) {
  const perfect = correct === total;
  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div className="glow-top" style={{ height: 300, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.28), transparent 65%)" }} />
      <BackBar onExit={onExit} />
      {perfect ? <Confetti /> : null}
      <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 64 }}>{perfect ? "🏆" : correct > 0 ? "⚽" : "🧤"}</div>
        <div>
          <div style={{ fontFamily: "var(--font-hero)", fontSize: 44, color: "#FFC931", lineHeight: 1 }}>{score}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "rgba(255,255,255,.6)", marginTop: 4, letterSpacing: 0.5 }}>POINTS</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,.55)", marginTop: 10 }}>{correct} / {total} correct</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 280 }}>
          <button type="button" onClick={onReplay} className="cta maple">PLAY AGAIN</button>
          <button type="button" onClick={onExit} className="cta">BACK TO FORMATS</button>
        </div>
      </div>
    </Phone>
  );
}
