"use client";

import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, SectionLabel, TabBar, TicketIcon, TopHeader } from "../shared";

export const ShopScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;

  const featured = {
    title: "Double XP",
    sub: "Next 3 tournaments · 2× XP",
    price: 5,
    accent: "#FB72FF",
  };

  const powerUps = [
    { id: "5050", label: "50/50", sub: "Eliminate 2 wrong", price: 1, color: "#00CFF2", icon: ASSETS.powerup5050 },
    { id: "time", label: "+5 sec", sub: "Per question, once", price: 1, color: "#FFC931", icon: ASSETS.powerupTime },
    { id: "skip", label: "Skip", sub: "Pass on one Q", price: 2, color: "#FB72FF", icon: ASSETS.powerupSkip },
    { id: "shield", label: "Shield", sub: "Protect 1 streak", price: 2, color: "#00CFF2", icon: ASSETS.powerupShield },
  ];

  const cosmetics = [
    { id: "frame-gold", label: "Gold Frame", type: "Avatar frame", price: 8, color: "#FFC931", owned: false },
    { id: "name-pink", label: "Pink Name", type: "Name color", price: 6, color: "#FB72FF", owned: false },
    { id: "emote-waffle", label: "Waffle Emote", type: "Emote", price: 4, color: "#00CFF2", owned: true },
  ];

  const ticketBundles = [
    { count: 5, bonus: 0, price: "$0.99", badge: null as string | null },
    { count: 25, bonus: 5, price: "$3.99", badge: "POPULAR" },
    { count: 60, bonus: 20, price: "$7.99", badge: "BEST" },
  ];

  return (
    <Phone statusDark>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1e1e1e 0%, #000 100%)" }} />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 240, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.18), transparent 60%)" }} />

      <TopHeader tickets={tickets} title="SHOP" />

      <div style={{ position: "absolute", top: 60, left: 0, right: 0, bottom: 80, padding: "4px 14px 14px", overflow: "auto" }}>
        <div style={{ background: `linear-gradient(135deg, ${featured.accent}33, #0F0F10 70%)`, border: `1px solid ${featured.accent}55`, borderRadius: 18, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 14, boxShadow: `0 0 30px ${featured.accent}22` }}>
          <div style={{ width: 62, height: 62, borderRadius: 14, background: `${featured.accent}25`, border: `1.5px solid ${featured.accent}66`, display: "flex", alignItems: "center", justifyContent: "center", color: featured.accent, fontFamily: "Archivo Black", fontSize: 22, flexShrink: 0 }}>2×</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: featured.accent, letterSpacing: 1.4 }}>FEATURED · ENDS IN 2D</div>
            <div style={{ fontFamily: "Archivo Black", fontSize: 18, color: "#fff", lineHeight: 1.05, marginTop: 2 }}>{featured.title}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{featured.sub}</div>
          </div>
          <button style={{ background: featured.accent, color: "#1e1e1e", border: "none", padding: "8px 12px", borderRadius: 10, fontFamily: "Archivo Black", fontSize: 13, letterSpacing: 0.3, boxShadow: "0 3px 0 rgba(0,0,0,.3)", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
            <TicketIcon size={14} color="#1e1e1e" />{featured.price}
          </button>
        </div>

        <SectionLabel>POWER-UPS</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {powerUps.map((p) => (
            <div key={p.id} style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${p.color}1e`, border: `1px solid ${p.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <PixelImg src={p.icon} size={28} alt="" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#fff", lineHeight: 1 }}>{p.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{p.sub}</div>
                </div>
              </div>
              <button style={{ background: "rgba(255,201,49,.1)", border: "1px solid rgba(255,201,49,.3)", color: "#FFC931", borderRadius: 8, padding: "6px 0", fontFamily: "Archivo Black", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
                <TicketIcon size={13} />{p.price}
              </button>
            </div>
          ))}
        </div>

        <SectionLabel>COSMETICS</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {cosmetics.map((c) => (
            <div key={c.id} style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}1e`, border: `1.5px solid ${c.color}55`, flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {c.id === "frame-gold" && <div style={{ width: 24, height: 24, borderRadius: 99, border: `2.5px solid ${c.color}`, background: "#1a1a1c" }} />}
                {c.id === "name-pink" && <div style={{ fontFamily: "Archivo Black", fontSize: 11, color: c.color }}>Aa</div>}
                {c.id === "emote-waffle" && <PixelImg src={ASSETS.wally} size={28} alt="" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#fff", lineHeight: 1 }}>{c.label}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{c.type}</div>
              </div>
              {c.owned ? (
                <div style={{ background: "rgba(0,207,242,.12)", border: "1px solid rgba(0,207,242,.35)", color: "#00CFF2", borderRadius: 8, padding: "6px 12px", fontFamily: "Archivo Black", fontSize: 11 }}>OWNED</div>
              ) : (
                <button style={{ background: "#FFC931", color: "#1e1e1e", border: "none", padding: "7px 12px", borderRadius: 8, fontFamily: "Archivo Black", fontSize: 13, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", boxShadow: "0 3px 0 rgba(0,0,0,.25)" }}>
                  <TicketIcon size={13} color="#1e1e1e" />{c.price}
                </button>
              )}
            </div>
          ))}
        </div>

        <SectionLabel>TICKETS</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {ticketBundles.map((b, i) => (
            <div key={i} style={{ background: "#0F0F10", border: b.badge ? "1.5px solid rgba(255,201,49,.4)" : "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 6px", textAlign: "center", position: "relative", boxShadow: b.badge ? "0 0 20px rgba(255,201,49,.1)" : "none" }}>
              {b.badge && <div style={{ position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)", background: "#FFC931", color: "#1e1e1e", padding: "2px 8px", borderRadius: 99, fontFamily: "Archivo Black", fontSize: 8, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{b.badge}</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 4 }}>
                <TicketIcon size={20} />
                <span style={{ fontFamily: "Archivo Black", fontSize: 18, color: "#fff" }}>{b.count}</span>
              </div>
              {b.bonus > 0 && <div style={{ fontSize: 9, fontWeight: 800, color: "#00CFF2", marginTop: 1 }}>+{b.bonus} BONUS</div>}
              {b.bonus === 0 && <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.3)", marginTop: 1 }}>—</div>}
              <button style={{ marginTop: 6, width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", borderRadius: 8, padding: "5px 0", fontFamily: "Archivo Black", fontSize: 11, cursor: "pointer" }}>{b.price}</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0F0F10", padding: "8px 0 6px", borderTop: "2px solid rgba(255,255,255,.08)" }}>
        <TabBar active="shop" />
      </div>
    </Phone>
  );
};
