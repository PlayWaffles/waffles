"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useProto } from "../state";
import { ASSETS, CATEGORY_COLORS, CategoryIcon, Phone, PixelImg } from "../shared";
import { playSound } from "../sound";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import { Illustration } from "../world-cup/components/parts";
import { loadCurrentTournamentBoard, loadPowerUps } from "@/player/api";
import type { PowerUpName, Proto } from "../state";

// Power-ups available to activate during a question (icon + label per kind).
const POWERUP_DEFS: { kind: PowerUpName; label: string; icon: string }[] = [
  { kind: "FIFTY_FIFTY", label: "50/50", icon: ASSETS.powerup5050 },
  { kind: "EXTRA_TIME", label: "+5s", icon: ASSETS.powerupTime },
  { kind: "SKIP", label: "Skip", icon: ASSETS.powerupSkip },
  { kind: "SHIELD", label: "Shield", icon: ASSETS.powerupShield },
];

// "People answering" social-presence strip (tournament only). Avatars + the
// field-size cap come from real DB entrants; the live trickle (faces popping in
// one-by-one, count climbing) is paced client-side, since the round is async
// with no real-time answer feed. Mounted with key={questionIdx} so each question
// starts fresh.
const LIVE_AVATARS = [
  ASSETS.avatarFox, ASSETS.avatarBear, ASSETS.avatarFrog, ASSETS.avatarPanda,
  ASSETS.avatarOwl, ASSETS.avatarCat, ASSETS.avatarDog, ASSETS.avatarRabbit,
];
// Deterministic avatar per real player name (stable across renders).
const avatarFor = (name: string) =>
  LIVE_AVATARS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % LIVE_AVATARS.length];

