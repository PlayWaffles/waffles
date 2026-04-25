"use client";

import { Fragment } from "react";
import { useProto } from "../state";
import { ASSETS, FlameIcon, Phone, PixelImg, TabBar, TopHeader } from "../shared";

const HomeMissions = () => {
  const missions = [
    { label: "Earn 50 XP", cur: 32, tgt: 50, reward: "+10 XP", icon: "xp" },
    { label: "Win a round", cur: 0, tgt: 1, reward: "+1 🎟", icon: "win" },
    { label: "Play 2 games", cur: 1, tgt: 2, reward: "+25 XP", icon: "play" },
  ];
  return (
    <div style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 14, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "Archivo Black", fontSize: 13, color: "#fff", letterSpacing: 0.5 }}>DAILY MISSIONS</div>
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
                  <span style={{ fontFamily: "Archivo Black", fontSize: 10 }}>XP</span>
                ) : m.icon === "win" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 4h14v4a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V4zM10 13v4M14 13v4M8 20h8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5z" fill="currentColor" /></svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{m.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: done ? "#00CFF2" : "rgba(255,255,255,.5)", fontFamily: "Archivo Black" }}>{m.cur}/{m.tgt}</span>
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
    </div>
  );
};

const HomeContinueRun = () => {
  const proto = useProto();
  const level = proto.level;
  const next = level + 1;
  return (
    <div onClick={() => proto.goto("levels")} style={{ cursor: "pointer", background: "linear-gradient(135deg, #1a2a1a 0%, #0F0F10 60%)", border: "1px solid rgba(0,207,242,.2)", borderRadius: 16, padding: 14, display: "flex", gap: 14, alignItems: "center", position: "relative", overflow: "hidden", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 24px rgba(0,207,242,.06)" }}>
      <div style={{ width: 74, height: 74, borderRadius: 14, background: "radial-gradient(circle at 30% 30%, #2a4a2a, #0d1a0d)", border: "1px solid rgba(0,207,242,.2)", position: "relative", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PixelImg src={ASSETS.wally} size={62} alt="Wally" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#00CFF2", letterSpacing: 1, textTransform: "uppercase" }}>Next Level · Forest</div>
        <div style={{ fontFamily: "Archivo Black", fontSize: 18, lineHeight: 1.1, marginTop: 2, color: "#fff" }}>Level {next}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", fontWeight: 700, marginTop: 3 }}>3 questions · 3 lives · +50 XP</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 99, background: "#00CFF2", color: "#1e1e1e", flexShrink: 0, boxShadow: "0 3px 0 rgba(0,207,242,.3)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M9 5l8 7-8 7" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
};

export const HomeScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;
  const level = proto.level;
  const xp = proto.xp;
  const xpPct = Math.min(100, Math.round((xp / 500) * 100));
  const streak = proto.streak;
  const homeSlot = proto.tweaks.homeSlot;
  return (
    <Phone statusDark>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #000 100%)" }} />
      <div style={{ position: "absolute", top: -60, left: -40, right: -40, height: 280, background: "radial-gradient(ellipse at center top, rgba(255,201,49,0.15), transparent 60%)", pointerEvents: "none" }} />

      <TopHeader tickets={tickets} title="WAFFLES" />

      <div style={{ position: "absolute", top: 70, left: 0, right: 0, bottom: 140, padding: "0 18px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
        <div style={{ background: "#0F0F10", borderRadius: 18, padding: 18, position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: "#FC1919", boxShadow: "0 0 0 4px rgba(252,25,25,.2)", animation: "waffles-v2-pulse 1.5s infinite" }} />
            <div className="chip" style={{ background: "rgba(252,25,25,.15)", color: "#FC1919", padding: "3px 10px", fontSize: 11, border: "1px solid rgba(252,25,25,.3)" }}>LIVE NEXT HOUR</div>
          </div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 26, lineHeight: 1.05, color: "#fff" }}>Top of the Hour</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", fontWeight: 600, marginTop: 2 }}>Mixed trivia · 12 questions · 90s</div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
            {[["00", "HRS"], ["17", "MIN"], ["42", "SEC"]].map(([v, l], i, a) => (
              <Fragment key={l}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: 48, height: 42, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 22, color: "#F5BB1B", background: "linear-gradient(180deg, rgba(245,187,27,0.1), rgba(245,187,27,0.04))", border: "1px solid rgba(245,187,27,0.15)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,.25)", letterSpacing: 1.5 }}>{l}</div>
                </div>
                {i < a.length - 1 && <span style={{ color: "rgba(255,255,255,.2)", fontSize: 18, marginTop: -12 }}>:</span>}
              </Fragment>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "Archivo Black", fontSize: 20, color: "#fff" }}>2,418</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8 }}>players in</div>
            </div>
          </div>
          <div style={{ position: "absolute", right: -30, top: -30, opacity: 0.08, transform: "rotate(15deg)" }}>
            <div className="waffle-mark" style={{ width: 120, height: 120, borderRadius: 24 }} />
          </div>
        </div>

        {(homeSlot === "both" || homeSlot === "continue") && <HomeContinueRun />}
        {(homeSlot === "both" || homeSlot === "missions") && <HomeMissions />}

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, background: "#0F0F10", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FlameIcon size={18} />
              <span style={{ fontFamily: "Archivo Black", fontSize: 18, color: "#fff" }}>{streak}</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>day streak</div>
          </div>
          <div onClick={() => proto.goto("levels")} style={{ cursor: "pointer", flex: 1.4, background: "#0F0F10", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 0.8, textTransform: "uppercase" }}>Lvl {level}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FFC931", fontFamily: "Archivo Black" }}>{xp}/500 XP</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.05)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width: `${xpPct}%`, height: "100%", background: "linear-gradient(90deg, #FFC931, #F5BB1B)", borderRadius: 99, transition: "width .4s" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <div className="cta-row">
          <button className="cta" onClick={() => proto.startTournament()}>JOIN NEXT TOURNAMENT</button>
        </div>
        <TabBar active="home" />
      </div>
    </Phone>
  );
};
