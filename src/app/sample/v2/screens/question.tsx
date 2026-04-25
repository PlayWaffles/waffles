"use client";

import { useProto } from "../state";
import { ASSETS, CATEGORY_COLORS, CategoryIcon, Phone, PixelImg } from "../shared";

export const QuestionScreen = () => {
  const proto = useProto();
  const isLevel = proto.mode === "level";
  const q = proto.currentQuestion;
  const idx = proto.qIdx;
  const total = proto.totalQuestions;
  const answered = proto.qAnswered;
  const totalTime = proto.tweaks.questionTime;
  const timeLeft = proto.timer;
  const ringPct = Math.max(0, Math.min(1, timeLeft / totalTime));
  const ringDash = 264;
  const ringOffset = ringDash * (1 - ringPct);
  const isCorrect = answered === q.correct;
  const points = answered != null && isCorrect ? Math.round(100 + timeLeft * 20) : 0;
  const cat = q.cat;
  const catCol = CATEGORY_COLORS[cat] || { fg: "#FB72FF" };
  const hearts = proto.hearts;

  const dots = Array.from({ length: total }, (_, i) => i < idx + (answered != null ? 1 : 0));

  return (
    <Phone statusDark>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #000 100%)" }} />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 240, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.15), transparent 65%)" }} />

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, padding: "0 16px", display: "flex", gap: 8, alignItems: "center", zIndex: 5 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 99, background: "rgba(255,255,255,.08)", display: "flex", border: "1px solid rgba(255,255,255,.05)" }}>
          {dots.map((on, i) => (
            <div key={i} style={{ flex: 1, margin: "0 1px", background: on ? "#FFC931" : "transparent", borderRadius: 99, transition: "background .3s" }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontWeight: 800, fontSize: 13 }}>
          <span style={{ opacity: 0.5 }}>Q</span>{idx + 1}/{total}
        </div>
      </div>

      {!isLevel ? (
        <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.08)", color: "#fff", padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#FC1919" }}>●</span> Rank 247 of 2,418
        </div>
      ) : (
        <div style={{ position: "absolute", top: 78, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
          {[1, 2, 3].map((h) => (
            <PixelImg key={h} src={h <= hearts ? ASSETS.heartFull : ASSETS.heartEmpty} size={24} alt="heart" style={{ filter: h <= hearts ? "drop-shadow(0 0 4px rgba(252,25,25,.5))" : "none", transition: "filter .3s" }} />
          ))}
        </div>
      )}

      <div style={{ position: "absolute", top: 108, left: "50%", transform: "translateX(-50%)", width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="42" stroke="rgba(255,255,255,.08)" strokeWidth="8" fill="none" />
          <circle cx="48" cy="48" r="42" stroke={timeLeft < 3 ? "#FC1919" : "#FFC931"} strokeWidth="8" fill="none" strokeDasharray={ringDash} strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 48 48)" style={{ transition: "stroke-dashoffset .1s linear, stroke .3s" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 32, color: timeLeft < 3 ? "#FC1919" : "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.max(0, timeLeft).toFixed(1)}</div>
          <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: 0.5 }}>SECONDS</div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 218, left: 16, right: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px 16px", position: "relative", border: "5px solid #00CFF2", borderTop: 0, borderLeft: 0 }}>
          <div className="chip" style={{ background: catCol.fg, color: "#1e1e1e", position: "absolute", top: -12, left: 14, border: "2px solid #1e1e1e" }}>
            <CategoryIcon name={cat} size={14} /> {cat.toUpperCase()}
          </div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 18, lineHeight: 1.25, color: "#191919" }}>{q.q}</div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 348, left: 16, right: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {q.answers.map((text, i) => {
          const letters = ["A", "B", "C", "D"];
          let state: "idle" | "correct" | "wrong" | "dim" = "idle";
          if (answered != null) {
            if (i === q.correct) state = "correct";
            else if (i === answered) state = "wrong";
            else state = "dim";
          }
          const stateBg = { idle: "#fff", correct: "#00CFF2", wrong: "#FC1919", dim: "rgba(255,255,255,.4)" }[state];
          const stateColor = state === "idle" ? "#191919" : state === "correct" ? "#1e1e1e" : state === "wrong" ? "#fff" : "#191919";
          return (
            <div
              key={i}
              onClick={() => answered == null && proto.answerQuestion(i)}
              style={{ background: stateBg, borderRadius: 12, padding: "12px 12px", minHeight: 78, display: "flex", flexDirection: "column", justifyContent: "space-between", color: stateColor, border: "5px solid #1e1e1e", borderTop: 0, borderLeft: 0, cursor: answered == null ? "pointer" : "default", transition: "background .3s, transform .2s", transform: state === "correct" ? "scale(1.03)" : "scale(1)" }}
            >
              <div style={{ fontFamily: "Archivo Black", fontSize: 11, opacity: 0.6 }}>{letters[i]}</div>
              <div style={{ fontFamily: "Archivo Black", fontSize: 15, lineHeight: 1.1 }}>{text}</div>
            </div>
          );
        })}
      </div>

      {answered != null && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: isCorrect ? "linear-gradient(180deg, #00CFF2, #00a3c2)" : "linear-gradient(180deg, #FC1919, #b30c0c)", padding: "14px 18px 22px", color: isCorrect ? "#1e1e1e" : "#fff", borderTop: "2px solid #1e1e1e", animation: "waffles-v2-slideUp .25s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "Archivo Black", fontSize: 18 }}>{isCorrect ? `Correct! +${points}` : answered === -1 ? "Out of time!" : "Incorrect"}</div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>{isCorrect ? `Speed bonus · ${(totalTime - timeLeft).toFixed(1)}s` : `Answer: ${q.answers[q.correct]}`}</div>
            </div>
            {isCorrect && <div style={{ fontFamily: "Archivo Black", fontSize: 30, textShadow: "0 2px 0 rgba(0,0,0,.15)" }}>+{points}</div>}
          </div>
        </div>
      )}
    </Phone>
  );
};
