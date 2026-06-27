"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HEADLINE_TOP_PRIZE_TICKETS, isDailyBonusAvailable, TOURNAMENT_PRIZES, TOURNAMENT_TICKET_COST, USDT_PER_TICKET, usdtLabel, useProto } from "../state";
import { txStepLabel } from "../useTournamentWallet";
import type { RecentEntrant, TournamentRound } from "@/player/api";
import type { TournamentEntrySource } from "@/lib/player/tournamentGames";
import { ASSETS, Button, FlameIcon, Phone, PixelImg, resolveAvatar, Sheet, SoundToggle, SyrupIcon, TabBar, TicketIcon, TopHeader, useNow } from "../shared";
import { AnnouncementBell } from "../announcements";
import { useTheme } from "../theme";
import { useMiniPayTopUp } from "../useMiniPayTopUp";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import { TWITTER_FOLLOW_URL } from "@/lib/social-links";
import { XIcon } from "@/components/icons";
import {
  useCurrentTournamentBoardQuery,
  useMissionsQuery,
  useRecentEntrantsQuery,
  useHomeTournamentQuery,
} from "../hooks/usePlayerQueries";

const XP_PER_LEVEL = 500;

// Home XP bar. Animates the fill on mount and ROLLS OVER into the next level when
// raw XP is past the threshold: fills to 100%, the level number flips with a pop,
// then keeps filling to the remainder — repeating once per level gained. Driven
// by one animated `progress` value (0 → rawXp); width is set per-frame with no
// CSS transition, so each wrap reads as a clean reset rather than draining back.
const XpBar = ({ baseLevel, rawXp, onOpen }: { baseLevel: number; rawXp: number; onOpen: () => void }) => {
  // The XP roll-up plays on every home mount (high frequency), so it runs fully
  // outside React: refs are mutated each frame instead of setState, and the bar
  // fills via transform: scaleX (GPU, no layout) rather than an animated width.
  const fillRef = useRef<HTMLDivElement | null>(null);
  const lvlRef = useRef<HTMLSpanElement | null>(null);
  const intoRef = useRef<HTMLSpanElement | null>(null);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const levels = Math.floor(rawXp / XP_PER_LEVEL);
    const dur = reduce ? 0 : Math.min(1200, 600 + levels * 300);
    startRef.current = null;
    let raf = 0;
    let lastLevel = -1;
    const render = (progress: number) => {
      const level = baseLevel + Math.floor(progress / XP_PER_LEVEL);
      const into = Math.floor(progress % XP_PER_LEVEL);
      const pct = (progress % XP_PER_LEVEL) / XP_PER_LEVEL;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${pct})`;
      if (intoRef.current) intoRef.current.textContent = `${into}/${XP_PER_LEVEL} XP`;
      if (lvlRef.current && level !== lastLevel) {
        lvlRef.current.textContent = `Lvl ${level}`;
        // re-pop the number each time it rolls over (skip the initial mount,
        // which already carries the pop from its inline animation)
        if (lastLevel !== -1 && !reduce) {
          lvlRef.current.style.animation = "none";
          void lvlRef.current.offsetWidth; // force reflow so the pop restarts
          lvlRef.current.style.animation = "waffles-v2-lvl-pop .4s var(--ease-out-quart)";
        }
        lastLevel = level;
      }
    };
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = dur === 0 ? 1 : Math.min(1, (t - startRef.current) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      render(rawXp * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rawXp, baseLevel]);

  return (
    <button
      type="button"
      className="pressable"
      onClick={onOpen}
      aria-label={`Level ${baseLevel + Math.floor(rawXp / XP_PER_LEVEL)}, ${rawXp % XP_PER_LEVEL} of ${XP_PER_LEVEL} XP — open levels`}
      style={{ flex: 1.4, background: "var(--surface-1)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "10px 14px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span ref={lvlRef} style={{ fontSize: 10, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 0.8, textTransform: "uppercase", display: "inline-block", animation: "waffles-v2-lvl-pop .4s var(--ease-out-quart)" }}>Lvl {baseLevel}</span>
        <span ref={intoRef} style={{ fontSize: 11, fontWeight: 700, color: "var(--maple-500)", fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}>0/{XP_PER_LEVEL} XP</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.05)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div ref={fillRef} style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, var(--maple-500), var(--maple-400))", borderRadius: 99, transform: "scaleX(0)", transformOrigin: "left" }} />
      </div>
    </button>
  );
};

// ===== Tournament entry gate ==================================================
// Joining a live tournament costs a ticket. Tapping JOIN opens one of two
// bottom sheets: a confirm sheet when the player can pay, or an out-of-tickets
// sheet (with both the free earn-by-playing route and a buy route) when they
// can't. Both share the shop's sheet visual language.

const JoinConfirmSheet = ({ onClose, onConfirm, pending, stepLabel, error, fee, round, prizeTickets, winnersLabel }: { onClose: () => void; onConfirm: () => void; pending: boolean; stepLabel: string | null; error: string | null; fee: { entryFee: number; standardFee: number; firstEntry: boolean; skillBonus: number } | null; round: TournamentRound | null; prizeTickets: number; winnersLabel: string }) => {
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const canJoin = !!fee && !!round;
  // MiniPay: if the wallet can't cover the entry, swap JOIN for a one-tap
  // "Add Cash" deeplink instead of dead-ending at an insufficient-balance error.
  const { needsTopUp, openAddCash, isMiniPay } = useMiniPayTopUp(fee?.entryFee);
  const isNetworkMismatch = !!error && /MiniPay is connected to/i.test(error);
  const canTopUpForError = isMiniPay && !!error && /not enough|add cash|balance/i.test(error) && !isNetworkMismatch;
  return (
    <Sheet onClose={onClose} ariaLabel="Enter tournament">
      {(close) => (
      <>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(255,210,77,.16)", border: "1.5px solid rgba(255,210,77,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TicketIcon size={34} />
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)" }}>Enter tournament?</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginTop: 4 }}>
          {round ? `${round.title} · ${round.category} · ${round.questionCount} Q` : "Live round details unavailable"}
        </div>
        {round && (
          <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: "var(--maple-500)" }}>
            <TicketIcon size={14} />Win up to {usdtLabel(prizeTickets)} — {winnersLabel.toLowerCase()}
          </div>
        )}
      </div>

      {/* Entry is a flat $0.10 for everyone, every round — the struck-through
          standardFee is the season anchor (never charged). The discount
          card shows for ALL players; only the framing is personalized: genuine
          first-timers (no prior GameEntry) get a one-time "first tournament"
          welcome, returning players get the evergreen "World Cup special." (When
          the season flips off FOOTBALL — see DEFAULT_GAME_THEME in
          lib/game/auto-create — update the returning-player copy too.) */}
      {fee ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,210,77,0.10)", border: "1.5px solid var(--maple-500)", borderRadius: 14, padding: "12px 14px", marginBottom: error ? 8 : 14 }}>
          <div style={{ position: "relative", flexShrink: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TicketIcon size={28} />
            <div style={{ position: "absolute", top: -10, right: -16, background: "var(--live-red)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 9, padding: "2px 6px", borderRadius: 99, border: "1.5px solid var(--frame)" }}>-50%</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 1, textTransform: "uppercase" }}>{fee.firstEntry ? "First tournament" : "World Cup special"}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", marginTop: 2 }}>{fee.firstEntry ? "Your first ticket, 50% off" : "50% off tickets, all season"}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textDecoration: "line-through" }}>{usd(fee.standardFee)}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--leaf)" }}>{usd(fee.entryFee)}</div>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--surface-2)", border: "1px solid rgba(253,251,246,0.06)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: error ? 8 : 14 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", letterSpacing: 0.4, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 5 }}>
            Entry unavailable
          </span>
        </div>
      )}

      {/* Skill-edge: campaign depth → a starting score cushion. Shown only when
          earned, so it reads as a reward for climbing the World Cup track. */}
      {fee && fee.skillBonus > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(54,209,124,0.10)", border: "1px solid rgba(54,209,124,.35)", borderRadius: 12, padding: "9px 12px", marginBottom: error ? 8 : 14 }}>
          <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--leaf)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
            World Cup head start — you start <strong style={{ color: "var(--leaf)" }}>+{fee.skillBonus}</strong> from your campaign progress
          </div>
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: "var(--danger-soft, #FF6B6B)", textAlign: "center", marginBottom: 12 }}>
          {error}
          {canTopUpForError && (
            <button type="button" onClick={openAddCash} style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", color: "var(--maple-500)", fontWeight: 800, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Add Cash in MiniPay →</button>
          )}
        </div>
      )}

      {/* Proactive: detected the wallet can't cover entry — top up before tapping. */}
      {needsTopUp && !error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,210,77,.10)", border: "1px solid rgba(255,210,77,.3)", borderRadius: 12, padding: "9px 12px", marginBottom: 12, fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
          <TicketIcon size={14} /> Not enough USDT to enter — add cash and you&apos;re in.
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="ghost" flex={1} onClick={pending ? () => {} : close} disabled={pending}>CANCEL</Button>
        {needsTopUp && !isNetworkMismatch ? (
          <Button flex={1.4} onClick={openAddCash} ariaLabel="Add cash in MiniPay to play">ADD CASH TO PLAY</Button>
        ) : (
          <Button flex={1.4} onClick={pending || !canJoin || isNetworkMismatch ? () => {} : onConfirm} disabled={!canJoin || isNetworkMismatch} ariaLabel="Join the tournament">
            {pending ? (stepLabel ?? "Working…") : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <TicketIcon size={18} />Join game
              </span>
            )}
          </Button>
        )}
      </div>
      </>
      )}
    </Sheet>
  );
};

// Live-buying strip — replays real recent buyers on a paced loop (red pulse →
// popping avatar stack → rotating message) so DB history reads as live activity.
const LiveBuyingStrip = ({ entrants, title }: { entrants: RecentEntrant[]; title: string }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (entrants.length === 0) return;
    const id = setInterval(() => setI((p) => (p + 1) % entrants.length), 2400);
    return () => clearInterval(id);
  }, [entrants.length]);
  if (entrants.length === 0) return null;
  const len = entrants.length;
  const e = entrants[i % len];
  const stack = [entrants[i % len], entrants[(i + 1) % len], entrants[(i + 2) % len]];
  // Vary the verb per entrant (stable per person) so the feed doesn't read as a
  // monotonous "bought a ticket" repeat.
  const actions = ["just bought a ticket", `joined ${title}`, "is in for the next round", "just entered"];
  const action = actions[(i % len) % actions.length];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 12, background: "#0F0F10", border: "1px solid rgba(255,255,255,.08)", padding: "7px 12px", overflow: "hidden" }}>
      <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: "#FC1919", boxShadow: "0 0 0 4px rgba(252,25,25,.2)", animation: "waffles-v2-pulse 1.5s infinite" }} />
      <div style={{ display: "flex", flexShrink: 0 }}>
        {stack.map((p, idx) => (
          <span key={`${i}-${idx}`} style={{ marginLeft: idx === 0 ? 0 : -9, zIndex: stack.length - idx, display: "inline-flex", animation: idx === 0 ? "waffles-v2-buyer-pop 480ms cubic-bezier(0.25,1,0.5,1) both" : undefined }}>
            <PixelImg src={resolveAvatar(p.avatarId, p.userId)} size={23} alt="" style={{ borderRadius: 99, objectFit: "cover", background: "#1c1c1f", border: "2px solid #0F0F10" }} />
          </span>
        ))}
      </div>
      <div key={i} style={{ minWidth: 0, flex: 1, fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", animation: "waffles-v2-buyer-swap 600ms cubic-bezier(0.25,1,0.5,1)" }}>
        <span style={{ color: "#fff" }}>{e.name}</span> {action}
      </div>
    </div>
  );
};

// Decorative icon bucket for a mission, derived from its title (the Missions
// screen uses richer art; the Home card uses a 3-glyph set).
const homeMissionIcon = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes("win") || t.includes("tournament")) return "win";
  if (t.includes("play") || t.includes("day")) return "play";
  return "xp";
};

type HomeMissionRow = { label: string; cur: number; tgt: number; reward: string; icon: string };

// "Hh Mm" until the next UTC midnight — the boundary the server resets daily
// missions on (see lib/player/missions.ts).
const timeToUtcMidnight = (): string => {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((next.getTime() - now.getTime()) / 60_000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const HomeMissions = () => {
  const proto = useProto();
  const [resetIn, setResetIn] = useState(timeToUtcMidnight);
  useEffect(() => {
    const id = setInterval(() => setResetIn(timeToUtcMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);
  const { data: loaded, isLoading: missionLoading } = useMissionsQuery();
  const missions: HomeMissionRow[] = (loaded ?? [])
    .filter((x) => x.featured && x.count < x.total)
    .map((x) => ({
      label: x.title,
      cur: x.count,
      tgt: x.total,
      reward: `+${x.xp} XP`,
      icon: homeMissionIcon(x.title),
    }));
  return (
    <button
      type="button"
      className="pressable"
      onClick={() => proto.goto("missions")}
      aria-label="View all daily missions"
      style={{ display: "block", width: "100%", textAlign: "left", font: "inherit", color: "inherit", background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 14, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", letterSpacing: 0.5 }}>DAILY MISSIONS</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 0.8 }}>RESETS IN {resetIn}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {missions.length ? missions.map((m, i) => {
          const pct = Math.min(100, Math.round((m.cur / m.tgt) * 100));
          const done = m.cur >= m.tgt;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: done ? "rgba(255,159,28,.15)" : "rgba(255,255,255,.04)", border: `1px solid ${done ? "rgba(255,159,28,.4)" : "rgba(255,255,255,.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: done ? "#FF9F1C" : "rgba(255,255,255,.4)", flexShrink: 0 }}>
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : m.icon === "xp" ? (
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 10 }}>XP</span>
                ) : m.icon === "win" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 4h14v4a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V4zM10 13v4M14 13v4M8 20h8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5z" fill="currentColor" /></svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{m.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: done ? "#FF9F1C" : "rgba(255,255,255,.5)", fontFamily: "var(--font-display)" }}>{m.cur}/{m.tgt}</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,.05)", overflow: "hidden" }}>
                  <div style={{ width: "100%", height: "100%", background: done ? "linear-gradient(90deg,#FF9F1C,#5DDDF0)" : "linear-gradient(90deg, #FFD24D, #F5A91B)", transform: `scaleX(${pct / 100})`, transformOrigin: "left", transition: "transform .4s var(--ease-out-quart)" }} />
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: done ? "#FF9F1C" : "rgba(255,255,255,.55)", letterSpacing: 0.4, minWidth: 40, textAlign: "right" }}>
                {m.reward === "syrup" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>+1 <SyrupIcon size={12} /></span> : m.reward}
              </div>
            </div>
          );
        }) : (
          <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "12px", textAlign: "center", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.5)" }}>
            {missionLoading ? "Loading daily missions..." : "Daily missions unavailable"}
          </div>
        )}
      </div>
      {/* Explicit affordance — signals the whole card opens the Missions screen. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.06)", fontSize: 11, fontWeight: 800, color: "var(--leaf)", letterSpacing: 0.6, textTransform: "uppercase" }}>
        View all missions
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l8 7-8 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </button>
  );
};

const HomeContinueRun = () => {
  const proto = useProto();
  // proto.level IS the next playable level (the one shown as "current" on
  // the level path). Don't add 1 — that was the bug that made Home say
  // "Next Level 24" while the level path said "PLAY LEVEL 23".
  const level = proto.level;
  const next = level;
  return (
    <button
      type="button"
      className="pressable"
      data-coach="home-continue"
      onClick={() => proto.goto("levels")}
      aria-label={`Continue to level ${next}`}
      style={{ width: "100%", background: "linear-gradient(135deg, #241b0d 0%, var(--surface-1) 60%)", border: "1px solid rgba(255,159,28,.2)", borderRadius: 16, padding: "12px 14px", display: "flex", gap: 8, alignItems: "center", position: "relative", overflow: "hidden", minHeight: 124 }}
    >
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--leaf)", letterSpacing: 1, textTransform: "uppercase" }}>Next Level · Forest</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1.1, marginTop: 2, color: "var(--ink)" }}>Level {next}</div>
        <div style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 700, marginTop: 4 }}>3 questions · 3 lives · +50 XP</div>
      </div>
      <PixelImg
        src={ASSETS.wally}
        size={136}
        alt=""
        style={{
          flexShrink: 0,
          marginRight: -18,
          marginBottom: -18,
          marginTop: -14,
          // Wally has a quiet life — gentle idle bob every 5s so he feels alive
          // without yanking attention away from the CTA button he's sitting on.
          animation: "waffles-v2-wally-idle 5s ease-in-out infinite",
        }}
      />
      <div aria-hidden="true" style={{ position: "absolute", right: 12, bottom: 12, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 99, background: "var(--leaf)", color: "var(--frame)", boxShadow: "0 3px 0 rgba(255,159,28,.3)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 5l8 7-8 7" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </button>
  );
};

export const HomeScreen = () => {
  const proto = useProto();
  const theme = useTheme();
  const tickets = proto.tickets;
  // Raw accumulated XP — the XpBar animates the fill + level roll-over from this.
  const rawXp = proto.xp;
  const streak = proto.streak;
  const homeSlot = proto.tweaks.homeSlot;

  const unreadResult = proto.resultNotifs.find((r) => !r.read) ?? null;

  // Tournament entry gate. The card and the sticky CTA both route through
  // `openJoin`. If already entered this round, tapping the card views the
  // standing instead.
  const [gate, setGate] = useState<"confirm" | null>(null);
  // Attribution for the next on-chain entry — "home" for a manual tap, flipped
  // to "onboarding" when the gate is auto-opened by the just-onboarded funnel so
  // we can measure onboarding → paying conversion. Set on every gate open.
  const entrySourceRef = useRef<TournamentEntrySource>("home");
  // Guards the one-shot onboarding auto-open so a re-render (the intent flag
  // stays set until the sheet closes) doesn't re-open the gate.
  const joinIntentOpenedRef = useRef(false);
  // On-chain entry: the deposit is paid via the wallet (USDC), so there's no
  // ticket gate — the wallet reports an insufficient balance on confirm.
  const [entering, setEntering] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  // Live, DB-backed details for the hero card (entry fee, close time, title /
  // format / prize). The query retries through the auth-cookie race and brief
  // gap between tournament rounds, then polls so pool and player counts stay live.
  const { data: tourney, isLoading: tournamentLoading } = useHomeTournamentQuery();
  const fee = tourney ? { entryFee: tourney.entryFee, standardFee: tourney.standardFee, firstEntry: tourney.firstEntry, skillBonus: tourney.skillBonus } : null;
  const round: TournamentRound | null = tourney?.round ?? null;
  const now = useNow();
  // "Tickets closing in" counts down on the real game clock: to kickoff
  // (startsAt) while the round is still upcoming, then to the round's end
  // (endsAt) once it's live and entries stay open.
  const startMs = tourney ? new Date(tourney.game.startsAt).getTime() : null;
  const endMs = tourney ? new Date(tourney.game.endsAt).getTime() : null;
  const closeAt = startMs != null && endMs != null ? (startMs > now ? startMs : endMs) : null;
  const remainMs = closeAt ? Math.max(0, closeAt - now) : 0;
  const cd = {
    hrs: String(Math.floor(remainMs / 3_600_000)).padStart(2, "0"),
    min: String(Math.floor((remainMs % 3_600_000) / 60_000)).padStart(2, "0"),
    sec: String(Math.floor((remainMs % 60_000) / 1000)).padStart(2, "0"),
  };
  const confirmEntry = async () => {
    setEntryError(null);
    setEntering(true);
    const res = await proto.enterTournamentOnChain(entrySourceRef.current);
    setEntering(false);
    if (res.ok) {
      setGate(null);
      if (proto.pendingTournamentJoin) proto.update({ pendingTournamentJoin: false });
    } else setEntryError(res.error ?? "Entry failed");
  };
  const openJoin = () => {
    if (!round || !fee) return;
    entrySourceRef.current = "home";
    // Already entered this round (one paid entry per round). If they haven't
    // played yet, resume into the quiz for the entry they already paid for — no
    // second charge. Otherwise just show their standing.
    if (entered) {
      if (!board?.you?.played) {
        trackClientEvent(AnalyticsEvent.TicketCtaClicked, { screen: "home", source: "resume_cta", entry_fee: fee?.entryFee ?? null, first_entry: fee?.firstEntry ?? null });
        void proto.playEnteredTournament();
        return;
      }
      proto.goto("results");
      return;
    }
    trackClientEvent(AnalyticsEvent.TicketCtaClicked, {
      screen: "home",
      source: "join_cta",
      entry_fee: fee?.entryFee ?? null,
      first_entry: fee?.firstEntry ?? null,
    });
    setEntryError(null);
    setGate("confirm");
  };
  const onCardTap = () => {
    if (entered) {
      // Paid but not played → resume into the round; played → view standing.
      if (!board?.you?.played) {
        trackClientEvent(AnalyticsEvent.TicketCtaClicked, { screen: "home", source: "resume_card", entry_fee: fee?.entryFee ?? null, first_entry: fee?.firstEntry ?? null });
        void proto.playEnteredTournament();
        return;
      }
      trackClientEvent(AnalyticsEvent.ViewStandingClicked, {
        screen: "home",
        source: "tournament_card",
        entered_rank: board?.you?.rank ?? null,
      });
      proto.goto("results");
      return;
    }
    openJoin();
  };

  // First-tournament-of-the-day 2× XP bonus. Read via useSyncExternalStore so
  // the client value is picked up post-hydration without a setState-in-effect;
  // the server snapshot is false to stay hydration-safe.
  const bonusAvailable = useSyncExternalStore(() => () => {}, isDailyBonusAvailable, () => false);

  // Personalization hook: returning players are challenged to beat their last
  // finish; first-timers get the "Top 100 win tickets" pitch instead.
  const lastRank = proto.lastTournamentRank;

  // Real entrant count for the current tournament, refreshed with the home query cadence.
  const { data: rawBoard } = useCurrentTournamentBoardQuery();
  const { data: recentBuyers } = useRecentEntrantsQuery(proto.tournamentGameId);
  const board = rawBoard && rawBoard.fieldSize > 0 ? rawBoard : null;
  const entered = board?.you != null;
  const enteredRank = board?.you?.rank ?? null;

  // Onboarding finale funnel: a just-created player lands here with the intent
  // flag set. Once the live round details have loaded, auto-open the buy sheet
  // so the money moment is front and centre (buy-primed). If they somehow
  // already entered, just drop the intent. The flag is left set until the sheet
  // closes so the first-visit takeovers stay suppressed behind it (see Stage).
  useEffect(() => {
    if (!proto.pendingTournamentJoin || joinIntentOpenedRef.current) return;
    if (!round || !fee) return; // wait for the live round query to land
    joinIntentOpenedRef.current = true;
    if (entered) {
      proto.update({ pendingTournamentJoin: false });
      return;
    }
    entrySourceRef.current = "onboarding";
    trackClientEvent(AnalyticsEvent.TicketCtaClicked, {
      screen: "home",
      source: "onboarding",
      entry_fee: fee.entryFee,
      first_entry: fee.firstEntry,
    });
    // rAF so the flip isn't a synchronous setState in the effect body.
    const id = requestAnimationFrame(() => {
      setEntryError(null);
      setGate("confirm");
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proto.pendingTournamentJoin, round, fee, entered]);
  // Paid this round but hasn't played yet → can resume into the quiz (no second
  // charge). Once they've played (or it's settled), it's view-standing only.
  const canResume = entered && !(board?.you?.played ?? false);
  // Real entrant count — board standings first, then the game's stored
  // playerCount. For social proof we keep this real and pair it with today's
  // aggregate activity instead of inflating a sparse hourly round.
  const realEntrants = board && board.fieldSize > 0 ? board.fieldSize : (round?.playerCount ?? 0);
  const fieldSize = realEntrants;

  // "Win up to" headline = the #1 finisher's cut of a guaranteed $10 pool at the
  // projected full field ($4.00), shared with the post-level upsell. Pool-
  // INDEPENDENT so a sparse hourly round doesn't undersell the prize; on-chain
  // settlement always pays the real live pool.
  const prizeTickets = HEADLINE_TOP_PRIZE_TICKETS;
  // Winner count from the same bracket → "Winner takes the pool" vs "Top N split
  // the pool" (replaces the static, almost-always-wrong "Top 100").
  const winnerCount = round?.winnerCount ?? 1;
  const winnersLabel = winnerCount <= 1 ? "Winner takes all" : `Top ${winnerCount} split the pool`;

  // V4 card: the whole prize pool in tickets (not just the top cut) + its USDT
  // peg value, and the capped-field scarcity meter (playerCount / maxPlayers).
  const prizePoolTickets = round ? Math.max(1, Math.round(round.prizePoolUsdc / USDT_PER_TICKET)) : 0;
  const spotsTotal = round?.maxPlayers ?? 0;
  const spotsLeft = Math.max(0, spotsTotal - realEntrants);
  const spotsRatio = spotsTotal > 0 ? Math.min(1, realEntrants / spotsTotal) : 0;
  const spotsCol = spotsRatio >= 0.85 ? "#FC1919" : spotsRatio >= 0.6 ? "#F5A91B" : "var(--leaf)";
  // Real paid participants for the join stack: current round first, then the
  // previous game's entrants if this round has fewer than six buyers.
  const joiners = round?.participantAvatars ?? [];

  // Game-card impression — the Top-of-the-Hour tournament is the home hero, so
  // log that the player saw it (one per mount) with the entry state that drives
  // whether the card reads as "join" vs "view standing".
  const gameSeenRef = useRef(false);
  useEffect(() => {
    if (gameSeenRef.current) return;
    gameSeenRef.current = true;
    trackClientEvent(AnalyticsEvent.GameSeen, {
      screen: "home",
      entered,
      entered_rank: enteredRank,
      field_size: fieldSize,
      bonus_available: bonusAvailable,
      last_rank: lastRank ?? null,
    });
  }, [entered, enteredRank, fieldSize, bonusAvailable, lastRank]);

  return (
    <Phone statusDark>
      {/* v1's speckled backdrop (noise grain over a dark gradient). */}
      <div className="bg-speckle" />

      <TopHeader tickets={tickets} title="WAFFLES" />

      {/* Header bar — wordmark + community follow + announcements bell. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "max(8px, env(safe-area-inset-top)) 16px 0", zIndex: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <img src={ASSETS.logoWordmark} alt={theme.copy.appName} height={22} style={{ height: 22, width: "auto", display: "block", flexShrink: 0 }} />
          <a
            href={TWITTER_FOLLOW_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Follow Waffles on X"
            title="Follow Waffles on X"
            onClick={() => {
              trackClientEvent(AnalyticsEvent.SocialTwitterClicked, {
                component: "home_header",
                destination: "x",
              });
            }}
            style={{ width: 30, height: 30, borderRadius: 99, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <XIcon width={18} height={18} aria-hidden="true" />
          </a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SoundToggle />
          <AnnouncementBell />
        </div>
      </div>

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, bottom: 84, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* First-timer nudge: the free intro tournament (guaranteed win + Syrup,
            no entry fee). Shown only until it's been played (rookieDone). */}
        {!proto.rookieDone && (
          <button
            type="button"
            onClick={() => { void proto.enterRookieCup(); }}
            aria-label="Play your free Rookie Cup — your first tournament, on us"
            style={{ textAlign: "left", background: "radial-gradient(120% 120% at 0% 0%, rgba(255,210,77,.18), rgba(255,210,77,.04))", border: "1px solid rgba(255,210,77,.45)", borderRadius: 18, padding: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 13, position: "relative", overflow: "hidden" }}
          >
            <PixelImg src={ASSETS.trophy} size={46} alt="" style={{ flexShrink: 0, filter: "drop-shadow(0 4px 10px rgba(0,0,0,.35))" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <span style={{ background: "var(--maple-500)", color: "var(--frame)", fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: 0.5, padding: "2px 8px", borderRadius: 99, border: "1.5px solid var(--frame)" }}>FREE</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "#fff" }}>Rookie Cup</span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.6)", lineHeight: 1.35 }}>
                Your first tournament&apos;s on us — answer 6, win Syrup. No entry fee.
              </div>
            </div>
            <div className="btn-3d-gold" style={{ flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 13, color: "#3a2a00", background: "linear-gradient(180deg, #FFD24D, #F5A91B)", borderRadius: 11, padding: "9px 14px" }}>PLAY</div>
          </button>
        )}
        {recentBuyers && recentBuyers.length > 0 && <LiveBuyingStrip entrants={recentBuyers} title={round?.title ?? "the tournament"} />}
        <div
          role="button"
          tabIndex={0}
          data-coach="home-join"
          aria-label={entered ? (canResume ? "Play your tournament round" : "View your tournament standing") : round ? `Join ${round.title} — costs ${TOURNAMENT_TICKET_COST} ticket` : "Live tournament unavailable"}
          onClick={onCardTap}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCardTap();
            }
          }}
          style={{ background: "#0F0F10", borderRadius: 18, padding: 18, position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)", cursor: "pointer" }}
        >
          {/* Status — tickets-closing countdown (digits in the display font) +
              your-entry badge. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: "#FC1919", boxShadow: "0 0 0 4px rgba(252,25,25,.2)", animation: "waffles-v2-pulse 1.5s infinite" }} />
            <div className="chip" style={{ background: "rgba(252,25,25,.15)", color: "#FC1919", padding: "3px 10px", fontSize: 11, border: "1px solid rgba(252,25,25,.3)", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "var(--font-display)" }}>
              {round ? <>TICKETS CLOSING IN <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: 0.5 }}>{cd.hrs !== "00" ? `${cd.hrs}:` : ""}{cd.min}:{cd.sec}</span></> : tournamentLoading ? "LOADING LIVE ROUND" : "LIVE ROUND UNAVAILABLE"}
            </div>
            <div style={{ flex: 1 }} />
            {entered && (
              <div className="chip" style={{ background: "rgba(255,159,28,.14)", color: "var(--leaf)", padding: "3px 9px", fontSize: 11, border: "1px solid rgba(255,159,28,.4)", whiteSpace: "nowrap", flexShrink: 0 }}>YOU&apos;RE IN</div>
            )}
          </div>

          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1.04, color: "#fff" }}>{round?.title ?? (tournamentLoading ? "Loading live round" : "Live round unavailable")}</div>

          {/* Accents — skill cue (always) + first-game 2× XP (conditional). */}
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--leaf)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" /></svg>
              Fastest correct answers win
            </span>
            {bonusAvailable && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--maple-500)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" /></svg>
                2× XP on your first game today
              </span>
            )}
          </div>

          {round && (
            <>
              {/* Prize-pool hero + vertical scarcity gauge (filled / cap). */}
              <div style={{ marginTop: 13, borderRadius: 14, border: "1px solid rgba(255,210,77,.25)", background: "radial-gradient(120% 120% at 0% 0%, rgba(255,210,77,.16), rgba(255,210,77,.04))", padding: "14px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: "var(--maple-500)", textTransform: "uppercase" }}>Prize pool</div>
                  <div style={{ marginTop: 4, display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <TicketIcon size={34} />
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 40, color: "#fff", lineHeight: 0.9 }}>{prizePoolTickets}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.45)", lineHeight: 1 }}>≈ {usdtLabel(prizePoolTickets)}</span>
                  </div>
                </div>
                {spotsTotal > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ width: 9, height: 46, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                      <div style={{ width: "100%", height: `${spotsRatio * 100}%`, borderRadius: 99, background: spotsCol, boxShadow: `0 0 8px ${spotsCol}66` }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: spotsCol, lineHeight: 1 }}>{spotsLeft}</div>
                      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: "rgba(255,255,255,.45)", textTransform: "uppercase", marginTop: 3 }}>spots left</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Joiner PFPs + day's social proof. */}
              <div style={{ marginTop: 13, display: "inline-flex", alignItems: "center", gap: 9 }}>
                {joiners.length > 0 && (
                  <div style={{ display: "flex" }}>
                    {joiners.map((s, idx) => (
                      <PixelImg key={s.userId} src={s.pfpUrl ?? resolveAvatar(s.avatarId, s.userId)} size={26} alt="" style={{ borderRadius: 99, objectFit: "cover", background: "#1c1c1f", border: "2px solid #0F0F10", marginLeft: idx === 0 ? 0 : -9 }} />
                    ))}
                  </div>
                )}
                <span style={{ fontSize: 12.5, fontWeight: 800, color: "rgba(255,255,255,.6)" }}>
                  {round.todayPlayerCount > 0 ? (
                    <>{joiners.length > 0 ? "and " : ""}<span style={{ color: "#fff" }}>{round.todayPlayerCount.toLocaleString()}</span> {joiners.length > 0 ? "others " : ""}joined today</>
                  ) : (
                    "No entries yet today"
                  )}
                </span>
              </div>
            </>
          )}

          {/* CTA — looks like a button but is part of the card's tap (avoids
              nesting interactives); state-aware: resume / view / buy. */}
          <div className="btn-3d-gold" style={{ marginTop: 13, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "linear-gradient(180deg, #FFD24D, #F5A91B)", color: "#3a2a00", borderRadius: 13, padding: "13px", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 0.3, fontSize: 16 }}>
            {entered
              ? (canResume ? "Play your round" : "View standing")
              : round && fee ? (<><TicketIcon size={18} />Join game</>) : tournamentLoading ? "Loading live game..." : "Live game unavailable"}
          </div>
          <div style={{ position: "absolute", right: -30, top: -30, opacity: 0.08, transform: "rotate(15deg)" }}>
            <div className="waffle-mark" style={{ width: 120, height: 120, borderRadius: 24 }} />
          </div>
        </div>

        {(homeSlot === "both" || homeSlot === "continue") && <HomeContinueRun />}
        {(homeSlot === "both" || homeSlot === "missions") && <HomeMissions />}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              trackClientEvent(AnalyticsEvent.StreakButtonClicked, {
                screen: "home",
                streak_days: streak,
              });
              proto.update({ dailyOpen: true });
            }}
            aria-label={`${streak} day streak — open daily reward`}
            style={{ flex: 1, textAlign: "left", background: "#0F0F10", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FlameIcon size={28} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff" }}>{streak}</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>day streak</div>
          </button>
          {/* Pure XP/account level (LVL = total XP / 500); not the campaign level. */}
          <XpBar baseLevel={0} rawXp={rawXp} onOpen={() => proto.goto("levels")} />
        </div>
        </div>
      </div>

      <div className="bottom-bar">
        <TabBar active="home" />
      </div>

      {gate === "confirm" && (
        <JoinConfirmSheet
          fee={fee}
          round={round}
          prizeTickets={prizeTickets}
          winnersLabel={winnersLabel}
          pending={entering}
          stepLabel={proto.tournamentStep ? txStepLabel(proto.tournamentStep) : null}
          error={entryError}
          onClose={() => {
            setGate(null);
            if (proto.pendingTournamentJoin) proto.update({ pendingTournamentJoin: false });
          }}
          onConfirm={() => void confirmEntry()}
        />
      )}
      {/* In-app result notification — surfaced on return after a round settles.
          Covers every outcome (won / near-miss / placed), not just wins. */}
      {unreadResult && (
        <Sheet onClose={() => proto.markResultRead(unreadResult.id)} ariaLabel="Tournament result" zIndex={70}>
          {(close) => {
            const r = unreadResult;
            const won = r.reward > 0;
            const missed = TOURNAMENT_PRIZES.filter((t) => t.maxRank < r.rank).sort((a, b) => b.maxRank - a.maxRank)[0];
            const gap = missed ? r.rank - missed.maxRank : 0;
            const nearMiss = !won && !!missed && gap > 0 && gap <= 12;
            return (
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                  <PixelImg src={won ? ASSETS.trophy : ASSETS.wally} size={64} alt="" />
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)" }}>
                  {won ? "You won!" : nearMiss ? "So close!" : "Round closed"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", marginTop: 6, marginBottom: 16 }}>
                  {won ? (
                    <>You placed <b style={{ color: "var(--maple-500)" }}>#{r.rank}</b> — won {r.reward} ticket{r.reward === 1 ? "" : "s"} ({usdtLabel(r.reward)}).</>
                  ) : nearMiss ? (
                    <>You finished #{r.rank} — just {gap} spot{gap === 1 ? "" : "s"} from {missed.label}. Run it back?</>
                  ) : (
                    <>You finished #{r.rank} of {fieldSize.toLocaleString()}.</>
                  )}
                </div>
                {won ? (
                  <button type="button" className="cta maple" style={{ width: "100%" }} onClick={() => { proto.markResultRead(r.id); close(); proto.goto("profile"); }}>CLAIM IN PRIZE WALLET</button>
                ) : (
                  <button type="button" className="cta maple" style={{ width: "100%" }} onClick={() => { proto.markResultRead(r.id); close(); openJoin(); }}>PLAY NEXT ROUND</button>
                )}
                <button type="button" onClick={() => { proto.markResultRead(r.id); close(); }} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: "var(--ink-faint)", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 6 }}>
                  Dismiss
                </button>
              </div>
            );
          }}
        </Sheet>
      )}
    </Phone>
  );
};
