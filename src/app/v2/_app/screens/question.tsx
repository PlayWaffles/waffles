"use client";

import { useEffect, useState } from "react";
import { useProto } from "../state";
import { ASSETS, CATEGORY_COLORS, CategoryIcon, Phone, PixelImg } from "../shared";
import { playSound } from "../sound";
import { Illustration } from "../world-cup/components/parts";

// Live "people answering" social-presence strip (tournament only). With no
// backend, we simulate the WebSocket feed waffles-celo gets: fake players
// trickle in answering the current question — a recent-PFP row plus a climbing
// count. Mounted with key={questionIdx} so each question starts fresh.
const LIVE_AVATARS = [
  ASSETS.avatarFox, ASSETS.avatarBear, ASSETS.avatarFrog, ASSETS.avatarPanda,
  ASSETS.avatarOwl, ASSETS.avatarCat, ASSETS.avatarDog, ASSETS.avatarRabbit,
];

function LiveAnswerers() {
  const [people, setPeople] = useState<{ id: number; av: string }[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let id = 0;
    let timer: number;
    const tick = () => {
      if (cancelled) return;
      id += 1;
      const av = LIVE_AVATARS[Math.floor(Math.random() * LIVE_AVATARS.length)];
      setPeople((p) => [{ id, av }, ...p].slice(0, 5));
      // The count climbs faster than the visible row — a field of thousands.
      setCount((c) => c + 1 + Math.floor(Math.random() * 4));
      timer = window.setTimeout(tick, 300 + Math.random() * 650);
    };
    timer = window.setTimeout(tick, 420);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Compact top pill — sits above the timer where the answer-result banner (which
  // owns the bottom) can never cover it, so it stays live before AND after you
  // answer. Avatars overlap into a stack; the count climbs in real time.
  return (
    <div style={{ position: "absolute", top: 102, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 99, padding: "4px 12px 4px 6px", backdropFilter: "blur(2px)" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {people.map((p, i) => (
            <div key={p.id} style={{ width: 26, height: 26, borderRadius: 99, marginLeft: i === 0 ? 0 : -9, overflow: "hidden", border: "2px solid var(--frame)", background: "linear-gradient(135deg, var(--maple-500), #FF6B35)", animation: "waffles-v2-pfp-in .42s cubic-bezier(0.34,1.56,0.64,1) both", zIndex: people.length - i }}>
              <img src={p.av} alt="" width={26} height={26} style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated", display: "block" }} />
            </div>
          ))}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 0.3, color: "#fff", whiteSpace: "nowrap" }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: "var(--leaf)", boxShadow: "0 0 0 3px rgba(0,207,242,.25)" }} />
          {count.toLocaleString()} answered
        </span>
      </div>
    </div>
  );
}

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
  const cat = q.cat;
  const catCol = CATEGORY_COLORS[cat] || { fg: "#FB72FF" };
  const hearts = proto.hearts;

  const isMulti = q.kind === "multi";
  const isOrder = q.kind === "order";
  const isSpatial = q.kind === "spatial";
  const correctSet = q.correctSet ?? [];
  const correctOrder = q.correctOrder ?? [];
  const flags = q.flags ?? [];
  const pick = q.pick ?? correctSet.length;
  const orderN = q.answers.length;
  const needCount = isOrder ? orderN : pick;

  // Local multi-select picks (before submit); reset when the question changes —
  // done during render (React's recommended alternative to an effect).
  const [picks, setPicks] = useState<number[]>([]);
  const [picksIdx, setPicksIdx] = useState(idx);
  if (picksIdx !== idx) {
    setPicksIdx(idx);
    setPicks([]);
  }

  // Quit confirmation. Levels just discard progress; tournaments forfeit the
  // already-spent entry ticket (and any winnings), so we confirm before leaving.
  const [confirmExit, setConfirmExit] = useState(false);
  const onQuit = () => {
    setConfirmExit(false);
    proto.goto(isLevel ? "levels" : "home", { back: true });
  };

  // Normalized result (matches the scoring in state.tsx).
  const maxPts = Math.round(100 + timeLeft * 20);
  let points = 0;
  let result: "full" | "partial" | "miss" = "miss";
  if (answered != null) {
    if (isMulti) {
      const sel = proto.qSelection ?? [];
      const cp = sel.filter((i) => correctSet.includes(i)).length;
      const wp = sel.filter((i) => !correctSet.includes(i)).length;
      const acc = Math.max(0, Math.min(1, (cp - wp) / pick));
      points = Math.round(maxPts * acc);
      result = acc >= 1 ? "full" : points > 0 ? "partial" : "miss";
    } else if (isOrder) {
      const seq = proto.qSelection ?? [];
      const matches = seq.filter((v, p) => v === correctOrder[p]).length;
      const acc = Math.max(0, Math.min(1, matches / (orderN || 1)));
      points = Math.round(maxPts * acc);
      result = acc >= 1 ? "full" : points > 0 ? "partial" : "miss";
    } else {
      const ok = answered === q.correct;
      points = ok ? maxPts : 0;
      result = ok ? "full" : "miss";
    }
  }
  const good = result !== "miss";

  const dots = Array.from({ length: total }, (_, i) => i < idx + (answered != null ? 1 : 0));

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div className="glow-top" style={{ height: 240 }} />

      <div style={{ position: "absolute", top: 66, left: 0, right: 0, padding: "0 16px", display: "flex", gap: 8, alignItems: "center", zIndex: 5 }}>
        <button type="button" aria-label={isLevel ? "Quit level" : "Leave tournament"} onClick={() => setConfirmExit(true)} style={{ width: 32, height: 32, flexShrink: 0, padding: 0, borderRadius: 99, background: "rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
        </button>
        <div style={{ flex: 1, height: 8, borderRadius: 99, background: "rgba(255,255,255,.08)", display: "flex", border: "1px solid rgba(255,255,255,.05)" }}>
          {dots.map((on, i) => (
            <div key={i} style={{ flex: 1, margin: "0 1px", background: on ? "#FFC931" : "transparent", borderRadius: 99, transition: "background .3s" }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontWeight: 800, fontSize: 13 }}>
          <span style={{ opacity: 0.5 }}>Q</span>{idx + 1}/{total}
        </div>
      </div>

      {confirmExit && (
        <div role="dialog" aria-modal="true" aria-label={isLevel ? "Quit level?" : "Leave tournament?"} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 300, background: "var(--cream-pure)", color: "#191919", borderRadius: 16, border: "5px solid var(--frame)", borderTop: 0, borderLeft: 0, padding: "20px 18px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 6 }}>{isLevel ? "Quit level?" : "Leave tournament?"}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#5b5b5b", marginBottom: 18 }}>
              {isLevel ? "Your progress won't be saved — but you keep your life." : "You'll forfeit your entry ticket and any prize."}
            </div>
            <button type="button" className="cta maple" style={{ width: "100%" }} onClick={() => setConfirmExit(false)}>KEEP PLAYING</button>
            <button type="button" onClick={onQuit} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: "#c0392b", fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 0.3, cursor: "pointer", padding: 6 }}>
              {isLevel ? "QUIT" : "LEAVE & FORFEIT"}
            </button>
          </div>
        </div>
      )}

      {!isLevel ? (
        // Live "people answering" presence (replaces the old static rank pill).
        // Sits up top so the bottom answer-result banner never covers it.
        <LiveAnswerers key={idx} />
      ) : (
        <div style={{ position: "absolute", top: 94, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
          {[1, 2, 3].map((h) => (
            <PixelImg key={h} src={h <= hearts ? ASSETS.heartFull : ASSETS.heartEmpty} size={32} alt="heart" style={{ filter: h <= hearts ? "drop-shadow(0 0 4px rgba(252,25,25,.5))" : "none", transition: "filter .3s" }} />
          ))}
        </div>
      )}

      <div style={{ position: "absolute", top: 142, left: "50%", transform: "translateX(-50%)", width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="42" stroke="rgba(255,255,255,.08)" strokeWidth="8" fill="none" />
          <circle cx="48" cy="48" r="42" stroke={timeLeft < 3 ? "#FC1919" : "#FFC931"} strokeWidth="8" fill="none" strokeDasharray={ringDash} strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 48 48)" style={{ transition: "stroke-dashoffset .1s linear, stroke .3s" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: timeLeft < 3 ? "#FC1919" : "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.max(0, timeLeft).toFixed(1)}</div>
          <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: 0.5 }}>SECONDS</div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 246, left: 16, right: 16, bottom: answered != null ? 96 : (isMulti || isOrder) ? 88 : 16, display: "flex", flexDirection: "column", gap: 14, paddingTop: 14, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none" }}>
        <div style={{ background: "var(--cream-pure)", borderRadius: 14, padding: "18px 16px", position: "relative", border: `5px solid ${q.minefield ? "var(--live-red)" : "var(--leaf)"}`, borderTop: 0, borderLeft: 0, flexShrink: 0 }}>
          <div className="chip" style={{ background: q.minefield ? "var(--live-red)" : catCol.fg, color: q.minefield ? "#fff" : "var(--frame)", position: "absolute", top: -12, left: 14, border: "2px solid var(--frame)" }}>
            <CategoryIcon name={cat} size={14} /> {cat.toUpperCase()}
          </div>
          {q.kicker && (
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: q.minefield ? "var(--live-red)" : catCol.fg, marginBottom: 8, textTransform: "uppercase" }}>{q.kicker}</div>
          )}
          {q.media && (
            <div style={{ maxWidth: 248, margin: "0 auto 12px" }}>
              <Illustration media={q.media} />
            </div>
          )}
          {q.clues && q.clues.length > 0 && (
            <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              {q.clues.map((c, i) => (
                <li key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 13, fontWeight: 600, color: "#3a3a3a", lineHeight: 1.3 }}>
                  <span aria-hidden style={{ color: catCol.fg, fontWeight: 900, flexShrink: 0 }}>›</span>
                  {c}
                </li>
              ))}
            </ul>
          )}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.25, color: "#191919" }}>{q.q}</div>
          {isMulti && (
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: catCol.fg }}>
              SELECT {pick} · {picks.length}/{pick}
            </div>
          )}
          {isOrder && (
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: catCol.fg }}>
              TAP IN ORDER · {picks.length}/{orderN}
            </div>
          )}
          {isSpatial && (
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: catCol.fg }}>TAP THE ANSWER</div>
          )}
        </div>

      <div style={{ display: "grid", gridTemplateColumns: isSpatial ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, flexShrink: 0 }}>
        {q.answers.map((text, i) => {
          let state: "idle" | "selected" | "correct" | "wrong" | "dim" = "idle";
          if (isMulti) {
            if (answered != null) state = correctSet.includes(i) ? "correct" : picks.includes(i) ? "wrong" : "dim";
            else state = picks.includes(i) ? "selected" : "idle";
          } else if (isOrder) {
            if (answered != null) state = picks.indexOf(i) === correctOrder.indexOf(i) ? "correct" : "wrong";
            else state = picks.includes(i) ? "selected" : "idle";
          } else if (answered != null) {
            if (i === q.correct) state = "correct";
            else if (i === answered) state = "wrong";
            else state = "dim";
          }
          const orderPos = isOrder && picks.includes(i) ? picks.indexOf(i) + 1 : null;
          const stateBg = { idle: "var(--cream-pure)", selected: "var(--maple-500)", correct: "var(--leaf)", wrong: "var(--live-red)", dim: "rgba(253,251,246,.4)" }[state];
          const stateColor = state === "wrong" ? "var(--ink)" : state === "correct" ? "var(--frame)" : "#191919";
          const onTap = () => {
            if (answered != null) return;
            if (isMulti) {
              setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < pick ? [...p, i] : p));
            } else if (isOrder) {
              setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
            } else {
              playSound("answerSubmit");
              proto.answerQuestion(i);
            }
          };
          return (
            <button
              key={i}
              type="button"
              disabled={answered != null}
              onClick={onTap}
              aria-label={`Answer: ${text}`}
              aria-pressed={isMulti || isOrder ? picks.includes(i) : undefined}
              style={{ position: "relative", background: stateBg, borderRadius: 12, padding: "12px 14px", minHeight: 66, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch", textAlign: "left", color: stateColor, border: "5px solid var(--frame)", borderTop: 0, borderLeft: 0, font: "inherit", cursor: answered == null ? "pointer" : "default", transition: "background .2s var(--ease-out-quart), transform .2s var(--ease-out-quart)", transform: state === "correct" || state === "selected" ? "scale(1.03)" : "scale(1)" }}
            >
              {orderPos != null && (
                <span style={{ position: "absolute", top: -8, left: -8, width: 22, height: 22, borderRadius: 99, background: "var(--frame)", color: "var(--maple-500)", fontFamily: "var(--font-display)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--maple-500)" }}>{orderPos}</span>
              )}
              {isSpatial && flags[i] && (
                <div style={{ fontSize: 32, lineHeight: 1, textAlign: "center", marginBottom: 4 }} aria-hidden>{flags[i]}</div>
              )}
              <div style={{ fontFamily: "var(--font-display)", fontSize: isSpatial ? 13 : 16, lineHeight: 1.2, textAlign: isSpatial ? "center" : "left" }}>{text}</div>
            </button>
          );
        })}
      </div>
      </div>

      {/* Multi / ordered confirm */}
      {(isMulti || isOrder) && answered == null && (
        <button
          type="button"
          className="cta maple"
          disabled={picks.length !== needCount}
          onClick={() => {
            playSound("answerSubmit");
            if (isMulti) proto.answerMulti(picks);
            else proto.answerOrder(picks);
          }}
          style={{ position: "absolute", left: 16, right: 16, bottom: 24, opacity: picks.length === needCount ? 1 : 0.5 }}
        >
          CONFIRM {picks.length}/{needCount}
        </button>
      )}

      {answered != null && (
        <div role="status" aria-live="polite" style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: good ? "linear-gradient(180deg, var(--leaf), var(--leaf-dark))" : "linear-gradient(180deg, var(--live-red), #b30c0c)", padding: "14px 18px 22px", color: good ? "var(--frame)" : "var(--ink)", borderTop: "2px solid var(--frame)", animation: "waffles-v2-slideUp .25s var(--ease-out-quart)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
                {result === "full" ? `Correct! +${points}` : result === "partial" ? `Close! +${points}` : answered === -1 ? "Out of time!" : "Incorrect"}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>
                {good
                  ? `Speed bonus · ${(totalTime - timeLeft).toFixed(1)}s`
                  : isMulti
                    ? `Answer: ${correctSet.map((i) => q.answers[i]).join(", ")}`
                    : isOrder
                      ? `Order: ${correctOrder.map((i) => q.answers[i]).join(" → ")}`
                      : `Answer: ${q.answers[q.correct]}`}
              </div>
            </div>
            {good && <div style={{ fontFamily: "var(--font-display)", fontSize: 30, textShadow: "0 2px 0 rgba(0,0,0,.15)" }}>+{points}</div>}
          </div>
        </div>
      )}
    </Phone>
  );
};
