"use client";

import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, TopHeader } from "../shared";

export const LobbyScreen = () => {
  const proto = useProto();
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
          <div style={{ fontFamily: "Archivo Black", fontSize: 64, lineHeight: 1, letterSpacing: 1, color: "#FFC931", textShadow: "0 0 24px rgba(255,201,49,.4)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 18, marginTop: 8, letterSpacing: 0.5, color: "#fff" }}>TOP OF THE HOUR</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Mixed · 12 Q · 90s</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "Archivo Black", fontSize: 24, color: "#fff", lineHeight: 1 }}>2,418</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>players joined</div>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {[ASSETS.avatarFox, ASSETS.avatarBear, ASSETS.avatarFrog, ASSETS.avatarPanda, ASSETS.avatarOwl].map((src, i) => (
                <PixelImg key={i} src={src} size={44} alt="" style={{ marginLeft: i ? -14 : 0 }} />
              ))}
              <div aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 99, background: "var(--maple-500)", color: "var(--frame)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, marginLeft: -10, fontFamily: "var(--font-display)" }}>+2k</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.6)" }}>
            <div style={{ flex: 1, padding: "8px 10px", background: "rgba(255,201,49,.06)", border: "1px solid rgba(255,201,49,.15)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#FFC931" }}>+80 XP</div>
              <div>per win</div>
            </div>
            <div style={{ flex: 1, padding: "8px 10px", background: "rgba(0,207,242,.06)", border: "1px solid rgba(0,207,242,.15)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#00CFF2" }}>Top 100</div>
              <div>get a ticket</div>
            </div>
          </div>
        </div>

        <div style={{ background: "rgba(251,114,255,.08)", border: "1px solid rgba(251,114,255,.2)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {[ASSETS.avatarCat, ASSETS.avatarDog, ASSETS.avatarRabbit].map((src, i) => (
              <PixelImg key={i} src={src} size={40} alt="" style={{ marginLeft: i ? -12 : 0 }} />
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
          <button className="cta">YOU&apos;RE IN — GOOD LUCK</button>
        </div>
      </div>
    </Phone>
  );
};
