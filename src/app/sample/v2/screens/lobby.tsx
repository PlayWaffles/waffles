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
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #000 100%)" }} />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 300, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.25), transparent 65%)" }} />

      <TopHeader tickets={tickets} title="LOBBY" />

      <div style={{ position: "absolute", top: 60, left: 0, right: 0, bottom: 90, padding: "10px 18px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
        <div style={{ textAlign: "center", color: "white", padding: "4px 0 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: 1.5, textTransform: "uppercase" }}>Starts in</div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 64, lineHeight: 1, letterSpacing: 1, color: "#FFC931", textShadow: "0 0 24px rgba(255,201,49,.4)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 18, marginTop: 8, letterSpacing: 0.5, color: "#fff" }}>TOP OF THE HOUR</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Mixed · 12 Q · 90s</div>
        </div>

        <div style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 14, boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "Archivo Black", fontSize: 24, color: "#fff", lineHeight: 1 }}>2,418</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>players joined</div>
            </div>
            <div style={{ display: "flex" }}>
              {[ASSETS.avatarFox, ASSETS.avatarBear, ASSETS.avatarFrog, ASSETS.avatarPanda, ASSETS.avatarOwl].map((src, i) => (
                <div key={i} style={{ width: 32, height: 32, borderRadius: 99, background: "#2a2a2e", border: "2px solid #0F0F10", overflow: "hidden", marginLeft: i ? -10 : 0 }}>
                  <PixelImg src={src} size={28} alt="" />
                </div>
              ))}
              <div style={{ width: 32, height: 32, borderRadius: 99, background: "#FFC931", color: "#1e1e1e", border: "2px solid #0F0F10", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, marginLeft: -10 }}>+2k</div>
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
          <div style={{ display: "flex" }}>
            {[ASSETS.avatarCat, ASSETS.avatarDog, ASSETS.avatarRabbit].map((src, i) => (
              <div key={i} style={{ width: 28, height: 28, borderRadius: 99, background: "#1a1a1c", border: "2px solid #FB72FF", overflow: "hidden", marginLeft: i ? -8 : 0 }}>
                <PixelImg src={src} size={24} alt="" />
              </div>
            ))}
          </div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#fff" }}>3 friends are in this round</div>
        </div>
      </div>

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta icon-btn" onClick={() => proto.goto("home")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="cta">YOU&apos;RE IN — GOOD LUCK</button>
        </div>
      </div>
    </Phone>
  );
};
