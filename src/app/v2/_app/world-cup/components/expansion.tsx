"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Phone } from "../../shared";
import { BINGO, MAP_CLICK, ORDERING } from "../data";
import { BackBar, Kicker, LinearTimer, useSecondCountdown } from "./parts";

const CREAM = "var(--cream-pure)";
const FRAME = "var(--frame)";
const LEAF = "var(--leaf)";
const RED = "var(--live-red)";

// Shared full-screen wrapper for the expansion formats.
function Shell({
  accent,
  kicker,
  prompt,
  timer,
  children,
  footer,
  onExit,
}: {
  accent: string;
  kicker: string;
  prompt: string;
  timer?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onExit: () => void;
}) {
  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div className="glow-top" style={{ height: 200 }} />
      <BackBar onExit={onExit} />
      <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", gap: 14, padding: "56px 16px 22px", overflowY: "auto" }}>
        <div style={{ textAlign: "center" }}>
          <Kicker color={accent}>{kicker}</Kicker>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "#fff", lineHeight: 1.15, marginTop: 8, maxWidth: 420, marginInline: "auto" }}>{prompt}</h2>
        </div>
        {timer}
        {children}
        {footer}
      </div>
    </Phone>
  );
}

function BackCta({ onExit }: { onExit: () => void }) {
  return (
    <button type="button" onClick={onExit} className="cta" style={{ maxWidth: 280, marginInline: "auto" }}>
      BACK TO FORMATS
    </button>
  );
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Module-level so the randomness isn't called during component render.
function shuffleItems<T extends { id: string }>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.every((it, i) => it.id === items[i].id)) a.reverse();
  return a;
}

// ---------------------------------------------------------------------------
// 14 · Map Click
// ---------------------------------------------------------------------------