// memo: this strip carries no props, so memoizing it keeps the 100ms question
// timer (which re-renders QuestionScreen) from also re-rendering the avatar
// stack — it only re-renders on its own trickle interval.
const LiveAnswerers = memo(function LiveAnswerers() {
  const [people, setPeople] = useState<{ id: number; av: string }[]>([]);
  const [fieldSize, setFieldSize] = useState(0);
  const [shown, setShown] = useState(0);
  const [answered, setAnswered] = useState(0);

  // Real DB participants only — actual entrants of the current live tournament.
  useEffect(() => {
    let active = true;
    loadCurrentTournamentBoard()
      .then((b) => {
        if (!active || !b) return;
        setPeople(b.standings.slice(0, 5).map((s, i) => ({ id: i + 1, av: avatarFor(s.name) })));
        setFieldSize(b.fieldSize);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Live trickle: answerers arrive one-by-one as the question runs — each tick
  // pops a new face into the stack and climbs the count toward the field size.
  // The round is async (no real-time answer feed), so the cadence is paced
  // client-side over the real participants / real field size.
  useEffect(() => {
    if (fieldSize === 0) return;
    const id = setInterval(() => {
      setShown((s) => Math.min(s + 1, 5));
      setAnswered((a) => Math.min(a + 1 + Math.floor(Math.random() * 2), fieldSize));
    }, 1400);
    return () => clearInterval(id);
  }, [fieldSize]);

  const visible = people.slice(0, shown);

  // Compact top pill — sits above the timer where the answer-result banner (which
  // owns the bottom) can never cover it, so it stays live before AND after you
  // answer. New faces pop into the stack one-by-one; the count climbs.
  return (
    <div style={{ position: "absolute", top: 102, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 99, padding: "4px 12px 4px 6px", backdropFilter: "blur(2px)" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {visible.map((p, i) => (
            <div key={p.id} style={{ width: 26, height: 26, borderRadius: 99, marginLeft: i === 0 ? 0 : -9, overflow: "hidden", border: "2px solid var(--frame)", background: "linear-gradient(135deg, var(--maple-500), #FF6B35)", animation: "waffles-v2-pfp-in .42s cubic-bezier(0.34,1.56,0.64,1) both", zIndex: visible.length - i }}>
              <img src={p.av} alt="" width={26} height={26} style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated", display: "block" }} />
            </div>
          ))}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 0.3, color: "#fff", whiteSpace: "nowrap" }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: "var(--leaf)", boxShadow: "0 0 0 3px rgba(255,159,28,.25)" }} />
          {answered.toLocaleString()} answered
        </span>
      </div>
    </div>
  );
});

// The question card (category, clue, media, prompt) — pure presentational, no
// handlers, and none of its inputs change while the timer ticks, so memoizing it
// keeps it out of the 100ms re-render of QuestionScreen.
const QuestionCard = memo(function QuestionCard({ q, catColFg, cat, isMulti, isOrder, isSpatial, pick, orderN, picksLen }: { q: Proto["currentQuestion"]; catColFg: string; cat: string; isMulti: boolean; isOrder: boolean; isSpatial: boolean; pick: number; orderN: number; picksLen: number }) {
  return (
    <div style={{ background: "var(--cream-pure)", borderRadius: 14, padding: "18px 16px", position: "relative", border: `5px solid ${q.minefield ? "var(--live-red)" : "var(--leaf)"}`, borderTop: 0, borderLeft: 0, flexShrink: 0 }}>
      <div className="chip" style={{ background: q.minefield ? "var(--live-red)" : catColFg, color: q.minefield ? "#fff" : "var(--frame)", position: "absolute", top: -12, left: 14, border: "2px solid var(--frame)" }}>
        <CategoryIcon name={cat} size={14} /> {cat.toUpperCase()}
      </div>
      {/* Only show the kicker when it adds something the category pill above
          doesn't already say — many newer formats set the kicker to the same
          string as the category (e.g. "TAP ALL TRUE"), which printed twice. */}
      {q.kicker && q.kicker.trim().toUpperCase() !== cat.toUpperCase() && (
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: q.minefield ? "var(--live-red)" : catColFg, marginBottom: 8, textTransform: "uppercase" }}>{q.kicker}</div>
      )}
      {q.media && (
        <div style={{ maxWidth: 248, margin: "0 auto 12px" }}>
          <Illustration media={q.media} />
        </div>
      )}
      {q.image && (
        <div style={{ maxWidth: 300, margin: "0 auto 12px", borderRadius: 12, overflow: "hidden", border: "2px solid var(--frame)", background: "#000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.image} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "16 / 10", objectFit: "cover" }} />
        </div>
      )}
      {q.clues && q.clues.length > 0 && (
        <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          {q.clues.map((c, i) => (
            <li key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 13, fontWeight: 600, color: "#3a3a3a", lineHeight: 1.3 }}>
              <span aria-hidden style={{ color: catColFg, fontWeight: 900, flexShrink: 0 }}>›</span>
              {c}
            </li>
          ))}
        </ul>
      )}
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.25, color: "#191919" }}>{q.q}</div>
      {isMulti && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: catColFg }}>
          SELECT {pick} · {picksLen}/{pick}
        </div>
      )}
      {isOrder && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: catColFg }}>
          TAP IN ORDER · {picksLen}/{orderN}
        </div>
      )}
      {isSpatial && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: catColFg }}>TAP THE ANSWER</div>
      )}
    </div>
  );
});

