"use client";

import { useEffect, useState } from "react";
import { usdtLabel, USDT_PER_TICKET, useProto, type Winning } from "../state";
import { ASSETS, AssetWell, CATEGORY_COLORS, CategoryIcon, InfoButton, Phone, PixelImg, TabBar, TicketIcon, TopHeader } from "../shared";
import { BADGES, badgeProgress, deriveBadgeStats, isBadgeEarned, type Badge, type BadgeStats } from "../data/badges";
import { LegalSheet, type LegalTab } from "../legal";

const TICKET_INFO = `Tickets are the in-app currency — each is worth ${USDT_PER_TICKET} USDT. Spend them on tournament entries, power-ups and cosmetics. Prizes you win in tournaments are paid in USDT and can be claimed from your Prize Wallet below.`;

const timeAgo = (ts: number) => {
  const h = Math.round((Date.now() - ts) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

// One badge in the profile grid. Earned = full-colour coin with an accent ring +
// glow and a check; locked = greyed icon with a progress arc showing how close
// the player is to unlocking it.
const BadgeCoin = ({ badge, stats, onClick }: { badge: Badge; stats: BadgeStats; onClick: () => void }) => {
  const earned = isBadgeEarned(badge, stats);
  const pct = badgeProgress(badge, stats);
  const size = 56;
  const r = 25;
  const circ = 2 * Math.PI * r;
  return (
    <button
      type="button"
      className="pressable"
      onClick={onClick}
      aria-label={`${badge.name} — ${earned ? "earned" : `${Math.round(pct * 100)}% complete`}`}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
          {!earned && pct > 0 && (
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={badge.accent} strokeWidth="3" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" />
          )}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: earned ? `radial-gradient(circle at 35% 25%, ${badge.accent}40, transparent 62%), #15151a` : "#141416",
            border: `2px solid ${earned ? badge.accent : "rgba(255,255,255,.08)"}`,
            boxShadow: earned ? `0 0 14px ${badge.accent}55` : "none",
          }}
        >
          <PixelImg src={badge.icon} size={28} alt="" style={{ filter: earned ? undefined : "grayscale(1) brightness(.55)", opacity: earned ? 1 : 0.6 }} />
        </div>
        {earned && (
          <div style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, borderRadius: 99, background: "var(--leaf)", color: "var(--frame)", display: "grid", placeItems: "center", fontSize: 10, fontFamily: "var(--font-display)", border: "2px solid #0F0F10" }}>✓</div>
        )}
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color: earned ? "#fff" : "rgba(255,255,255,.4)", textAlign: "center", lineHeight: 1.1, maxWidth: 64, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{badge.name}</div>
    </button>
  );
};

