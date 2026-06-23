"use client";

import { useEffect, useRef } from "react";
import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, resolveAvatar, SyrupIcon } from "../shared";
import { playSound } from "../sound";

// Rookie Cup RESULT screen. The round itself is played through the shared
// tournament question infra (mode "rookie"); the finish-submit settles it against
// the ghost field and lands `proto.rookieResult`, which this screen renders — a
// real-name leaderboard, the placement, and the Syrup reward, then graduates the
// player into the normal (paid) tournament flow.
export const RookieCupScreen = () => {
  const proto = useProto();
  const result = proto.rookieResult;
  const cheered = useRef(false);

  useEffect(() => {
    if (result && !cheered.current) {
      cheered.current = true;
      playSound(result.rank === 1 ? "victory" : "purchase");
    }
  }, [result]);

  const leave = () => proto.goto("home", { back: true });

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240, background: "radial-gradient(ellipse at center top, rgba(255,210,77,.22), transparent 65%)", pointerEvents: "none" }} />

      {!result ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px" }}>
          <PixelImg src={ASSETS.trophy} size={64} alt="" style={{ opacity: 0.85, marginBottom: 14 }} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)" }}>Tallying the field…</div>
        </div>
      ) : (
        <div style={{ position: "absolute", top: 70, left: 16, right: 16, bottom: 20, display: "flex", flexDirection: "column" }}>
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
          <button
            type="button"
            onClick={leave}
            className="btn-3d-gold"
            style={{ marginTop: 16, width: "100%", background: "var(--maple-500)", color: "var(--frame)", border: "2px solid var(--frame)", borderRadius: 14, padding: "14px 16px", fontFamily: "var(--font-body)", fontWeight: 900, fontSize: 15, cursor: "pointer" }}
          >
            You&apos;re not a rookie anymore →
          </button>
        </div>
      )}
    </Phone>
  );
};
