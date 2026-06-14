"use client";

import { useEffect, useState } from "react";
import {
  FIRST_TICKET_DISCOUNT,
  isDailyBonusAvailable,
  isFirstTicketOfferAvailable,
  levelTicketMilestoneInfo,
  LIVES_MAX,
  LIVES_REFILL_COST,
  markFirstTicketOfferUsed,
  TOURNAMENT_FIELD_SIZE,
  TOURNAMENT_TICKET_COST,
  TOURNAMENT_TOP_PRIZE,
  tournamentRank,
  usdtLabel,
  useProto,
} from "../state";
import { ASSETS, Confetti, Phone, PixelImg, Sheet, TicketIcon, useNow } from "../shared";
import { playSound } from "../sound";

// One-time tournament upsell, shown the first time a player clears a level —
// the highest-intent moment to convert a warmed-up free player into the paid,
// prize-bearing live loop. Tracked in localStorage so it only fires once.
const TOURNAMENT_UPSELL_KEY = "waffles.v2.tournamentUpsellSeen";
const hasSeenTournamentUpsell = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(TOURNAMENT_UPSELL_KEY) === "1";
  } catch {
    return true;
  }
};
const markTournamentUpsellSeen = (): void => {
  try {
    localStorage.setItem(TOURNAMENT_UPSELL_KEY, "1");
  } catch {
    /* storage disabled — it'll just show again next session */
  }
};

const TournamentUpsellSheet = ({ score, total, onClose }: { score: number; total: number; onClose: () => void }) => {
  const proto = useProto();
  // Flatter-but-fair "you'd have placed Top X%" hook from the level score.
  const rank = tournamentRank(score, total);
  const pct = Math.max(1, Math.min(99, Math.round((rank / TOURNAMENT_FIELD_SIZE) * 100)));
  const bonus = isDailyBonusAvailable();
  const offer = isFirstTicketOfferAvailable();
  const fullPrice = usdtLabel(TOURNAMENT_TICKET_COST);
  const discountPrice = usdtLabel(TOURNAMENT_TICKET_COST * (1 - FIRST_TICKET_DISCOUNT));

  const enter = () => {
    onClose();
    if (offer) {
      // First-timer: "buy" the half-price entry ticket (prototype — no real
      // charge), then drop straight into the tournament that spends it.
      markFirstTicketOfferUsed();
      proto.update((s) => ({ tickets: s.tickets + TOURNAMENT_TICKET_COST }));
      proto.startTournament();
      return;
    }
    if (proto.tickets >= TOURNAMENT_TICKET_COST) proto.startTournament();
    else proto.goto("shop");
  };

  return (
    <Sheet onClose={onClose} ariaLabel="Enter a live tournament" zIndex={70}>
      {(close) => (
      <>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <PixelImg src={ASSETS.trophy} size={60} alt="" />
        </div>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)" }}>Ready for the real thing?</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", marginTop: 4 }}>
            That run would&apos;ve placed you <span style={{ color: "var(--leaf)" }}>Top {pct}%</span> in a live round.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 12, fontWeight: 800, margin: "12px 0" }}>
          <span style={{ color: "var(--ink-soft)" }}>{TOURNAMENT_FIELD_SIZE.toLocaleString()} playing now</span>
          <span style={{ color: "var(--ink-faint)" }}>·</span>
          <span style={{ color: "var(--maple-500)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            Win up to <TicketIcon size={13} />{TOURNAMENT_TOP_PRIZE}
          </span>
        </div>

        {/* First-timer discounted-ticket offer. You need 1 ticket to enter; the
            first one is half price. */}
        {offer && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,201,49,0.10)", border: "1.5px solid var(--maple-500)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <TicketIcon size={28} />
              <div style={{ position: "absolute", top: -10, right: -16, background: "var(--live-red)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 9, padding: "2px 6px", borderRadius: 99, border: "1.5px solid var(--frame)" }}>-50%</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 1, textTransform: "uppercase" }}>First-timer offer</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", marginTop: 2 }}>Your first ticket, half price</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textDecoration: "line-through" }}>{fullPrice}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--leaf)" }}>{discountPrice}</div>
            </div>
          </div>
        )}

        {bonus && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span className="chip" style={{ background: "rgba(0,207,242,.14)", color: "var(--leaf)", padding: "4px 10px", fontSize: 11, border: "1px solid rgba(0,207,242,.35)" }}>⚡ Your first tournament today earns 2× XP</span>
          </div>
        )}

        <button type="button" className="cta maple" onClick={enter} style={{ width: "100%", marginBottom: 6 }}>
          {offer ? `BUY TICKET & PLAY · ${discountPrice}` : "ENTER LIVE TOURNAMENT"}
        </button>
        {offer && (
          <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--ink-faint)", marginBottom: 4 }}>Prototype — no real charge</div>
        )}
        <button type="button" onClick={close} style={{ width: "100%", background: "transparent", border: "none", color: "var(--ink-faint)", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 6 }}>
          Keep practicing
        </button>
      </>
      )}
    </Sheet>
  );
};

