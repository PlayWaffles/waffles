"use client";

import { useEffect, useRef, useState } from "react";
import { TOURNAMENT_FIELD_SIZE, TOURNAMENT_PRIZES, usdtLabel, tournamentReward, tournamentRank, roundCloseAt, useProto } from "../state";
import { ASSETS, AssetWell, BottomCTA, Confetti, FlameIcon, Phone, PixelImg, TicketIcon, useNow } from "../shared";
import { playSound } from "../sound";

const FIELD_SIZE = TOURNAMENT_FIELD_SIZE;

// Animated count between two values with an ease-out roll. Used for the rank
// reveal (counts the big number down from the full field to the player's spot,
// reading as "out of everyone, you landed here") and the ticket prize (counts
// up from 0). Snaps to the final value instantly under prefers-reduced-motion.
const CountUp = ({ from, to, delayMs = 300, durationMs = 1300 }: { from: number; to: number; delayMs?: number; durationMs?: number }) => {
  const [v, setV] = useState(from);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    // Reduced motion collapses the count to a single frame (dur 0 → p=1).
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dur = reduce ? 0 : durationMs;
    const delay = reduce ? 0 : delayMs;
    let raf = 0;
    const tick = (t: number) => {
      if (startedAt.current === null) startedAt.current = t;
      const elapsed = t - startedAt.current - delay;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = dur === 0 ? 1 : Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delayMs, durationMs]);
  return <>{v.toLocaleString()}</>;
};

type Row = { r: number; n: string; s: number; av: string; you?: boolean };

const LeaderRow = ({ row, delay }: { row: Row; delay: number }) => {
  const medal = row.r === 1 ? "#FFC931" : row.r === 2 ? "#bfc7d0" : row.r === 3 ? "#cd7f32" : "rgba(255,255,255,.4)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px",
        borderRadius: 12,
        background: row.you ? "rgba(255,201,49,.08)" : "transparent",
        border: row.you ? "1.5px solid var(--maple-500)" : "1.5px solid transparent",
        animation: `waffles-v2-lvl-rise .45s cubic-bezier(0.22,1,0.36,1) ${delay}s both${row.you ? `, waffles-v2-row-glow 2.4s ease-in-out ${delay + 0.5}s infinite` : ""}`,
      }}
    >
      <div style={{ width: 26, fontFamily: "var(--font-display)", fontSize: 14, color: medal, textAlign: "center", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{row.r}</div>
      <AssetWell size={50} accent={row.you ? "var(--maple-500)" : "rgba(253, 251, 246, 0.55)"} radius={13}>
        <PixelImg src={row.av} size={42} alt="" />
      </AssetWell>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: "var(--ink)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.n}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: row.you ? "var(--maple-500)" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{row.s.toLocaleString()}</div>
    </div>
  );
};

