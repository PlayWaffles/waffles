"use client";

import { Fragment } from "react";
import { TOURNAMENT_PRIZES, TOURNAMENT_TOP_PRIZE, useProto } from "../state";
import { ASSETS, Phone, PixelImg, TicketIcon, TopHeader } from "../shared";
import { useTheme } from "../theme";

export const LobbyScreen = () => {
  const proto = useProto();
  const theme = useTheme();
  const tickets = proto.tickets;
  const sec = proto.countdownSec;
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div className="glow-top" style={{ height: 300, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.25), transparent 65%)" }} />

      <TopHeader tickets={tickets} title="LOBBY" />

      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 90, padding: "10px 18px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
        <div style={{ textAlign: "center", color: "white", padding: "4px 0 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: 1.5, textTransform: "uppercase" }}>Starts in</div>
          <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 64, lineHeight: 1, letterSpacing: 1, color: "#FFC931", textShadow: "0 0 24px rgba(255,201,49,.4)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 8, letterSpacing: 0.5, color: "#fff" }}>{theme.copy.liveTitle.toUpperCase()}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Mixed · 6 Q · 90s</div>
          {proto.tournamentBonus && (
            <div className="chip" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,207,242,.14)", color: "var(--leaf)", padding: "4px 10px", fontSize: 11, border: "1px solid rgba(0,207,242,.35)" }}>⚡ 2× XP first-game bonus active</div>
          )}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "#fff", lineHeight: 1 }}>2,418</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>players joined</div>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {[ASSETS.avatarFox, ASSETS.avatarBear, ASSETS.avatarFrog, ASSETS.avatarPanda, ASSETS.avatarOwl].map((src, i) => (
                <PixelImg key={i} src={src} size={58} alt="" style={{ marginLeft: i ? -18 : 0 }} />
              ))}
              <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 99, background: "var(--maple-500)", color: "var(--frame)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, marginLeft: -14, fontFamily: "var(--font-display)" }}>+2k</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.6)" }}>
            <div style={{ flex: 1, padding: "8px 10px", background: "rgba(0,207,242,.06)", border: "1px solid rgba(0,207,242,.15)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#00CFF2" }}>+80 XP</div>
              <div>per win</div>
            </div>
            <div style={{ flex: 1, padding: "8px 10px", background: "rgba(255,201,49,.06)", border: "1px solid rgba(255,201,49,.15)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#FFC931", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <TicketIcon size={14} />{TOURNAMENT_TOP_PRIZE}
              </div>
              <div>top prize</div>
            </div>
          </div>

          {/* Full prize ladder so players see exactly what each tier pays. */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "stretch", justifyContent: "space-around", background: "rgba(255,201,49,.05)", border: "1px solid rgba(255,201,49,.14)", borderRadius: 10, padding: "8px 6px" }}>
            {TOURNAMENT_PRIZES.map((t, i) => (
              <Fragment key={t.label}>
                {i > 0 && <div style={{ width: 1, background: "rgba(255,255,255,.07)", margin: "2px 0" }} />}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: 0.5, textTransform: "uppercase" }}>{t.label}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#FFC931", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                    <TicketIcon size={12} />{t.tickets}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div style={{ background: "rgba(251,114,255,.08)", border: "1px solid rgba(251,114,255,.2)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {[ASSETS.avatarCat, ASSETS.avatarDog, ASSETS.avatarRabbit].map((src, i) => (
              <PixelImg key={i} src={src} size={52} alt="" style={{ marginLeft: i ? -16 : 0 }} />
            ))}
          </div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>3 friends are in this round</div>
        </div>
      </div>

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta icon-btn" aria-label="Leave lobby and return home" onClick={() => proto.goto("home")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {/* Status indicator, not an action — the lobby auto-advances when the
              countdown ends, so this is a styled label rather than a button. */}
          <div className="cta" style={{ cursor: "default" }} aria-live="polite">YOU&apos;RE IN — GOOD LUCK</div>
        </div>
      </div>
    </Phone>
  );
};