export const LevelWinScreen = () => {
  const proto = useProto();
  const score = proto.score;
  const total = proto.totalQuestions;
  const heartsLeft = proto.hearts;

  // Victory fanfare on arrival.
  useEffect(() => {
    playSound("victory");
  }, []);

  // After the win celebration plays, slide up the one-time tournament upsell.
  const [showUpsell, setShowUpsell] = useState(false);
  useEffect(() => {
    if (hasSeenTournamentUpsell()) return;
    const t = setTimeout(() => {
      markTournamentUpsellSeen();
      setShowUpsell(true);
    }, 1600);
    return () => clearTimeout(t);
  }, []);
  // Bind progress copy to the actual current level instead of a hard-coded
  // "Level 18 → 19". `proto.level` represents the level the player JUST
  // completed (and is about to advance from on this success screen).
  const justCompleted = proto.level;
  const next = justCompleted + 1;

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      {/* Opening gold flash — quick wash that punctuates the moment of victory. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.9), transparent 70%)", zIndex: 60, pointerEvents: "none", animation: "waffles-v2-lvl-flash .7s ease-out forwards" }} />
      <Confetti pieces={48} />
      <div style={{ position: "absolute", top: -60, left: -40, right: -40, height: 380, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.3), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 400, backgroundImage: "radial-gradient(circle, #FFC931 2px, transparent 2.5px), radial-gradient(circle, #FB72FF 2px, transparent 2.5px), radial-gradient(circle, #00CFF2 2px, transparent 2.5px)", backgroundSize: "80px 80px, 100px 100px, 70px 70px", backgroundPosition: "0 0, 30px 40px, 50px 20px", opacity: 0.6 }} />

      {/* Rotating sunburst + one-shot shockwave bloom behind the trophy. */}
      <div aria-hidden style={{ position: "absolute", top: 150, left: "50%", transform: "translateX(-50%)", width: 280, height: 280, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, animation: "waffles-v2-lvl-rays-in .5s ease-out .15s both, waffles-v2-lvl-rays-spin 18s linear .15s infinite", background: "repeating-conic-gradient(from 0deg, rgba(255,201,49,.22) 0deg 7deg, transparent 7deg 22deg)", borderRadius: "50%", WebkitMaskImage: "radial-gradient(circle, transparent 24%, #000 38%, #000 60%, transparent 75%)", maskImage: "radial-gradient(circle, transparent 24%, #000 38%, #000 60%, transparent 75%)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 120, height: 120, borderRadius: "50%", border: "2px solid rgba(255,201,49,.6)", animation: "waffles-v2-lvl-shock .7s cubic-bezier(0.22,1,0.36,1) .15s forwards" }} />
      </div>

      <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: "rgba(255,255,255,.5)", animation: "waffles-v2-lvl-rise .4s ease-out both" }}>LEVEL CLEARED</div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", animation: "waffles-v2-lvl-trophy-in .65s cubic-bezier(0.34,1.56,0.64,1) .15s both" }}>
          <div style={{ filter: "drop-shadow(0 0 28px rgba(255,201,49,.5))", animation: "waffles-v2-lvl-trophy-float 3.2s ease-in-out .9s infinite" }}>
            <PixelImg src={ASSETS.trophy} size={92} alt="trophy" />
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 38, marginTop: 8, color: "#FFC931", animation: "waffles-v2-lvl-pop .5s cubic-bezier(0.34,1.56,0.64,1) .5s both", textShadow: "0 0 24px rgba(255,201,49,.45)" }}>LEVEL UP!</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff", marginTop: 2, display: "inline-flex", alignItems: "baseline", justifyContent: "center", gap: 8, perspective: 500 }}>
          <span style={{ animation: "waffles-v2-lvl-rise .4s ease-out .6s both" }}>Level {justCompleted}</span>
          <span style={{ color: "rgba(255,255,255,.5)", animation: "waffles-v2-lvl-rise .4s ease-out .68s both" }}>→</span>
          <span style={{ position: "relative", display: "inline-block", color: "#FFC931", fontWeight: 800, transformOrigin: "center bottom", animation: "waffles-v2-lvl-num-flip .55s cubic-bezier(0.34,1.56,0.64,1) .76s both" }}>
            {/* one-shot glow that blooms behind the new number as it flips in */}
            <span aria-hidden style={{ position: "absolute", inset: "-8px -10px", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,201,49,.6), transparent 70%)", zIndex: -1, animation: "waffles-v2-lvl-num-glow .7s ease-out .76s both" }} />
            {next}
          </span>
        </div>
      </div>

      <div style={{ position: "absolute", top: 330, left: 18, right: 18, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "14px 8px", textAlign: "center", animation: "waffles-v2-lvl-rise .45s cubic-bezier(0.22,1,0.36,1) .95s both" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#FFC931", lineHeight: 1 }}>+{score}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.5)", marginTop: 4, letterSpacing: 0.6 }}>XP EARNED</div>
        </div>
        <div style={{ flex: 1, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "14px 8px", textAlign: "center", animation: "waffles-v2-lvl-rise .45s cubic-bezier(0.22,1,0.36,1) 1.05s both" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
            {[1, 2, 3].map((h) => (
              <PixelImg key={h} src={h <= heartsLeft ? ASSETS.heartFull : ASSETS.heartEmpty} size={22} alt="heart" />
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.5)", marginTop: 4, letterSpacing: 0.6 }}>HEARTS LEFT</div>
        </div>
      </div>

      {/* Free-ticket milestone — a widening curve (rarer the higher you climb).
          Celebrates the just-earned ticket on a milestone level, otherwise shows
          progress to the next one. */}
      {(() => {
        const info = levelTicketMilestoneInfo(justCompleted);
        return (
          <div style={{ position: "absolute", top: 430, left: 18, right: 18, background: info.earned ? "rgba(0,207,242,.16)" : "rgba(0,207,242,.1)", border: `1px solid rgba(0,207,242,${info.earned ? ".4" : ".25"})`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, animation: "waffles-v2-lvl-rise .45s cubic-bezier(0.22,1,0.36,1) 1.15s both" }}>
            <TicketIcon size={26} color="#fff" />
            {info.earned ? (
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", lineHeight: 1 }}>+1 free ticket earned!</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Next one at Level {info.nextLevel}</div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", lineHeight: 1 }}>Free ticket at Level {info.nextLevel}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{info.toGo} level{info.toGo === 1 ? "" : "s"} to go</div>
                </div>
                <div style={{ height: 6, width: 60, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                  <div style={{ width: `${info.pct}%`, height: "100%", background: "#FFC931", borderRadius: 99 }} />
                </div>
              </>
            )}
          </div>
        );
      })()}

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta icon-btn" aria-label="Back to home" onClick={() => proto.goto("home")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12l9-8 9 8v8a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" /></svg>
          </button>
          <button className="cta maple" onClick={() => proto.goto("levels")}>NEXT LEVEL</button>
        </div>
      </div>

      {showUpsell && (
        <TournamentUpsellSheet score={score} total={total} onClose={() => setShowUpsell(false)} />
      )}
    </Phone>
  );
};

export const LevelFailScreen = () => {
  const proto = useProto();
  useEffect(() => {
    playSound("defeat");
  }, []);
  // Lives gate the retry loop. proto.lives / proto.nextLifeAt are kept current by
  // the provider's 1s regen tick, so this countdown re-renders on its own.
  const outOfLives = proto.lives <= 0;
  const now = useNow(proto.lives < LIVES_MAX);
  const nextMs = proto.nextLifeAt ? Math.max(0, proto.nextLifeAt - now) : 0;
  const nextLifeIn = `${String(Math.floor(nextMs / 60000)).padStart(2, "0")}:${String(Math.floor((nextMs % 60000) / 1000)).padStart(2, "0")}`;
  const canRefill = proto.tickets >= LIVES_REFILL_COST;
  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div style={{ position: "absolute", top: -60, left: -40, right: -40, height: 380, background: "radial-gradient(ellipse at center top, rgba(252,25,25,.25), transparent 60%)" }} />

      <div style={{ position: "absolute", top: 88, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: "rgba(255,255,255,.5)" }}>LEVEL FAILED</div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", filter: "drop-shadow(0 0 24px rgba(252,25,25,.4))" }}>
          <PixelImg src={ASSETS.heartBroken} size={92} alt="failed" />
        </div>
        <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 34, marginTop: 10, color: "#FC1919" }}>OUT OF HEARTS</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.55)", marginTop: 6, padding: "0 32px" }}>
          {outOfLives ? "You're out of lives. Refill, or wait for one to come back." : "That cost you a life — your progress is saved."}
        </div>
      </div>

      <div style={{ position: "absolute", top: 380, left: 18, right: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 1, textTransform: "uppercase" }}>Lives</div>
        <div style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: LIVES_MAX }).map((_, i) => (
            <PixelImg key={i} src={i < proto.lives ? ASSETS.heartFull : ASSETS.heartEmpty} size={28} alt="" />
          ))}
        </div>
        {proto.lives < LIVES_MAX && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.5)", fontVariantNumeric: "tabular-nums" }}>Next life in {nextLifeIn}</div>
        )}
      </div>

      <div style={{ position: "absolute", top: 460, left: 18, right: 18, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "12px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 1, textTransform: "uppercase" }}>Tip</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginTop: 4, lineHeight: 1.35 }}>Read the question fully — the timer is forgiving on level mode.</div>
      </div>

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta icon-btn" aria-label="Back to level path" onClick={() => proto.goto("levels", { back: true })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {outOfLives ? (
            <button className="cta maple" onClick={() => proto.refillLives()} disabled={!canRefill} style={!canRefill ? { opacity: 0.55, cursor: "default" } : undefined} aria-label={`Refill lives for ${LIVES_REFILL_COST} ticket`}>
              REFILL <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><TicketIcon size={14} />{LIVES_REFILL_COST}</span>
            </button>
          ) : (
            <button className="cta" onClick={() => proto.retryLevel()}>RETRY</button>
          )}
        </div>
      </div>
    </Phone>
  );
};
