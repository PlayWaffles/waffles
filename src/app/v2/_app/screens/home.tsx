"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FIRST_TICKET_DISCOUNT, isDailyBonusAvailable, isFirstTicketOfferAvailable, markFirstTicketOfferUsed, roundCloseAt, roundIdFor, tournamentRank, TOURNAMENT_FIELD_SIZE, TOURNAMENT_PRIZES, TOURNAMENT_TICKET_COST, TOURNAMENT_TOP_PRIZE, usdtLabel, useProto } from "../state";
import { ASSETS, Button, FlameIcon, Phone, PixelImg, Sheet, SoundToggle, TabBar, TicketIcon, TopHeader, useNow } from "../shared";
import { AnnouncementBell } from "../announcements";
import { useTheme } from "../theme";

const XP_PER_LEVEL = 500;

// Home XP bar. Animates the fill on mount and ROLLS OVER into the next level when
// raw XP is past the threshold: fills to 100%, the level number flips with a pop,
// then keeps filling to the remainder — repeating once per level gained. Driven
// by one animated `progress` value (0 → rawXp); width is set per-frame with no
// CSS transition, so each wrap reads as a clean reset rather than draining back.
const XpBar = ({ baseLevel, rawXp, onOpen }: { baseLevel: number; rawXp: number; onOpen: () => void }) => {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const levels = Math.floor(rawXp / XP_PER_LEVEL);
    const dur = reduce ? 0 : Math.min(2600, 800 + levels * 650);
    startRef.current = null;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = dur === 0 ? 1 : Math.min(1, (t - startRef.current) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(rawXp * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rawXp]);

  const level = baseLevel + Math.floor(progress / XP_PER_LEVEL);
  const into = Math.floor(progress % XP_PER_LEVEL);
  const pct = ((progress % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;

  return (
    <button
      type="button"
      className="pressable"
      onClick={onOpen}
      aria-label={`Level ${baseLevel + Math.floor(rawXp / XP_PER_LEVEL)}, ${rawXp % XP_PER_LEVEL} of ${XP_PER_LEVEL} XP — open levels`}
      style={{ flex: 1.4, background: "var(--surface-1)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "10px 14px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        {/* keyed on level so the number re-pops each time it rolls over */}
        <span key={level} style={{ fontSize: 10, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 0.8, textTransform: "uppercase", display: "inline-block", animation: "waffles-v2-lvl-pop .4s var(--ease-out-quart)" }}>Lvl {level}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--maple-500)", fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}>{into}/{XP_PER_LEVEL} XP</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.05)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--maple-500), var(--maple-400))", borderRadius: 99 }} />
      </div>
    </button>
  );
};

// ===== Tournament entry gate ==================================================
// Joining a live tournament costs a ticket. Tapping JOIN opens one of two
// bottom sheets: a confirm sheet when the player can pay, or an out-of-tickets
// sheet (with both the free earn-by-playing route and a buy route) when they
// can't. Both share the shop's sheet visual language.

const JoinConfirmSheet = ({ tickets, onClose, onConfirm }: { tickets: number; onClose: () => void; onConfirm: () => void }) => (
    <Sheet onClose={onClose} ariaLabel="Enter the Top of the Hour tournament">
      {(close) => (
      <>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(255,201,49,.16)", border: "1.5px solid rgba(255,201,49,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TicketIcon size={34} />
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)" }}>Enter tournament?</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginTop: 4 }}>Top of the Hour · Mixed · 6 Q</div>
        <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: "var(--maple-500)" }}>
          Finish Top 100 to win up to <TicketIcon size={14} />{TOURNAMENT_TOP_PRIZE}
        </div>
      </div>

      <div style={{ background: "var(--surface-2)", border: "1px solid rgba(253,251,246,0.06)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", letterSpacing: 0.4, textTransform: "uppercase" }}>Entry · you have {tickets}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--maple-500)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <TicketIcon size={18} />
          {TOURNAMENT_TICKET_COST} ticket{TOURNAMENT_TICKET_COST === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="ghost" flex={1} onClick={close}>CANCEL</Button>
        <Button flex={1.4} onClick={onConfirm} ariaLabel={`Join for ${TOURNAMENT_TICKET_COST} ticket`}>
          JOIN — <TicketIcon size={14} />{TOURNAMENT_TICKET_COST}
        </Button>
      </div>
      </>
      )}
    </Sheet>
);

