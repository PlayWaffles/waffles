"use client";

import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, TicketIcon } from "../shared";

export const LevelWinScreen = () => {
  const proto = useProto();
  const score = proto.score;
  const heartsLeft = proto.hearts;

  return (
    <Phone statusDark>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #000 100%)" }} />
      <div style={{ position: "absolute", top: -60, left: -40, right: -40, height: 380, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.3), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 400, backgroundImage: "radial-gradient(circle, #FFC931 2px, transparent 2.5px), radial-gradient(circle, #FB72FF 2px, transparent 2.5px), radial-gradient(circle, #00CFF2 2px, transparent 2.5px)", backgroundSize: "80px 80px, 100px 100px, 70px 70px", backgroundPosition: "0 0, 30px 40px, 50px 20px", opacity: 0.6 }} />

      <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: "rgba(255,255,255,.5)" }}>LEVEL CLEARED</div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", filter: "drop-shadow(0 0 28px rgba(255,201,49,.5))" }}>
          <PixelImg src={ASSETS.trophy} size={92} alt="trophy" />
        </div>
        <div style={{ fontFamily: "Archivo Black", fontSize: 38, marginTop: 8, color: "#FFC931" }}>LEVEL UP!</div>
        <div style={{ fontFamily: "Archivo Black", fontSize: 18, color: "#fff", marginTop: 2 }}>Level 18 → 19</div>
      </div>

      <div style={{ position: "absolute", top: 330, left: 18, right: 18, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 22, color: "#FFC931", lineHeight: 1 }}>+{score}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.5)", marginTop: 4, letterSpacing: 0.6 }}>XP EARNED</div>
        </div>
        <div style={{ flex: 1, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
            {[1, 2, 3].map((h) => (
              <PixelImg key={h} src={h <= heartsLeft ? ASSETS.heartFull : ASSETS.heartEmpty} size={22} alt="heart" />
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.5)", marginTop: 4, letterSpacing: 0.6 }}>HEARTS LEFT</div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 430, left: 18, right: 18, background: "rgba(0,207,242,.1)", border: "1px solid rgba(0,207,242,.25)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <TicketIcon size={26} color="#fff" />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 13, color: "#fff", lineHeight: 1 }}>Free ticket at Level 21</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>2 levels to go</div>
        </div>
        <div style={{ height: 6, width: 60, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{ width: "33%", height: "100%", background: "#FFC931", borderRadius: 99 }} />
        </div>
      </div>

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta icon-btn" onClick={() => proto.goto("home")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12l9-8 9 8v8a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" /></svg>
          </button>
          <button className="cta maple" onClick={() => proto.goto("levels")}>NEXT LEVEL</button>
        </div>
      </div>
    </Phone>
  );
};

export const LevelFailScreen = () => {
  const proto = useProto();
  return (
    <Phone statusDark>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #000 100%)" }} />
      <div style={{ position: "absolute", top: -60, left: -40, right: -40, height: 380, background: "radial-gradient(ellipse at center top, rgba(252,25,25,.25), transparent 60%)" }} />

      <div style={{ position: "absolute", top: 88, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: "rgba(255,255,255,.5)" }}>LEVEL FAILED</div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", filter: "drop-shadow(0 0 24px rgba(252,25,25,.4))" }}>
          <PixelImg src={ASSETS.heartBroken} size={92} alt="failed" />
        </div>
        <div style={{ fontFamily: "Archivo Black", fontSize: 34, marginTop: 10, color: "#FC1919" }}>OUT OF HEARTS</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.55)", marginTop: 6, padding: "0 32px" }}>The Night Owl got the better of you this time. Try again — your progress is saved.</div>
      </div>

      <div style={{ position: "absolute", top: 380, left: 18, right: 18, display: "flex", justifyContent: "center", gap: 10 }}>
        {[0, 0, 0].map((_, i) => (
          <div key={i} style={{ width: 46, height: 46, borderRadius: 99, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PixelImg src={ASSETS.heartEmpty} size={26} alt="empty heart" />
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", top: 460, left: 18, right: 18, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "12px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 1, textTransform: "uppercase" }}>Tip</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginTop: 4, lineHeight: 1.35 }}>Read the question fully — the timer is forgiving on level mode.</div>
      </div>

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta icon-btn" onClick={() => proto.goto("levels", { back: true })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="cta" onClick={() => proto.retryLevel()}>RETRY</button>
        </div>
      </div>
    </Phone>
  );
};