export function MapClick({ onExit }: { onExit: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked !== null;
  const [remaining] = useSecondCountdown(MAP_CLICK.durationSec, !done);
  const timedOut = remaining <= 0 && !picked;
  const finished = done || timedOut;
  const correct = picked === MAP_CLICK.answerId;

  return (
    <Shell
      accent={LEAF}
      kicker="MAP CLICK"
      prompt={MAP_CLICK.prompt}
      timer={<LinearTimer remaining={remaining} duration={MAP_CLICK.durationSec} />}
      onExit={onExit}
      footer={finished ? <BackCta onExit={onExit} /> : undefined}
    >
      <div style={{ position: "relative", borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "#0c1a24", padding: 12 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 18, opacity: 0.4, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "30px 30px" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {MAP_CLICK.tiles.map((t) => {
            const isAnswer = t.id === MAP_CLICK.answerId;
            const isPicked = t.id === picked;
            const reveal = finished && isAnswer;
            const wrong = isPicked && !correct;
            return (
              <button
                key={t.id}
                type="button"
                disabled={finished}
                onClick={() => !finished && setPicked(t.id)}
                style={{ gridColumn: t.col, gridRow: t.row, aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12, font: "inherit", cursor: finished ? "default" : "pointer", border: `2px solid ${reveal ? LEAF : wrong ? RED : "rgba(255,255,255,.14)"}`, background: reveal ? "rgba(0,207,242,.2)" : wrong ? "rgba(252,25,25,.16)" : "rgba(255,255,255,.05)", color: reveal || wrong ? "#fff" : "rgba(255,255,255,.6)", transition: "all .25s" }}
              >
                <span style={{ fontSize: 22 }}>{t.flag}</span>
                <span style={{ fontSize: 10, fontWeight: 800 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {finished ? (
        <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: 18, color: correct ? LEAF : RED }}>
          {correct ? "Spot on! 🇶🇦" : timedOut ? "Out of time" : "Not quite — it's Qatar"}
        </div>
      ) : null}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// 15 · Ordering
// ---------------------------------------------------------------------------

export function Ordering({ onExit }: { onExit: () => void }) {
  const pool = useMemo(() => shuffleItems(ORDERING.items), []);
  const correctOrder = useMemo(() => [...ORDERING.items].sort((a, b) => a.year - b.year).map((i) => i.id), []);
  const [order, setOrder] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [remaining] = useSecondCountdown(ORDERING.durationSec, !submitted);
  const finished = submitted || remaining <= 0;
  const allPlaced = order.length === pool.length;
  const correctCount = order.filter((id, i) => id === correctOrder[i]).length;
  const perfect = finished && correctCount === correctOrder.length;

  const toggle = (id: string) => {
    if (finished) return;
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };

  return (
    <Shell
      accent="#FB72FF"
      kicker="ORDERING"
      prompt={ORDERING.prompt}
      timer={<LinearTimer remaining={remaining} duration={ORDERING.durationSec} />}
      onExit={onExit}
      footer={
        finished ? (
          <>
            <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: 18, color: perfect ? LEAF : "#FFC931" }}>
              {perfect ? "Perfect order! 🏆" : `${correctCount}/${correctOrder.length} in place`}
            </div>
            <BackCta onExit={onExit} />
          </>
        ) : (
          <button type="button" disabled={!allPlaced} onClick={() => setSubmitted(true)} className="cta berry" style={{ maxWidth: 320, marginInline: "auto", opacity: allPlaced ? 1 : 0.5 }}>
            {allPlaced ? "CHECK ORDER" : `TAP IN ORDER (${order.length}/${pool.length})`}
          </button>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pool.map((it) => {
          const pos = order.indexOf(it.id);
          const placed = pos !== -1;
          const ok = finished && placed && correctOrder[pos] === it.id;
          const bad = finished && placed && correctOrder[pos] !== it.id;
          return (
            <button
              key={it.id}
              type="button"
              disabled={finished}
              onClick={() => toggle(it.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "12px", font: "inherit", textAlign: "left", cursor: finished ? "default" : "pointer", border: `3px solid ${ok ? LEAF : bad ? RED : placed ? "#FFC931" : "rgba(255,255,255,.12)"}`, background: placed ? "rgba(255,201,49,.08)" : "rgba(255,255,255,.04)", transition: "all .2s" }}
            >
              <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 15, background: placed ? "#FFC931" : "rgba(255,255,255,.08)", color: placed ? "#191919" : "rgba(255,255,255,.5)" }}>{placed ? pos + 1 : "?"}</span>
              <span style={{ fontSize: 22 }}>{it.flag}</span>
              <span style={{ flex: 1, fontWeight: 800, color: "#fff", fontSize: 17 }}>{it.label}</span>
              {finished ? <span style={{ fontWeight: 800, fontSize: 13, color: "rgba(255,255,255,.5)" }}>{it.year}</span> : null}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// 16 · Trivia Bingo
// ---------------------------------------------------------------------------

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function Bingo({ onExit }: { onExit: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [remaining] = useSecondCountdown(BINGO.durationSec, !submitted);
  const finished = submitted || remaining <= 0;

  const toggle = (i: number) => {
    if (finished) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const bingoLine = finished ? LINES.find((line) => line.every((i) => BINGO.cells[i].truth && selected.has(i))) : undefined;
  const hits = [...selected].filter((i) => BINGO.cells[i].truth).length;
  const mistakes = [...selected].filter((i) => !BINGO.cells[i].truth).length;

  return (
    <Shell
      accent="#FFC931"
      kicker="TRIVIA BINGO"
      prompt={BINGO.prompt}
      timer={<LinearTimer remaining={remaining} duration={BINGO.durationSec} />}
      onExit={onExit}
      footer={
        finished ? (
          <>
            <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: 20, color: bingoLine ? "#FFC931" : "#fff" }}>
              {bingoLine ? "BINGO! 🎉" : `${hits} true · ${mistakes} wrong`}
            </div>
            <BackCta onExit={onExit} />
          </>
        ) : (
          <button type="button" onClick={() => setSubmitted(true)} className="cta maple" style={{ maxWidth: 280, marginInline: "auto" }}>CALL BINGO</button>
        )
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, maxWidth: 360, marginInline: "auto", width: "100%" }}>
        {BINGO.cells.map((cell, i) => {
          const isSel = selected.has(i);
          const inBingo = bingoLine?.includes(i);
          const ok = finished && isSel && cell.truth;
          const bad = finished && isSel && !cell.truth;
          const missed = finished && !isSel && cell.truth;
          const border = inBingo ? "#FFC931" : ok ? LEAF : bad ? RED : missed ? "rgba(252,25,25,.4)" : isSel ? "#FFC931" : "rgba(255,255,255,.12)";
          const bg = inBingo ? "rgba(255,201,49,.24)" : ok ? "rgba(0,207,242,.18)" : bad ? "rgba(252,25,25,.16)" : isSel ? "rgba(255,201,49,.12)" : "rgba(255,255,255,.04)";
          return (
            <button
              key={i}
              type="button"
              disabled={finished}
              onClick={() => toggle(i)}
              style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 8, borderRadius: 12, font: "inherit", cursor: finished ? "default" : "pointer", textAlign: "center", border: `2px solid ${border}`, background: bg, color: isSel || ok || missed ? "#fff" : "rgba(255,255,255,.7)", fontSize: 11, fontWeight: 800, lineHeight: 1.15, transition: "all .2s" }}
            >
              <span>{cell.text}</span>
              {finished ? <span style={{ fontSize: 13 }}>{cell.truth ? "✓" : "✗"}</span> : null}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

