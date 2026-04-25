"use client";

import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, TabBar, TicketIcon, TopHeader } from "../shared";

export const LevelPath = () => {
  const proto = useProto();
  const tickets = proto.tickets;
  const startLevel = proto.startLevel;
  const nodes: { n: number; state: "done" | "current" | "locked"; x: number; label?: boolean }[] = [
    { n: 22, state: "done", x: 50 },
    { n: 21, state: "done", x: 30 },
    { n: 20, state: "done", x: 50 },
    { n: 19, state: "done", x: 70 },
    { n: 18, state: "current", x: 60, label: true },
    { n: 17, state: "locked", x: 38 },
    { n: 16, state: "locked", x: 22 },
    { n: 15, state: "locked", x: 40 },
    { n: 14, state: "locked", x: 62 },
    { n: 13, state: "locked", x: 50 },
  ];

  return (
    <Phone statusDark>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #0a0a0b 100%)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-conic-gradient(rgba(255,201,49,.025) 0 25%, transparent 0 50%)", backgroundSize: "80px 80px" }} />
      <div style={{ position: "absolute", top: 60, left: -20, right: -20, height: 200, background: "radial-gradient(ellipse at center, rgba(255,201,49,.18), transparent 65%)" }} />
      <div style={{ position: "absolute", bottom: 120, left: -40, right: -40, height: 180, background: "radial-gradient(ellipse at center, rgba(0,207,242,.12), transparent 65%)" }} />

      <TopHeader tickets={tickets} title="LEVELS" />

      <div style={{ position: "absolute", top: 70, left: 0, right: 0, bottom: 140, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 8, left: 14, right: 14, display: "flex", gap: 10, alignItems: "flex-start", zIndex: 5 }}>
          <div style={{ width: 54, height: 54, borderRadius: 99, background: "linear-gradient(180deg, #FFC931, #F5BB1B)", border: "3px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 0 #1e1e1e", overflow: "hidden" }}>
            <PixelImg src={ASSETS.wally} size={48} alt="Wally" />
          </div>
          <div className="bubble">Level <b>18</b> — three away from your next ticket. Keep going!</div>
        </div>

        <div style={{ position: "absolute", top: 90, left: 0, right: 0, bottom: 0, padding: "0 20px" }}>
          {nodes.map((node, i) => (
            <div key={node.n} style={{ position: "relative", marginBottom: i === 0 ? 0 : 6, height: 64, display: "flex", justifyContent: "flex-start" }}>
              <div onClick={() => node.state === "current" && startLevel()} style={{ position: "absolute", left: `${node.x}%`, transform: "translateX(-50%)", cursor: node.state === "current" ? "pointer" : "default" }}>
                <div className={"waffle-node " + node.state}>
                  {node.state === "done" ? <PixelImg src={ASSETS.checkmark} size={32} alt="done" /> : node.state === "locked" ? <PixelImg src={ASSETS.lock} size={28} alt="locked" /> : node.n}
                </div>
                {node.state === "current" && (
                  <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", background: "#FB72FF", color: "#1e1e1e", fontFamily: "Archivo Black", fontSize: 10, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", boxShadow: "0 2px 0 #1e1e1e" }}>YOU</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", top: 140, right: -20, width: 120, height: 80, borderRadius: "50% 40% 50% 60%", background: "radial-gradient(ellipse at 30% 30%, rgba(0,207,242,.4), rgba(0,207,242,.05))", opacity: 0.85 }} />

        <div style={{ position: "absolute", bottom: 8, left: 14, right: 14, background: "linear-gradient(180deg, #FFC931, #F5BB1B)", border: "3px solid #1e1e1e", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 0 #1e1e1e" }}>
          <TicketIcon size={26} color="#fff" />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#1e1e1e", lineHeight: 1 }}>Level 21 · Free Ticket</div>
            <div style={{ fontSize: 11, color: "#1e1e1e", fontWeight: 700, opacity: 0.75 }}>3 levels away</div>
          </div>
          <div style={{ height: 6, width: 80, borderRadius: 99, background: "rgba(30,30,30,.25)", overflow: "hidden" }}>
            <div style={{ width: "70%", height: "100%", background: "#1e1e1e", borderRadius: 99 }} />
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta icon-btn" onClick={() => proto.goto("home")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="cta" onClick={() => startLevel()}>PLAY LEVEL 18</button>
        </div>
        <TabBar active="levels" />
      </div>
    </Phone>
  );
};
