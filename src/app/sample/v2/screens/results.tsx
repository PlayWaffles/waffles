"use client";

import { useProto } from "../state";
import { ASSETS, Confetti, FlameIcon, Phone, PixelImg, TicketIcon } from "../shared";

export const ResultsScreen = () => {
  const proto = useProto();
  const score = proto.score;
  const total = proto.totalQuestions;
  const rank = Math.max(1, Math.round(2418 * (1 - Math.min(1, score / (total * 250)))) + 1);
  const pct = Math.max(1, Math.round((rank / 2418) * 100));
  return (
    <Phone statusDark>
      <div className="bg-deep" />
      {/* Celebration burst — top-3 finishes get a richer confetti shower. */}
      <Confetti pieces={rank <= 3 ? 60 : 36} />
      <div className="glow-top" style={{ height: 360, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.25), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 300, backgroundImage: "radial-gradient(circle, #FFC931 2px, transparent 2.5px), radial-gradient(circle, #FB72FF 2px, transparent 2.5px), radial-gradient(circle, #00CFF2 2px, transparent 2.5px)", backgroundSize: "80px 80px, 100px 100px, 70px 70px", backgroundPosition: "0 0, 30px 40px, 50px 20px", opacity: 0.55 }} />

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ fontFamily: "Archivo Black", fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,.6)" }}>YOU FINISHED</div>
        <div style={{ fontFamily: "Archivo Black", fontSize: 64, letterSpacing: 1, lineHeight: 1, marginTop: 4, color: "#FFC931", textShadow: "0 0 32px rgba(255,201,49,.5)" }}>#{rank}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.7)", marginTop: 2 }}>of 2,418 · Top {pct}%</div>
      </div>

      <div style={{ position: "absolute", top: 200, left: 18, right: 18, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, background: "linear-gradient(180deg, #FFC931, #F5BB1B)", borderRadius: 14, padding: "12px 10px", textAlign: "center", border: "2px solid #1e1e1e", boxShadow: "0 4px 0 #1e1e1e" }}>
          <PixelImg src={ASSETS.xpGem} size={28} alt="XP" />
          <div style={{ fontFamily: "Archivo Black", fontSize: 18, color: "#1e1e1e", lineHeight: 1, marginTop: 2 }}>+{score}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#1e1e1e", opacity: 0.75 }}>XP EARNED</div>
        </div>
        <div style={{ flex: 1, background: "linear-gradient(180deg, #00CFF2, #00a3c2)", borderRadius: 14, padding: "12px 10px", textAlign: "center", border: "2px solid #1e1e1e", boxShadow: "0 4px 0 #1e1e1e" }}>
          <TicketIcon size={26} color="#fff" />
          <div style={{ fontFamily: "Archivo Black", fontSize: 18, color: "#1e1e1e", lineHeight: 1, marginTop: 2 }}>+1</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#1e1e1e", opacity: 0.75 }}>TICKET</div>
        </div>
        <div style={{ flex: 1, background: "linear-gradient(180deg, #FB72FF, #a83fb8)", borderRadius: 14, padding: "12px 10px", textAlign: "center", border: "2px solid #1e1e1e", boxShadow: "0 4px 0 #1e1e1e", color: "#fff" }}>
          <FlameIcon size={28} />
          <div style={{ fontFamily: "Archivo Black", fontSize: 18, lineHeight: 1, marginTop: 2 }}>13</div>
          <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.9 }}>DAY STREAK</div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 320, left: 14, right: 14, bottom: 96, background: "#0F0F10", borderRadius: 16, border: "1px solid rgba(255,255,255,.06)", padding: "14px 12px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 13, color: "#fff", letterSpacing: 0.5 }}>LEADERBOARD</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#FFC931", display: "flex", alignItems: "center", gap: 4 }}>TOP 100 <TicketIcon size={14} /></div>
        </div>
        {[
          { r: 1, n: "@quizking", s: 9840, av: ASSETS.avatarFox },
          { r: 2, n: "@trivia.eth", s: 9540, av: ASSETS.avatarBear },
          { r: 3, n: "@waffleboss", s: 9210, av: ASSETS.avatarFrog },
          { r: rank, n: "@you", s: score, av: ASSETS.wally, you: true },
          { r: rank + 1, n: "@brainpan", s: Math.max(0, score - 60), av: ASSETS.avatarPanda },
        ].map((p, i) => {
          const rankColor = i === 0 ? "#FFC931" : i === 1 ? "#bfc7d0" : i === 2 ? "#cd7f32" : "rgba(255,255,255,.4)";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 10, background: p.you ? "rgba(255,201,49,.08)" : "transparent", border: p.you ? "1.5px solid var(--maple-500)" : "1.5px solid transparent", marginBottom: 4 }}>
              <div style={{ width: 24, fontFamily: "var(--font-display)", fontSize: 13, color: rankColor, textAlign: "center", flexShrink: 0 }}>{p.r}</div>
              <PixelImg src={p.av} size={36} alt="" />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "var(--ink)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.n}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: p.you ? "var(--maple-500)" : "var(--ink)" }}>{p.s.toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta icon-btn" aria-label="Back to home" onClick={() => proto.goto("home")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12l9-8 9 8v8a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" /></svg>
          </button>
          <button className="cta maple" onClick={() => proto.playAgain()}>PLAY NEXT HOUR</button>
        </div>
      </div>
    </Phone>
  );
};