export const ProfileScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;
  const level = proto.level;
  const streak = proto.streak;

  const pendingWinnings = proto.winnings.filter((w) => w.status === "pending");
  const claimableTickets = pendingWinnings.reduce((s, w) => s + w.tickets, 0);

  // Badge stats are derived from existing game state — no separate store. The
  // same shape can be filled from server data once state moves server-side.
  const badgeStats: BadgeStats = deriveBadgeStats(proto);
  const earnedBadges = BADGES.filter((b) => isBadgeEarned(b, badgeStats)).length;
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const onClaim = (w: Winning) => {
    proto.claimWinning(w.id);
    setToast(`Claimed ${usdtLabel(w.tickets)}`);
  };
  const onConvert = (w: Winning) => {
    proto.convertWinning(w.id);
    setToast(`Added ${w.tickets} 🎟 to your balance`);
  };

  // Replay the whole onboarding experience: clear every "seen" flag (the
  // per-screen coach marks AND the first-launch intro) and reload. A reload is
  // used because the intro is gated outside React state, so this is the simplest
  // way to make both replay cleanly.
  const replayTutorial = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("waffles.v2.coach.") || k === "waffles.v2.onboarded")
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage disabled — nothing to replay */
    }
    window.location.reload();
  };

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 280, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.2), transparent 60%)" }} />

      <TopHeader tickets={tickets} title="ME" />

      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 80, padding: "0 16px", overflow: "auto" }}>
        <div style={{ textAlign: "center", color: "var(--ink)", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <AssetWell size={112} accent="var(--maple-500)" radius={24} style={{ borderRadius: "44% 44% 38% 38%" }}>
              <PixelImg src={ASSETS.wally} size={100} alt="" />
            </AssetWell>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1 }}>@{proto.username || "waffleeater"}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginTop: 4 }}>Joined 2 weeks ago</div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[
            { l: "LEVEL", v: String(level), c: "#FFC931" },
            { l: "WINS", v: "4", c: "#fff" },
            { l: "STREAK", v: `${streak}`, c: "#FB72FF" },
            { l: "BEST", v: "#11", c: "#00CFF2" },
          ].map((s) => {
            // The streak tile opens the daily-reward sheet (manual entry point).
            const isStreak = s.l === "STREAK";
            return (
              <div
                key={s.l}
                onClick={isStreak ? () => proto.update({ dailyOpen: true }) : undefined}
                role={isStreak ? "button" : undefined}
                tabIndex={isStreak ? 0 : undefined}
                aria-label={isStreak ? `${streak} day streak — open daily reward` : undefined}
                onKeyDown={
                  isStreak
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          proto.update({ dailyOpen: true });
                        }
                      }
                    : undefined
                }
                style={{ flex: 1, background: "#0F0F10", border: isStreak ? "1px solid rgba(251,114,255,.4)" : "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 4px", textAlign: "center", color: "#fff", cursor: isStreak ? "pointer" : "default" }}
              >
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 0.6, marginTop: 4 }}>{s.l}</div>
              </div>
            );
          })}
        </div>

        {/* Badges — derived achievements. Tap a coin for its detail + progress. */}
        <div style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", letterSpacing: 0.4 }}>BADGES</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--maple-500)", fontFamily: "var(--font-display)" }}>{earnedBadges}/{BADGES.length}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, justifyItems: "center" }}>
            {BADGES.map((b) => (
              <BadgeCoin key={b.id} badge={b} stats={badgeStats} onClick={() => setSelectedBadge(b)} />
            ))}
          </div>
        </div>

        <div data-coach="profile-tickets" style={{ background: "#0F0F10", border: "1px solid rgba(255,201,49,.2)", borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: "0 0 24px rgba(255,201,49,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AssetWell size={58} accent="var(--maple-500)" radius={14}>
              <TicketIcon size={30} />
            </AssetWell>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "#fff", lineHeight: 1 }}>{tickets} ticket{tickets === 1 ? "" : "s"}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Spend on entries, power-ups & cosmetics</div>
            </div>
            <InfoButton title="Ticket value" text={TICKET_INFO} size={26} />
          </div>
        </div>

        {/* Prize Wallet — tournament winnings (USDT-backed) the player resolves
            per prize: claim the USDT value or convert into spendable tickets. */}
        <div style={{ background: "#0F0F10", border: "1px solid rgba(0,207,242,.22)", borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: "0 0 24px rgba(0,207,242,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: pendingWinnings.length ? 12 : 0 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", letterSpacing: 0.4 }}>PRIZE WALLET</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Tournament winnings · paid in USDT</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "#00CFF2", lineHeight: 1 }}>{usdtLabel(claimableTickets)}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 3 }}>claimable</div>
            </div>
          </div>

          {pendingWinnings.length === 0 ? (
            <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.4)", padding: "10px 0", lineHeight: 1.4 }}>
              No prizes to claim yet.<br />Finish Top 100 in a tournament to win USDT.
            </div>
          ) : (
            pendingWinnings.map((w) => (
              <div key={w.id} style={{ background: "#1a1a1c", border: "1px solid rgba(255,255,255,.05)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(255,201,49,.12)", border: "1px solid rgba(255,201,49,.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <PixelImg src={ASSETS.trophy} size={28} alt="" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", lineHeight: 1 }}>#{w.rank} finish</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.45)", marginTop: 3 }}>{timeAgo(w.wonAt)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "#00CFF2", lineHeight: 1 }}>{usdtLabel(w.tickets)}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", marginTop: 3, display: "inline-flex", alignItems: "center", gap: 3 }}>{w.tickets} <TicketIcon size={11} /></div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onConvert(w)}
                    style={{ flex: 1, background: "transparent", border: "1.5px solid rgba(255,201,49,.4)", color: "var(--maple-500)", borderRadius: 10, padding: "9px 0", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 0.3, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  >
                    Use {w.tickets} <TicketIcon size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onClaim(w)}
                    style={{ flex: 1.3, background: "#00CFF2", border: "1.5px solid var(--frame)", color: "var(--frame)", borderRadius: 10, padding: "9px 0", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 0.3, cursor: "pointer", boxShadow: "0 3px 0 var(--frame)" }}
                  >
                    Claim {usdtLabel(w.tickets)}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", marginBottom: 10, letterSpacing: 0.4 }}>BEST CATEGORIES</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { name: "Movies", pct: 78 },
              { name: "Crypto", pct: 64 },
              { name: "Music", pct: 52 },
            ].map((c) => {
              const col = CATEGORY_COLORS[c.name];
              return (
                <div key={c.name} style={{ flex: "1 1 30%", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", background: "#1a1a1c", border: "1px solid rgba(255,255,255,.04)", borderRadius: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${col.fg}15`, border: `1px solid ${col.fg}40`, color: col.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CategoryIcon name={c.name} size={20} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.5)" }}>{c.name}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff" }}>{c.pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="pressable"
          onClick={replayTutorial}
          style={{ marginTop: 10, width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "11px 14px", color: "var(--ink-mute)", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0 0V3m0 5h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Replay tutorial
        </button>

        {/* Support & legal — opens the in-app tabbed sheet. */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
          {([["support", "Support"], ["privacy", "Privacy"], ["terms", "Terms"]] as [LegalTab, string][]).map(([id, label], i) => (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span aria-hidden="true" style={{ color: "var(--ink-faint)", fontSize: 11 }}>·</span>}
              <button
                type="button"
                onClick={() => setLegalTab(id)}
                style={{ background: "none", border: "none", padding: "2px 0", cursor: "pointer", fontSize: 12, fontWeight: 800, color: "var(--ink-faint)" }}
              >
                {label}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="bottom-bar">
        <TabBar active="me" />
      </div>

      {legalTab && <LegalSheet initialTab={legalTab} onClose={() => setLegalTab(null)} />}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: "calc(64px + 16px)",
            left: 16,
            right: 16,
            background: "var(--frame)",
            color: "var(--ink)",
            border: "1.5px solid #00CFF2",
            borderRadius: 12,
            padding: "11px 14px",
            fontFamily: "var(--font-display)",
            fontSize: 13,
            letterSpacing: 0.3,
            textAlign: "center",
            zIndex: 60,
            animation: "waffles-v2-tile-enter 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          ✓ {toast}
        </div>
      )}

      {/* Badge detail — tap any coin to see what it's for and how close you are. */}
      {selectedBadge && (() => {
        const earned = isBadgeEarned(selectedBadge, badgeStats);
        const pct = badgeProgress(selectedBadge, badgeStats);
        const cur = Math.min(selectedBadge.current(badgeStats), selectedBadge.goal);
        return (
          <div
            onClick={() => setSelectedBadge(null)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.65)", display: "grid", placeItems: "center", zIndex: 80, padding: 28 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "var(--surface-2)", border: `1px solid ${earned ? selectedBadge.accent : "rgba(255,255,255,.12)"}`, borderRadius: 18, padding: "24px 20px 18px", textAlign: "center", maxWidth: 300, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,.55)" }}
            >
              <div style={{ width: 84, height: 84, margin: "0 auto 14px", borderRadius: "50%", display: "grid", placeItems: "center", background: earned ? `radial-gradient(circle at 35% 25%, ${selectedBadge.accent}45, transparent 62%), #15151a` : "#141416", border: `2.5px solid ${earned ? selectedBadge.accent : "rgba(255,255,255,.1)"}`, boxShadow: earned ? `0 0 22px ${selectedBadge.accent}66` : "none" }}>
                <PixelImg src={selectedBadge.icon} size={44} alt="" style={{ filter: earned ? undefined : "grayscale(1) brightness(.55)", opacity: earned ? 1 : 0.6 }} />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)" }}>{selectedBadge.name}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.4 }}>{selectedBadge.desc}</div>
              {earned ? (
                <div style={{ marginTop: 14, fontFamily: "var(--font-display)", fontSize: 13, color: "var(--leaf)" }}>✓ Earned</div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                    <div style={{ width: `${pct * 100}%`, height: "100%", background: selectedBadge.accent, borderRadius: 99, transition: "width .3s var(--ease-out-quart)" }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-mute)", marginTop: 6, fontFamily: "var(--font-display)" }}>{cur} / {selectedBadge.goal}</div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                style={{ marginTop: 18, width: "100%", background: "var(--maple-500)", color: "var(--frame)", border: "2px solid var(--frame)", borderRadius: 12, padding: "10px 0", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 0.3, textAlign: "center", boxShadow: "0 3px 0 var(--frame)", cursor: "pointer" }}
              >
                GOT IT
              </button>
            </div>
          </div>
        );
      })()}
    </Phone>
  );
};
