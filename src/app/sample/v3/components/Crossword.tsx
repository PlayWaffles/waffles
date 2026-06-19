"use client";

import { useMemo, useState } from "react";
import { Delete } from "lucide-react";
import { PixelButton } from "@/components/ui/PixelButton";
import { CROSSWORD } from "../data";
import { Prompt } from "./parts";

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const key = (r: number, c: number) => `${r}-${c}`;

export function Crossword({ onExit }: { onExit: () => void }) {
  // Build the solution + active-cell map from the entries.
  const { solution, starts } = useMemo(() => {
    const sol: Record<string, string> = {};
    const st: Record<string, number> = {};
    for (const e of CROSSWORD.entries) {
      st[key(e.row, e.col)] = e.number;
      for (let i = 0; i < e.answer.length; i++) {
        const r = e.dir === "down" ? e.row + i : e.row;
        const c = e.dir === "across" ? e.col + i : e.col;
        sol[key(r, c)] = e.answer[i];
      }
    }
    return { solution: sol, starts: st };
  }, []);

  const [values, setValues] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [dir, setDir] = useState<"across" | "down">("across");
  const [checked, setChecked] = useState(false);

  const isActive = (r: number, c: number) => key(r, c) in solution;
  const filledAll = Object.keys(solution).every((k) => values[k]);
  const solved = checked && Object.entries(solution).every(([k, ch]) => values[k] === ch);

  const selectCell = (r: number, c: number) => {
    if (!isActive(r, c)) return;
    if (sel.r === r && sel.c === c) {
      // Toggle direction if this cell belongs to both an across and a down.
      const across = isActive(r, c - 1) || isActive(r, c + 1);
      const down = isActive(r - 1, c) || isActive(r + 1, c);
      if (across && down) setDir((d) => (d === "across" ? "down" : "across"));
    }
    setSel({ r, c });
  };

  const advance = (r: number, c: number) => {
    const nr = dir === "down" ? r + 1 : r;
    const nc = dir === "across" ? c + 1 : c;
    if (isActive(nr, nc)) setSel({ r: nr, c: nc });
  };

  const typeLetter = (ch: string) => {
    if (checked || !isActive(sel.r, sel.c)) return;
    setValues((v) => ({ ...v, [key(sel.r, sel.c)]: ch }));
    advance(sel.r, sel.c);
  };

  const backspace = () => {
    if (checked) return;
    setValues((v) => {
      const next = { ...v };
      if (next[key(sel.r, sel.c)]) {
        delete next[key(sel.r, sel.c)];
      } else {
        const pr = dir === "down" ? sel.r - 1 : sel.r;
        const pc = dir === "across" ? sel.c - 1 : sel.c;
        if (isActive(pr, pc)) {
          delete next[key(pr, pc)];
          setSel({ r: pr, c: pc });
        }
      }
      return next;
    });
  };

  const selectClue = (e: (typeof CROSSWORD.entries)[number]) => {
    setDir(e.dir);
    setSel({ r: e.row, c: e.col });
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Prompt kicker="CROSSWORD" text={CROSSWORD.prompt} />

      {/* Grid */}
      <div className="mx-auto mb-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${CROSSWORD.size}, 44px)` }}>
        {Array.from({ length: CROSSWORD.size }).map((_, r) =>
          Array.from({ length: CROSSWORD.size }).map((_, c) => {
            const k = key(r, c);
            const active = isActive(r, c);
            if (!active) return <div key={k} className="h-11 w-11 rounded-md bg-transparent" />;
            const isSel = sel.r === r && sel.c === c;
            const val = values[k] ?? "";
            const right = checked && val === solution[k];
            const wrong = checked && val && val !== solution[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => selectCell(r, c)}
                className="relative flex h-11 w-11 items-center justify-center rounded-md border-2 font-body text-[22px] text-white"
                style={{
                  borderColor: right
                    ? "#14B985"
                    : wrong
                      ? "#FF4444"
                      : isSel
                        ? "var(--brand-gold)"
                        : "rgba(255,255,255,0.18)",
                  background: isSel ? "rgba(255,201,49,0.14)" : "var(--card)",
                }}
              >
                {starts[k] ? (
                  <span className="absolute left-0.5 top-0 font-display text-[9px] text-white/50">
                    {starts[k]}
                  </span>
                ) : null}
                {val}
              </button>
            );
          }),
        )}
      </div>

      {/* Clues */}
      <div className="mx-auto mb-4 w-full max-w-[340px] space-y-1.5 px-4">
        {CROSSWORD.entries.map((e) => {
          const isCur = dir === e.dir && sel.r === e.row && sel.c === e.col;
          return (
            <button
              key={`${e.number}-${e.dir}`}
              type="button"
              onClick={() => selectClue(e)}
              className="flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left font-display text-[12px] leading-snug"
              style={{
                borderColor: isCur ? "var(--brand-gold)" : "rgba(255,255,255,0.12)",
                background: isCur ? "rgba(255,201,49,0.08)" : "var(--card)",
              }}
            >
              <span className="font-body text-waffle-gold">
                {e.number}
                {e.dir === "across" ? "A" : "D"}
              </span>
              <span className="text-white/80">{e.clue}</span>
            </button>
          );
        })}
      </div>

      {/* Keyboard */}
      {!checked ? (
        <div className="mx-auto w-full max-w-[400px] space-y-1.5 px-2">
          {KEY_ROWS.map((row, i) => (
            <div key={i} className="flex justify-center gap-1">
              {row.split("").map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => typeLetter(ch)}
                  className="h-10 flex-1 rounded-md bg-white/10 font-body text-[15px] text-white active:scale-95"
                  style={{ maxWidth: 34 }}
                >
                  {ch}
                </button>
              ))}
              {i === KEY_ROWS.length - 1 ? (
                <button
                  type="button"
                  onClick={backspace}
                  aria-label="Backspace"
                  className="flex h-10 items-center justify-center rounded-md bg-white/10 px-3 text-white active:scale-95"
                >
                  <Delete size={18} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col items-center gap-2 px-5">
        {checked ? (
          <>
            <p className="font-body text-[20px]" style={{ color: solved ? "#14B985" : "#FF6B6B" }}>
              {solved ? "Solved! 🏆" : "Not quite — check the red cells"}
            </p>
            {!solved ? (
              <PixelButton variant="filled" colorTheme="green" width={200} height={46} fontSize={14} onClick={() => setChecked(false)}>
                KEEP TRYING
              </PixelButton>
            ) : null}
            <PixelButton variant="outline" colorTheme="cyan" width={240} height={46} fontSize={14} onClick={onExit}>
              BACK TO FORMATS
            </PixelButton>
          </>
        ) : (
          <PixelButton
            variant="filled"
            colorTheme="green"
            width={240}
            height={52}
            fontSize={15}
            disabled={!filledAll}
            onClick={() => setChecked(true)}
          >
            {filledAll ? "CHECK" : "FILL THE GRID"}
          </PixelButton>
        )}
      </div>
    </div>
  );
}
