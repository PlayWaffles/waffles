"use client";

import { useProto } from "../state";
import { ASSETS, Phone, PixelImg } from "../shared";

export const LevelIntroScreen = () => {
  const proto = useProto();
  const levelNum = 18;
  const total = proto.totalQuestions;

  return (
    <Phone statusDark>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center 35%, #2a1f08 0%, #0a0a0b 65%)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "conic-gradient(from 90deg at 50% 35%, rgba(255,201,49,.12) 0deg, transparent 30deg, transparent 60deg, rgba(255,201,49,.08) 90deg, transparent 120deg, transparent 150deg, rgba(255,201,49,.12) 180deg, transparent 210deg, transparent 240deg, rgba(255,201,49,.08) 270deg, transparent 300deg, transparent 330deg)", mixBlendMode: "screen", opacity: 0.7 }} />

      <div style={{ position: "absolute", top: 50, left: 14, right: 14, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
        <button onClick={() => proto.goto("levels", { back: true })} style={{ width: 36, height: 36, borderRadius: 99, background: "rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 1.5, textTransform: "uppercase" }}>Boss Level</div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ position: "absolute", top: 96, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ fontFamily: "Archivo Black", fontSize: 14, letterSpacing: 3, color: "#FFC931" }}>LEVEL {levelNum}</div>
        <div style={{ fontFamily: "Archivo Black", fontSize: 42, letterSpacing: 0.5, lineHeight: 1, marginTop: 6, textShadow: "0 0 30px rgba(255,201,49,.4)" }}>THE NIGHT<br />OWL</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.55)", marginTop: 8, padding: "0 32px" }}>Three questions stand between you and Level 19.</div>
      </div>

      <div style={{ position: "absolute", top: 236, left: "50%", transform: "translateX(-50%)", width: 172, height: 172 }}>
        <div style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", width: 200, height: 50, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(255,201,49,.5), transparent 65%)" }} />
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "50%", background: "linear-gradient(180deg, #FB72FF 0%, #6a1f72 100%)", border: "4px solid #1e1e1e", boxShadow: "0 8px 0 #1e1e1e, 0 0 50px rgba(251,114,255,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PixelImg src={ASSETS.bossNightOwl} size={140} alt="Night Owl" />
        </div>
        <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: 99, background: "linear-gradient(180deg, #FFC931, #F5BB1B)", border: "3px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 18, color: "#1e1e1e", boxShadow: "0 4px 0 #1e1e1e" }}>{levelNum}</div>
      </div>

      <div style={{ position: "absolute", bottom: 120, left: 18, right: 18, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3].map((h) => (
            <PixelImg key={h} src={ASSETS.heartFull} size={26} alt="heart" />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 13, color: "#fff", lineHeight: 1 }}>3 hearts · {total} questions</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 3 }}>Lose all hearts and you'll have to retry.</div>
        </div>
      </div>

      <div className="bottom-bar" style={{ borderTop: "2px solid rgba(255,201,49,.2)" }}>
        <div className="cta-row">
          <button className="cta maple" onClick={() => proto.beginLevelQuiz()}>BEGIN</button>
        </div>
      </div>
    </Phone>
  );
};