const OutOfTicketsSheet = ({ offer, onClose, onEarn, onBuy, onFirstTicket }: { offer: boolean; onClose: () => void; onEarn: () => void; onBuy: () => void; onFirstTicket: () => void }) => {
  const fullPrice = usdtLabel(TOURNAMENT_TICKET_COST);
  const discountPrice = usdtLabel(TOURNAMENT_TICKET_COST * (1 - FIRST_TICKET_DISCOUNT));
  return (
      <Sheet onClose={onClose} ariaLabel={offer ? "Get your first ticket" : "Out of tickets"}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,201,49,.12)", border: "1px solid rgba(255,201,49,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TicketIcon size={28} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)" }}>{offer ? "Get your first ticket" : "Out of tickets"}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginTop: 4 }}>
            {offer ? "Half price for first-timers — jump into a live round" : `You need ${TOURNAMENT_TICKET_COST} to enter a tournament`}
          </div>
        </div>

        {offer ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,201,49,0.10)", border: "1.5px solid var(--maple-500)", borderRadius: 14, padding: "14px", marginBottom: 14 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <TicketIcon size={26} />
              <div style={{ position: "absolute", top: -10, right: -16, background: "var(--live-red)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 9, padding: "2px 6px", borderRadius: 99, border: "1.5px solid var(--frame)" }}>-50%</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 1, textTransform: "uppercase" }}>First-timer offer</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", marginTop: 2 }}>1 ticket = 1 entry</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textDecoration: "line-through" }}>{fullPrice}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--leaf)" }}>{discountPrice}</div>
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--surface-2)", border: "1.5px solid var(--maple-500)", borderRadius: 14, padding: "14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 12, background: "rgba(255,201,49,0.18)", border: "1px solid rgba(255,201,49,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <TicketIcon size={22} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ink)" }}>5</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 1, textTransform: "uppercase" }}>Quick top up</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", marginTop: 2 }}>5 tickets · $0.99</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-soft)", marginTop: 2 }}>Or win Top 100 in a round</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" flex={1} onClick={onEarn}>EARN BY PLAYING</Button>
          <Button flex={1.4} onClick={offer ? onFirstTicket : onBuy}>
            {offer ? `BUY & PLAY · ${discountPrice}` : "BUY"}
          </Button>
        </div>
        {offer && (
          <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--ink-faint)", marginTop: 8 }}>Prototype — no real charge</div>
        )}
      </Sheet>
  );
};