// The answer grid reconciles a button per option with rich per-state styling —
// the heaviest part of the screen. Memoized so the 100ms timer doesn't re-diff
// it: none of its inputs change while the clock ticks. Taps route through
// answerRef (refreshed every parent render) so scoring still reads the LIVE
// timer at tap time, despite this subtree not re-rendering on ticks.
const AnswerGrid = memo(function AnswerGrid({ q, isMulti, isOrder, isSpatial, answered, eliminated, picks, setPicks, answerRef }: {
  q: Proto["currentQuestion"];
  isMulti: boolean;
  isOrder: boolean;
  isSpatial: boolean;
  answered: number | null;
  eliminated: number[];
  picks: number[];
  setPicks: Dispatch<SetStateAction<number[]>>;
  answerRef: MutableRefObject<(i: number) => void>;
}) {
  const correctSet = q.correctSet ?? [];
  const correctOrder = q.correctOrder ?? [];
  const flags = q.flags ?? [];
  const pick = q.pick ?? correctSet.length;
  return (
    <div style={{ display: "grid", gridTemplateColumns: isSpatial ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, flexShrink: 0 }}>
      {q.answers.map((text, i) => {
        // 50/50 power-up removed this wrong option for this question.
        const isEliminated = !isMulti && !isOrder && answered == null && eliminated.includes(i);
        let state: "idle" | "selected" | "correct" | "wrong" | "dim" = isEliminated ? "dim" : "idle";
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
        const stateBg = { idle: "var(--cream-pure)", selected: "var(--maple-500)", correct: "var(--correct)", wrong: "var(--live-red)", dim: "rgba(253,251,246,.4)" }[state];
        const stateColor = state === "wrong" ? "var(--ink)" : state === "correct" ? "var(--frame)" : "#191919";
        const onTap = () => {
          if (answered != null || isEliminated) return;
          if (isMulti) {
            setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < pick ? [...p, i] : p));
          } else if (isOrder) {
            setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
          } else {
            playSound("answerSubmit");
            answerRef.current(i);
          }
        };
        return (
          <button
            key={i}
            type="button"
            disabled={answered != null || isEliminated}
            onClick={onTap}
            aria-label={`Answer: ${text}`}
            aria-pressed={isMulti || isOrder ? picks.includes(i) : undefined}
            style={{ position: "relative", background: stateBg, borderRadius: 12, padding: "12px 14px", minHeight: 66, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch", textAlign: "left", color: stateColor, border: "5px solid var(--frame)", borderTop: 0, borderLeft: 0, font: "inherit", cursor: answered == null ? "pointer" : "default", transition: "background .12s var(--ease-out-quart), transform .12s var(--ease-out-quart)", transform: state === "correct" || state === "selected" ? "scale(1.03)" : "scale(1)", opacity: isEliminated ? 0.3 : 1 }}
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
  );
});

// The live countdown ring + digit. This is the ONLY element that animates during
// a question, so it owns a local rAF loop that writes straight to refs — no React
// state, no parent re-render. It derives remaining from the store's `deadlineAt`
// (set once per question); when answered it freezes at the recorded snapshot.
// Also voices the tense final-3s tick. Because the global timer no longer ticks at
// 10Hz, this component is the entire per-frame cost of a running question.
const RING_DASH = 264;
const CountdownRing = memo(function CountdownRing({ deadlineAt, durationSec, answered, frozenSec }: {
  deadlineAt: number | null;
  durationSec: number;
  answered: number | null;
  frozenSec: number;
}) {
  const ringRef = useRef<SVGCircleElement>(null);
  const digitRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const paint = (sec: number) => {
      const clamped = Math.max(0, sec);
      const pct = durationSec > 0 ? Math.max(0, Math.min(1, clamped / durationSec)) : 0;
      const danger = clamped < 3;
      if (ringRef.current) {
        ringRef.current.style.strokeDashoffset = String(RING_DASH * (1 - pct));
        ringRef.current.style.stroke = danger ? "#FC1919" : "#FFD24D";
      }
      if (digitRef.current) {
        digitRef.current.textContent = clamped.toFixed(1);
        digitRef.current.style.color = danger ? "#FC1919" : "#fff";
      }
    };
    // Frozen states: answered (paint the recorded snapshot) or no clock yet.
    if (answered != null || deadlineAt == null) {
      paint(answered != null ? frozenSec : durationSec);
      return;
    }
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let finalFired = false;
    const tick = () => {
      const sec = (deadlineAt - Date.now()) / 1000;
      paint(sec);
      if (!reduce && !finalFired && sec > 0 && sec <= 3) {
        finalFired = true;
        playSound("timerFinal");
      }
      if (sec > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadlineAt, durationSec, answered, frozenSec]);
  return (
    <div style={{ position: "absolute", top: 142, left: "50%", transform: "translateX(-50%)", width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="42" stroke="rgba(255,255,255,.08)" strokeWidth="8" fill="none" />
        <circle ref={ringRef} cx="48" cy="48" r="42" stroke="#FFD24D" strokeWidth="8" fill="none" strokeDasharray={RING_DASH} strokeDashoffset={RING_DASH} strokeLinecap="round" transform="rotate(-90 48 48)" style={{ transition: "stroke .3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div ref={digitRef} style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.max(0, durationSec).toFixed(1)}</div>
        <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: 0.5 }}>SECONDS</div>
      </div>
    </div>
  );
});

export const QuestionScreen = () => {
  const proto = useProto();
  const isLevel = proto.mode === "level";
  const q = proto.currentQuestion;
  const idx = proto.qIdx;
  const total = proto.totalQuestions;
  const answered = proto.qAnswered;
  const totalTime = proto.tweaks.questionTime;
  const cat = q.cat;
  const catCol = CATEGORY_COLORS[cat] || { fg: "#FB72FF" };
  const hearts = proto.hearts;

  // Owned power-ups (from the shop). Loaded once; decremented locally on use.
  const [powerUps, setPowerUps] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    loadPowerUps()
      .then((p) => {
        if (active && p) setPowerUps(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const activatePowerUp = (kind: PowerUpName) => {
    if ((powerUps[kind] ?? 0) <= 0 || proto.qAnswered != null) return;
    if (kind === "SHIELD" && proto.shieldActive) return;
    setPowerUps((p) => ({ ...p, [kind]: (p[kind] ?? 0) - 1 }));
    proto.usePowerUp(kind);
  };

  // Per-question impression for solo levels — fires once each time a new level
  // question is presented (keyed on question id), so question-level drop-off in
  // a level (esp. the first) is measurable. Tournaments aren't instrumented per
  // question; filter on `level_number` for the first-level view.
  useEffect(() => {
    if (!isLevel || !q) return;
    trackClientEvent(AnalyticsEvent.LevelQuestionStarted, {
      level_track: proto.levelTrack,
      level_number: proto.level,
      question_index: idx + 1,
      question_count: total,
      question_id: q.id,
      category: q.cat ?? null,
      kind: q.kind,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLevel, q?.id, idx]);

  // Time-up sting fires once on a timeout. The tense final-seconds tick is voiced
  // inside <CountdownRing> (it owns the live clock now). Ref gates to once per Q.
  const timeUpQRef = useRef<number | null>(null);
  useEffect(() => {
    if (answered === -1 && timeUpQRef.current !== idx) {
      timeUpQRef.current = idx;
      playSound("timeUp");
    }
  }, [answered, idx]);

  const isMulti = q.kind === "multi";
  const isOrder = q.kind === "order";
  const isSpatial = q.kind === "spatial";
  const correctSet = q.correctSet ?? [];
  const correctOrder = q.correctOrder ?? [];
  const pick = q.pick ?? correctSet.length;
  const orderN = q.answers.length;
  const needCount = isOrder ? orderN : pick;

  // The memoized <AnswerGrid> doesn't re-render on timer ticks, so it can't close
  // over a fresh proto.answerQuestion. Route taps through this ref (refreshed
  // after every render) so scoring still reads the live timer at the moment of
  // the tap — taps only fire after commit, so the ref is always current by then.
  const answerRef = useRef(proto.answerQuestion);
  useEffect(() => {
    answerRef.current = proto.answerQuestion;
  });

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
  // Common context for the abandonment funnel — captures exactly where (which
  // question) and in what mode the player considered/confirmed quitting.
  const quitContext = () => ({
    screen: "question",
    mode: proto.mode,
    is_level: isLevel,
    question_index: idx + 1,
    question_count: total,
    score: proto.score,
    level_track: proto.levelTrack,
    level_number: proto.level,
    category: q?.cat ?? null,
  });
  const promptExit = () => {
    trackClientEvent(AnalyticsEvent.GameQuitPrompted, quitContext());
    setConfirmExit(true);
  };
  const onQuit = () => {
    trackClientEvent(AnalyticsEvent.GameQuit, { ...quitContext(), confirmed: true });
    setConfirmExit(false);
    proto.goto(isLevel ? "levels" : "home", { back: true });
  };

  // Normalized result (matches the scoring in state.tsx). proto.timer is the
  // frozen remaining-at-answer snapshot once answered, so this matches the points
  // awarded by the store.
  const maxPts = Math.round(100 + proto.timer * 20);
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
        <button type="button" aria-label={isLevel ? "Quit level" : "Leave tournament"} onClick={promptExit} style={{ width: 32, height: 32, flexShrink: 0, padding: 0, borderRadius: 99, background: "rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
        </button>
        <div style={{ flex: 1, height: 8, borderRadius: 99, background: "rgba(255,255,255,.08)", display: "flex", border: "1px solid rgba(255,255,255,.05)" }}>
          {dots.map((on, i) => (
            <div key={i} style={{ flex: 1, margin: "0 1px", background: on ? "#FFD24D" : "transparent", borderRadius: 99, transition: "background .15s ease" }} />
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
            <PixelImg key={h} src={h <= hearts ? ASSETS.heartFull : ASSETS.heartEmpty} size={32} alt="heart" style={{ filter: h <= hearts ? "drop-shadow(0 0 4px rgba(252,25,25,.5))" : "none", transition: "filter .15s ease" }} />
          ))}
        </div>
      )}

      <CountdownRing deadlineAt={proto.deadlineAt} durationSec={q.time ?? totalTime} answered={answered} frozenSec={proto.timer} />

      <div style={{ position: "absolute", top: 246, left: 16, right: 16, bottom: answered != null ? 96 : (isMulti || isOrder) ? 88 : 16, display: "flex", flexDirection: "column", gap: 14, paddingTop: 14, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none" }}>
        <QuestionCard q={q} catColFg={catCol.fg} cat={cat} isMulti={isMulti} isOrder={isOrder} isSpatial={isSpatial} pick={pick} orderN={orderN} picksLen={picks.length} />

      {isLevel && answered == null && POWERUP_DEFS.some((pu) => (powerUps[pu.kind] ?? 0) > 0) && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 10, flexShrink: 0 }}>
          {POWERUP_DEFS.map((pu) => {
            const n = powerUps[pu.kind] ?? 0;
            if (n <= 0) return null;
            const shieldOn = pu.kind === "SHIELD" && proto.shieldActive;
            return (
              <button
                key={pu.kind}
                type="button"
                onClick={() => activatePowerUp(pu.kind)}
                disabled={shieldOn}
                aria-label={`Use ${pu.label} power-up (${n} left)`}
                style={{ display: "flex", alignItems: "center", gap: 5, background: shieldOn ? "var(--leaf)" : "var(--surface-2)", border: "2px solid var(--frame)", borderRadius: 99, padding: "5px 9px", color: "var(--ink)", font: "inherit", fontWeight: 800, fontSize: 11, cursor: shieldOn ? "default" : "pointer", opacity: shieldOn ? 0.7 : 1 }}
              >
                <PixelImg src={pu.icon} size={18} alt="" />
                <span>{pu.label}</span>
                <span style={{ color: "var(--ink-mute)" }}>×{n}</span>
              </button>
            );
          })}
        </div>
      )}

      <AnswerGrid q={q} isMulti={isMulti} isOrder={isOrder} isSpatial={isSpatial} answered={answered} eliminated={proto.eliminated} picks={picks} setPicks={setPicks} answerRef={answerRef} />
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
        <div role="status" aria-live="polite" style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: good ? "linear-gradient(180deg, var(--correct), var(--correct-dark))" : "linear-gradient(180deg, var(--live-red), #b30c0c)", padding: "14px 18px 22px", color: good ? "var(--frame)" : "var(--ink)", borderTop: "2px solid var(--frame)", animation: "waffles-v2-slideUp .18s var(--ease-out-quart)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
                {result === "full" ? `Correct! +${points}` : result === "partial" ? `Close! +${points}` : answered === -1 ? "Out of time!" : "Incorrect"}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>
                {good
                  ? `Speed bonus · ${(totalTime - proto.timer).toFixed(1)}s`
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
