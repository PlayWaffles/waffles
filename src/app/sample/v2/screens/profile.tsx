"use client";

import { useProto } from "../state";
import { ASSETS, CATEGORY_COLORS, CategoryIcon, Phone, PixelImg, TabBar, TicketIcon, TopHeader } from "../shared";

export const ProfileScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;
  const level = proto.level;
  const streak = proto.streak;
  return (
    <Phone statusDark>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #000 100%)" }} />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 280, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.2), transparent 60%)" }} />

      <TopHeader tickets={tickets} title="ME" />

      <div style={{ position: "absolute", top: 60, left: 0, right: 0, bottom: 80, padding: "0 16px", overflow: "hidden" }}>
        <div style={{ textAlign: "center", color: "#fff", marginBottom: 14 }}>
          <div style={{ width: 88, height: 88, margin: "4px auto 8px", borderRadius: 99, background: "linear-gradient(180deg, #FFC931, #F5BB1B)", border: "4px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 0 #1e1e1e", overflow: "hidden" }}>
            <PixelImg src={ASSETS.wally} size={76} alt="Wally" />
          </div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 22, lineHeight: 1 }}>@waffleeater</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Joined 2 weeks ago</div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[
            { l: "LEVEL", v: String(level), c: "#FFC931" },
            { l: "WINS", v: "4", c: "#fff" },
            { l: "STREAK", v: `${streak}`, c: "#FB72FF" },
            { l: "BEST", v: "#11", c: "#00CFF2" },
          ].map((s) => (
            <div key={s.l} style={{ flex: 1, background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 4px", textAlign: "center", color: "#fff" }}>
              <div style={{ fontFamily: "Archivo Black", fontSize: 18, lineHeight: 1, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 0.6, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#0F0F10", border: "1px solid rgba(255,201,49,.2)", borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: "0 0 24px rgba(255,201,49,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TicketIcon size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Archivo Black", fontSize: 20, color: "#fff", lineHeight: 1 }}>{tickets} ticket{tickets === 1 ? "" : "s"}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Earned from levels & top finishes</div>
            </div>
          </div>
        </div>

        <div style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 13, color: "#fff", marginBottom: 10, letterSpacing: 0.4 }}>BEST CATEGORIES</div>
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
                  <div style={{ fontFamily: "Archivo Black", fontSize: 13, color: "#fff" }}>{c.pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0F0F10", padding: "8px 0 6px", borderTop: "2px solid rgba(255,255,255,.08)" }}>
        <TabBar active="me" />
      </div>
    </Phone>
  );
};