export const ResultsScreen = () => {
  const proto = useProto();
  const entry = proto.entry;
  // PROVISIONAL until the round closes; then `settled` locks the final rank/prize.
  const settled = entry?.settled ?? false;
  const provisional = !settled;
  const total = proto.totalQuestions;
  const score = entry?.score ?? proto.score;
  const liveRank = tournamentRank(score, total);
  const rank = settled ? entry?.finalRank ?? liveRank : liveRank;
  // XP actually credited — doubled by the first-tournament-of-the-day bonus.
  const xpMult = proto.tournamentBonus ? 2 : 1;
  const xpEarned = score * xpMult;
  const pct = Math.max(1, Math.round((rank / FIELD_SIZE) * 100));
  // Prize: settled = the locked reward; provisional = "if it holds" (not yet
  // awarded — it only pays at settlement).
  const won = settled ? entry?.reward ?? 0 : tournamentReward(rank);
  const wonTicket = won > 0;

  // Countdown to round close, live while provisional.
  const now = useNow(provisional);
  const msToClose = entry ? Math.max(0, roundCloseAt(entry.roundId) - now) : 0;
  const closeIn = `${String(Math.floor(msToClose / 60000)).padStart(2, "0")}:${String(Math.floor((msToClose % 60000) / 1000)).padStart(2, "0")}`;

  // Finish gives an instant positive hit (you're placed!); settlement plays the
  // win/lose cue for the locked result.
  useEffect(() => {
    playSound(provisional ? "victory" : wonTicket ? "victory" : "defeat");
  }, [provisional, wonTicket]);

  // Near-miss hook (Hooked "so close") — only on the locked result.
  const missedTier = TOURNAMENT_PRIZES.filter((t) => t.maxRank < rank).sort((a, b) => b.maxRank - a.maxRank)[0];
  const missGap = missedTier ? rank - missedTier.maxRank : 0;
  const showNearMiss = settled && !!missedTier && missGap > 0 && missGap <= 12;

  const topThree: Row[] = [
    { r: 1, n: "@quizking", s: 9840, av: ASSETS.avatarFox },
    { r: 2, n: "@trivia.eth", s: 9540, av: ASSETS.avatarBear },
    { r: 3, n: "@waffleboss", s: 9210, av: ASSETS.avatarFrog },
  ];
  const nearYou: Row[] = [
    { r: rank, n: "@you", s: score, av: ASSETS.wally, you: true },
    { r: rank + 1, n: "@brainpan", s: Math.max(0, score - 60), av: ASSETS.avatarPanda },
  ];
  // Players sitting between the podium and the player's own row — surfaced as a
  // divider so the jump from #3 to #516 reads instead of looking like a glitch.
  const playersBetween = rank - 4;

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      {/* Celebration burst — top-3 finishes get a richer confetti shower. */}
      <Confetti pieces={rank <= 3 ? 60 : 36} />
      <div className="glow-top" style={{ height: 360, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.25), transparent 60%)" }} />
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 300, backgroundImage: "radial-gradient(circle, #FFC931 2px, transparent 2.5px), radial-gradient(circle, #FB72FF 2px, transparent 2.5px), radial-gradient(circle, #00CFF2 2px, transparent 2.5px)", backgroundSize: "80px 80px, 100px 100px, 70px 70px", backgroundPosition: "0 0, 30px 40px, 50px 20px", opacity: 0.55 }} />

      {/* Single flex column from the top down to the sticky bottom bar so the
          leaderboard fills the slack instead of leaving dead space below. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 96, display: "flex", flexDirection: "column", padding: "max(40px, calc(env(safe-area-inset-top) + 30px)) 14px 0" }}>
        {/* Rank header */}
        <div style={{ textAlign: "center", color: "#fff", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,.6)", animation: "waffles-v2-lvl-rise .4s ease-out both" }}>{settled ? "YOU FINISHED" : "YOU'RE IN — CURRENTLY"}</div>
          <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 68, letterSpacing: 1, lineHeight: 1, marginTop: 6, color: "#FFC931", textShadow: "0 0 32px rgba(255,201,49,.5)", fontVariantNumeric: "tabular-nums", animation: "waffles-v2-lvl-pop .55s cubic-bezier(0.34,1.56,0.64,1) .3s both" }}>#<CountUp from={FIELD_SIZE} to={rank} /></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.7)", marginTop: 4, animation: "waffles-v2-lvl-rise .4s ease-out 1.5s both" }}>of {FIELD_SIZE.toLocaleString()} · Top {pct}%</div>
          {provisional && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "5px 12px", borderRadius: 999, background: "rgba(0,207,242,.12)", border: "1px solid rgba(0,207,242,.35)", color: "#fff", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              ⏱ Standings lock in {closeIn}
            </div>
          )}
          {showNearMiss && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(252,25,25,.12)",
                border: "1px solid rgba(252,25,25,.35)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                animation: "waffles-v2-lvl-rise .4s ease-out 1.7s both",
              }}
            >
              <span style={{ color: "var(--live-red)" }}>SO CLOSE</span>
              <span style={{ color: "rgba(255,255,255,.85)" }}>
                {missGap} spot{missGap === 1 ? "" : "s"} from {missedTier.label}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--maple-500)" }}>
                +<TicketIcon size={12} />{missedTier.tickets}
              </span>
            </div>
          )}
        </div>

        {/* Reward tiles */}
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexShrink: 0 }}>
          <div style={{ position: "relative", flex: 1, background: "linear-gradient(180deg, #FFC931, #F5BB1B)", borderRadius: 16, padding: "14px 10px", textAlign: "center", border: "2px solid #1e1e1e", boxShadow: "0 4px 0 #1e1e1e", animation: "waffles-v2-lvl-pop .5s cubic-bezier(0.34,1.56,0.64,1) .55s both" }}>
            {proto.tournamentBonus && (
              <div style={{ position: "absolute", top: -8, right: -8, background: "var(--leaf)", color: "var(--frame)", fontFamily: "var(--font-display)", fontSize: 10, padding: "2px 7px", borderRadius: 99, border: "2px solid #1e1e1e", boxShadow: "0 2px 0 #1e1e1e" }}>2×</div>
            )}
            <AssetWell size={58} accent="var(--frame)" radius={14} style={{ margin: "0 auto 6px", background: "rgba(30, 30, 30, 0.16)" }}>
              <PixelImg src={ASSETS.xpGem} size={46} alt="XP" />
            </AssetWell>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "#1e1e1e", lineHeight: 1, marginTop: 2 }}>+{xpEarned}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#1e1e1e", opacity: 0.75, marginTop: 3 }}>{proto.tournamentBonus ? "XP (2× BONUS)" : "XP EARNED"}</div>
          </div>
          <div style={{ flex: 1, background: wonTicket ? "linear-gradient(180deg, #00CFF2, #00a3c2)" : "linear-gradient(180deg, #2a2a2e, #1a1a1c)", borderRadius: 16, padding: "14px 10px", textAlign: "center", border: "2px solid #1e1e1e", boxShadow: "0 4px 0 #1e1e1e", animation: "waffles-v2-lvl-pop .5s cubic-bezier(0.34,1.56,0.64,1) .65s both" }}>
            <AssetWell size={58} accent="var(--frame)" radius={14} style={{ margin: "0 auto 6px", background: "rgba(30, 30, 30, 0.16)", opacity: wonTicket ? 1 : 0.5 }}>
              <TicketIcon size={38} />
            </AssetWell>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: wonTicket ? "#1e1e1e" : "rgba(255,255,255,.7)", lineHeight: 1, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{wonTicket ? (settled ? <>+<CountUp from={0} to={won} delayMs={900} durationMs={750} /></> : `+${won}`) : "—"}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: wonTicket ? "#1e1e1e" : "rgba(255,255,255,.5)", opacity: wonTicket ? 0.75 : 1, marginTop: 3 }}>{wonTicket ? (settled ? "PRIZE WON" : "IF IT HOLDS") : "TOP 100 ONLY"}</div>
          </div>
          <div style={{ flex: 1, background: "linear-gradient(180deg, #FB72FF, #a83fb8)", borderRadius: 16, padding: "14px 10px", textAlign: "center", border: "2px solid #1e1e1e", boxShadow: "0 4px 0 #1e1e1e", color: "#fff", animation: "waffles-v2-lvl-pop .5s cubic-bezier(0.34,1.56,0.64,1) .75s both" }}>
            <AssetWell size={58} accent="var(--frame)" radius={14} style={{ margin: "0 auto 6px", background: "rgba(30, 30, 30, 0.16)" }}>
              <span style={{ display: "inline-flex", animation: "waffles-v2-flame-flicker 1.4s ease-in-out infinite" }}>
                <FlameIcon size={46} />
              </span>
            </AssetWell>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1, marginTop: 2 }}>{proto.streak}</div>
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.9, marginTop: 3 }}>DAY STREAK</div>
          </div>
        </div>

        {/* Prize → claim bridge: winnings are USDT-backed and resolved from the
            Prize Wallet, so point the player there right after the win. */}
        {settled && wonTicket && (
          <button
            type="button"
            onClick={() => proto.goto("profile")}
            style={{ marginTop: 12, flexShrink: 0, width: "100%", background: "rgba(0,207,242,.1)", border: "1px solid rgba(0,207,242,.3)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", animation: "waffles-v2-lvl-rise .45s cubic-bezier(0.22,1,0.36,1) .9s both" }}
          >
            <TicketIcon size={22} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", lineHeight: 1 }}>Claim {usdtLabel(won)} in your Prize Wallet</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Withdraw as USDT, or keep as {won} tickets</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#00CFF2", flexShrink: 0 }}><path d="M9 5l8 7-8 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}

        {/* Leaderboard — flexes to fill the remaining height */}
        <div style={{ flex: 1, minHeight: 0, marginTop: 16, background: "#0F0F10", borderRadius: 18, border: "1px solid rgba(255,255,255,.06)", padding: "14px 12px 8px", display: "flex", flexDirection: "column", animation: "waffles-v2-lvl-rise .5s cubic-bezier(0.22,1,0.36,1) .85s both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 6px", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", letterSpacing: 0.5 }}>LEADERBOARD</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#FFC931", display: "flex", alignItems: "center", gap: 5 }}>TOP 100 <TicketIcon size={14} /></div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {topThree.map((row, i) => (
              <LeaderRow key={row.r} row={row} delay={0.95 + i * 0.07} />
            ))}

            {playersBetween > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 12px", animation: "waffles-v2-lvl-rise .45s ease-out 1.16s both" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.07)" }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.32)", letterSpacing: 0.6, whiteSpace: "nowrap" }}>⋯ {playersBetween.toLocaleString()} players ⋯</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.07)" }} />
              </div>
            )}

            {nearYou.map((row, i) => (
              <LeaderRow key={`near-${row.r}-${i}`} row={row} delay={1.23 + i * 0.07} />
            ))}
          </div>
        </div>
      </div>

      {provisional ? (
        // Round still live — you're already in, so the only action is to leave
        // and check back. No replay (one entry per round).
        <BottomCTA label="DONE — CHECK BACK AT CLOSE" onClick={() => proto.goto("home")} />
      ) : (
        <div className="bottom-bar">
          <div className="cta-row">
            <button className="cta icon-btn" aria-label="Back to home" onClick={() => proto.goto("home")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12l9-8 9 8v8a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" /></svg>
            </button>
            <button className="cta maple" onClick={() => proto.goto("home")}>PLAY NEXT HOUR</button>
          </div>
        </div>
      )}
    </Phone>
  );
};