const HomeMissions = () => {
  const proto = useProto();
  const missions = [
    { label: "Earn 50 XP", cur: 32, tgt: 50, reward: "+10 XP", icon: "xp" },
    { label: "Win a round", cur: 0, tgt: 1, reward: "+1 🎟", icon: "win" },
    { label: "Play 2 games", cur: 1, tgt: 2, reward: "+25 XP", icon: "play" },
  ];
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
        <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 0.8 }}>RESETS IN 6h 17m</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {missions.map((m, i) => {
          const pct = Math.min(100, Math.round((m.cur / m.tgt) * 100));
          const done = m.cur >= m.tgt;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: done ? "rgba(0,207,242,.15)" : "rgba(255,255,255,.04)", border: `1px solid ${done ? "rgba(0,207,242,.4)" : "rgba(255,255,255,.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: done ? "#00CFF2" : "rgba(255,255,255,.4)", flexShrink: 0 }}>
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
                  <span style={{ fontSize: 10, fontWeight: 800, color: done ? "#00CFF2" : "rgba(255,255,255,.5)", fontFamily: "var(--font-display)" }}>{m.cur}/{m.tgt}</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,.05)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: done ? "linear-gradient(90deg,#00CFF2,#5DDDF0)" : "linear-gradient(90deg, #FFC931, #F5BB1B)", transition: "width .4s" }} />
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: done ? "#00CFF2" : "rgba(255,255,255,.55)", letterSpacing: 0.4, minWidth: 40, textAlign: "right" }}>{m.reward}</div>
            </div>
          );
        })}
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
      style={{ width: "100%", background: "linear-gradient(135deg, #1a2a1a 0%, var(--surface-1) 60%)", border: "1px solid rgba(0,207,242,.2)", borderRadius: 16, padding: "12px 14px", display: "flex", gap: 8, alignItems: "center", position: "relative", overflow: "hidden", minHeight: 124 }}
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
      <div aria-hidden="true" style={{ position: "absolute", right: 12, bottom: 12, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 99, background: "var(--leaf)", color: "var(--frame)", boxShadow: "0 3px 0 rgba(0,207,242,.3)" }}>
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

  // Hourly round state: are we already entered in the *current* round (one entry
  // per round), and is there an unread settlement result to surface?
  const nowMs = useNow();
  const entered = !!proto.entry && proto.entry.roundId === roundIdFor(nowMs) && !proto.entry.settled;
  const enteredRank = entered && proto.entry?.score != null ? tournamentRank(proto.entry.score, proto.totalQuestions) : null;
  const enteredCloseMs = entered && proto.entry ? Math.max(0, roundCloseAt(proto.entry.roundId) - nowMs) : 0;
  const enteredCloseIn = `${String(Math.floor(enteredCloseMs / 60000)).padStart(2, "0")}:${String(Math.floor((enteredCloseMs % 60000) / 1000)).padStart(2, "0")}`;
  const unreadResult = proto.resultNotifs.find((r) => !r.read) ?? null;

  // Tournament entry gate: confirm when affordable, otherwise prompt to earn
  // or buy. The card and the sticky CTA both route through `openJoin`. If already
  // entered this round, tapping the card views the standing instead.
  const [gate, setGate] = useState<"confirm" | "shortfall" | null>(null);
  const openJoin = () => setGate(tickets >= TOURNAMENT_TICKET_COST ? "confirm" : "shortfall");
  const onCardTap = () => (entered ? proto.goto("results") : openJoin());

  // First-timer half-price ticket offer (client-read, hydration-safe).
  const firstTicketOffer = useSyncExternalStore(() => () => {}, isFirstTicketOfferAvailable, () => false);
  const buyFirstTicketAndPlay = () => {
    setGate(null);
    markFirstTicketOfferUsed();
    // "Buy" the half-price entry ticket (prototype — no real charge), then enter.
    proto.update((s) => ({ tickets: s.tickets + TOURNAMENT_TICKET_COST }));
    proto.startTournament();
  };

  // First-tournament-of-the-day 2× XP bonus. Read via useSyncExternalStore so
  // the client value is picked up post-hydration without a setState-in-effect;
  // the server snapshot is false to stay hydration-safe.
  const bonusAvailable = useSyncExternalStore(() => () => {}, isDailyBonusAvailable, () => false);

  // Personalization hook: returning players are challenged to beat their last
  // finish; first-timers get the "Top 100 win tickets" pitch instead.
  const lastRank = proto.lastTournamentRank;
  const lastPct = lastRank ? Math.max(1, Math.round((lastRank / TOURNAMENT_FIELD_SIZE) * 100)) : null;

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      {/* Tilted oversized waffle wordmark watermark — replaces the generic radial glow on this screen. */}
      <div aria-hidden="true" style={{ position: "absolute", top: 26, left: -10, right: -10, fontFamily: "var(--font-display)", fontSize: 110, color: "var(--maple-500)", opacity: 0.04, letterSpacing: 4, transform: "rotate(-6deg)", textAlign: "center", pointerEvents: "none", whiteSpace: "nowrap" }}>WAFFLES</div>

      <TopHeader tickets={tickets} title="WAFFLES" />

      {/* Header bar — wordmark + announcements bell (the bell's natural home). */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "max(8px, env(safe-area-inset-top)) 16px 0", zIndex: 14 }}>
        <img src={ASSETS.logoWordmark} alt={theme.copy.appName} height={22} style={{ height: 22, width: "auto", display: "block" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SoundToggle />
          <AnnouncementBell />
        </div>
      </div>

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, bottom: 140, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          role="button"
          tabIndex={0}
          aria-label={entered ? "View your tournament standing" : `Join the Top of the Hour tournament — costs ${TOURNAMENT_TICKET_COST} ticket`}
          onClick={onCardTap}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCardTap();
            }
          }}
          style={{ background: "#0F0F10", borderRadius: 18, padding: 18, position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)", cursor: "pointer" }}
        >
          {/* Two essential chips only — live status (left) and entry cost (right),
              both nowrap so they never break onto a second line. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: "#FC1919", boxShadow: "0 0 0 4px rgba(252,25,25,.2)", animation: "waffles-v2-pulse 1.5s infinite" }} />
            <div className="chip" style={{ background: "rgba(252,25,25,.15)", color: "#FC1919", padding: "3px 10px", fontSize: 11, border: "1px solid rgba(252,25,25,.3)", whiteSpace: "nowrap", flexShrink: 0 }}>{theme.copy.liveBadge}</div>
            <div style={{ flex: 1 }} />
            {entered ? (
              <div className="chip" style={{ background: "rgba(0,207,242,.14)", color: "var(--leaf)", padding: "3px 9px", fontSize: 11, border: "1px solid rgba(0,207,242,.4)", whiteSpace: "nowrap", flexShrink: 0 }}>YOU&apos;RE IN</div>
            ) : (
              <div className="chip" style={{ background: "rgba(255,201,49,.12)", color: "var(--maple-500)", padding: "3px 9px", fontSize: 11, border: "1px solid rgba(255,201,49,.3)", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
                <TicketIcon size={12} />{TOURNAMENT_TICKET_COST} TO ENTER
              </div>
            )}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 25, lineHeight: 1.05, color: "#fff" }}>{theme.copy.liveTitle}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", fontWeight: 600, marginTop: 2 }}>{theme.copy.liveTagline}</div>

          {/* Accent lines: the personal "beat your last finish" hook, plus the
              conditional 2× XP first-game bonus (relocated off the chip row). */}
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--leaf)", fontVariantNumeric: "tabular-nums" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M4 12a8 8 0 1 1 2.3 5.6M4 12V7m0 5h5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {entered
                ? `${enteredRank != null ? `Currently #${enteredRank} · ` : ""}Locks in ${enteredCloseIn} — tap to view`
                : lastPct != null ? `You placed Top ${lastPct}% last hour — beat it` : "Your first tournament — Top 100 win tickets"}
            </div>
            {bonusAvailable && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--maple-500)" }}>
                <span style={{ flexShrink: 0 }}>⚡</span>
                2× XP on your first game today
              </div>
            )}
          </div>

          <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 6 }}>
            {[["00", "HRS"], ["17", "MIN"], ["42", "SEC"]].map(([v, l], i, a) => (
              <Fragment key={l}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: 46, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 21, color: "#F5BB1B", background: "linear-gradient(180deg, rgba(245,187,27,0.1), rgba(245,187,27,0.04))", border: "1px solid rgba(245,187,27,0.15)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,.25)", letterSpacing: 1.5 }}>{l}</div>
                </div>
                {i < a.length - 1 && <span style={{ color: "rgba(255,255,255,.2)", fontSize: 18, marginTop: -12 }}>:</span>}
              </Fragment>
            ))}
            <div style={{ flex: 1 }} />
            {/* Prize hook — what you're playing for, set against the 🎟1 entry. */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "var(--maple-500)" }}>WIN UP TO</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 23, color: "#fff", display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1.1 }}>
                <TicketIcon size={18} />{TOURNAMENT_TOP_PRIZE}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)" }}>≈ {usdtLabel(TOURNAMENT_TOP_PRIZE)} · {TOURNAMENT_FIELD_SIZE.toLocaleString()} in</div>
            </div>
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
            onClick={() => proto.update({ dailyOpen: true })}
            aria-label={`${streak} day streak — open daily reward`}
            style={{ flex: 1, textAlign: "left", background: "#0F0F10", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FlameIcon size={28} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff" }}>{streak}</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>day streak</div>
          </button>
          <XpBar baseLevel={proto.level} rawXp={rawXp} onOpen={() => proto.goto("levels")} />
        </div>
        </div>
      </div>

      <div className="cta-row sticky">
        <button className="cta" data-coach="home-join" onClick={openJoin} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          JOIN NEXT TOURNAMENT
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, opacity: 0.85 }}><TicketIcon size={15} color="currentColor" />{TOURNAMENT_TICKET_COST}</span>
        </button>
      </div>
      <div className="bottom-bar">
        <TabBar active="home" />
      </div>

      {gate === "confirm" && (
        <JoinConfirmSheet
          tickets={tickets}
          onClose={() => setGate(null)}
          onConfirm={() => {
            setGate(null);
            proto.startTournament();
          }}
        />
      )}
      {gate === "shortfall" && (
        <OutOfTicketsSheet
          offer={firstTicketOffer}
          onClose={() => setGate(null)}
          onEarn={() => {
            setGate(null);
            proto.goto("levels");
          }}
          onBuy={() => {
            setGate(null);
            proto.goto("shop");
          }}
          onFirstTicket={buyFirstTicketAndPlay}
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
                    <>You finished #{r.rank} of {TOURNAMENT_FIELD_SIZE.toLocaleString()}.</>
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
