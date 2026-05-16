"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useProto } from "../state";
import { ASSETS, Confetti, Phone, PixelImg, SectionLabel, TabBar, TicketIcon, TopHeader } from "../shared";

// ===== Catalog =================================================================
// Pulled out of the component so the purchase sub-views can read items by id
// without prop-drilling.

type PowerUp = { id: string; label: string; sub: string; price: number; color: string; icon: string };
type Cosmetic = { id: string; label: string; type: string; price: number; color: string; owned: boolean };
type Bundle = { count: number; bonus: number; price: string; badge: string | null };
type Featured = { title: string; sub: string; price: number; accent: string; benefits: string[]; endsIn: string };

const FEATURED: Featured = {
  title: "Double XP",
  sub: "Boost your tournament hauls",
  price: 5,
  accent: "#FB72FF",
  benefits: ["2× XP on the next 3 tournaments", "Stacks with daily missions", "Streak counter still ticks"],
  endsIn: "1d 22h",
};

const POWER_UPS: PowerUp[] = [
  { id: "5050", label: "50/50", sub: "Eliminate 2 wrong", price: 1, color: "#00CFF2", icon: ASSETS.powerup5050 },
  { id: "time", label: "+5 sec", sub: "Per question, once", price: 1, color: "#FFC931", icon: ASSETS.powerupTime },
  { id: "skip", label: "Skip", sub: "Pass on one Q", price: 2, color: "#FB72FF", icon: ASSETS.powerupSkip },
  { id: "shield", label: "Shield", sub: "Protect 1 streak", price: 2, color: "#00CFF2", icon: ASSETS.powerupShield },
];

const COSMETICS: Cosmetic[] = [
  { id: "frame-gold", label: "Gold Frame", type: "Avatar frame", price: 8, color: "#FFC931", owned: false },
  { id: "name-pink", label: "Pink Name", type: "Name color", price: 6, color: "#FB72FF", owned: false },
  { id: "emote-waffle", label: "Waffle Emote", type: "Emote", price: 4, color: "#00CFF2", owned: true },
];

const BUNDLES: Bundle[] = [
  { count: 5, bonus: 0, price: "$0.99", badge: null },
  { count: 25, bonus: 5, price: "$3.99", badge: "POPULAR" },
  { count: 60, bonus: 20, price: "$7.99", badge: "BEST" },
];

// Cheapest bundle that covers the shortfall — used for the insufficient-tickets
// auto-suggest pivot. Falls back to the largest bundle if nothing covers it.
const suggestBundleFor = (shortfall: number): Bundle => {
  const fit = BUNDLES.find((b) => b.count + b.bonus >= shortfall);
  return fit ?? BUNDLES[BUNDLES.length - 1];
};

// ===== Flow state ==============================================================
// Each shop category has its own purchase flow with its own state machine.
// Modelling them as a discriminated union keeps the rendering switch tight.

type Flow =
  | null
  | { type: "cosmetic"; id: string }
  | { type: "bundle"; bundleIdx: number; phase: "confirm" | "processing" }
  | { type: "featured" }
  | { type: "shortfall"; intent: SpendIntent };

// `SpendIntent` is the abstract "I want to buy X for N tickets" — used by the
// shortfall pivot so we can resume the original purchase after a top-up.
type SpendIntent =
  | { kind: "powerup"; id: string }
  | { kind: "cosmetic"; id: string }
  | { kind: "featured" };

type Snackbar = { id: string; label: string; refundedAt?: number; onUndo: () => void };

// ===== Component ==============================================================

export const ShopScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;

  const [flow, setFlow] = useState<Flow>(null);
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);
  const [boostBanner, setBoostBanner] = useState<string | null>(null);
  const [equippedToast, setEquippedToast] = useState<string | null>(null);
  const [ticketCountUp, setTicketCountUp] = useState<{ from: number; to: number; key: number } | null>(null);

  // ---- Snackbar lifecycle (4-second auto-commit window for power-ups) -------
  // Power-up purchases commit balance immediately and show a 4s snackbar; if
  // the user taps UNDO during the window we refund. After 4s the snackbar
  // dismisses without further action.
  useEffect(() => {
    if (!snackbar || snackbar.refundedAt) return;
    const t = setTimeout(() => setSnackbar(null), 4000);
    return () => clearTimeout(t);
  }, [snackbar]);

  // After UNDO is tapped the snackbar shows "Refunded" briefly, then dismisses.
  useEffect(() => {
    if (!snackbar?.refundedAt) return;
    const t = setTimeout(() => setSnackbar(null), 1100);
    return () => clearTimeout(t);
  }, [snackbar]);

  useEffect(() => {
    if (!boostBanner) return;
    const t = setTimeout(() => setBoostBanner(null), 3000);
    return () => clearTimeout(t);
  }, [boostBanner]);

  useEffect(() => {
    if (!equippedToast) return;
    const t = setTimeout(() => setEquippedToast(null), 1800);
    return () => clearTimeout(t);
  }, [equippedToast]);

  // ---- Spend handlers --------------------------------------------------------

  const tryBuyPowerUp = (p: PowerUp) => {
    if (tickets < p.price) {
      setFlow({ type: "shortfall", intent: { kind: "powerup", id: p.id } });
      return;
    }
    // Commit immediately, queue the snackbar with an undo handler that refunds.
    proto.update({ tickets: tickets - p.price });
    setSnackbar({
      id: `pu-${p.id}-${Date.now()}`,
      label: `${p.label} purchased`,
      onUndo: () => {
        // Use a fresh state read via proto.update's functional patch.
        proto.update((s) => ({ tickets: s.tickets + p.price }));
        setSnackbar((sb) => (sb ? { ...sb, label: "Refunded", refundedAt: Date.now(), onUndo: () => {} } : sb));
      },
    });
  };

  const tryOpenCosmetic = (c: Cosmetic) => {
    if (c.owned) {
      // Owned cosmetics open a preview-only sheet (same UI, no Confirm button).
      setFlow({ type: "cosmetic", id: c.id });
      return;
    }
    if (tickets < c.price) {
      setFlow({ type: "shortfall", intent: { kind: "cosmetic", id: c.id } });
      return;
    }
    setFlow({ type: "cosmetic", id: c.id });
  };

  const tryOpenFeatured = () => {
    if (tickets < FEATURED.price) {
      setFlow({ type: "shortfall", intent: { kind: "featured" } });
      return;
    }
    setFlow({ type: "featured" });
  };

  const confirmCosmetic = (c: Cosmetic) => {
    proto.update({ tickets: tickets - c.price });
    setEquippedToast(`${c.label} equipped`);
    setFlow(null);
  };

  const confirmFeatured = () => {
    proto.update({ tickets: tickets - FEATURED.price });
    setBoostBanner(`${FEATURED.title} active — ${FEATURED.benefits[0]}`);
    setFlow(null);
  };

  const beginBundleCheckout = (idx: number) => {
    setFlow({ type: "bundle", bundleIdx: idx, phase: "confirm" });
  };

  const confirmBundle = (b: Bundle) => {
    setFlow({ type: "bundle", bundleIdx: BUNDLES.indexOf(b), phase: "processing" });
    // Simulated payment processing — short shimmer before the success state.
    const before = tickets;
    setTimeout(() => {
      const total = b.count + b.bonus;
      proto.update({ tickets: before + total });
      setTicketCountUp({ from: before, to: before + total, key: Date.now() });
      setFlow(null);
    }, 750);
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 240, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.18), transparent 60%)" }} />

      <TopHeader tickets={tickets} title="SHOP" />

      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 80, padding: "4px 14px 14px", overflow: "auto" }}>
        {/* Featured offer card */}
        <button
          type="button"
          onClick={tryOpenFeatured}
          aria-label={`Featured offer — ${FEATURED.title} for ${FEATURED.price} tickets`}
          style={{
            background: `linear-gradient(135deg, ${FEATURED.accent}33, #0F0F10 70%)`,
            border: `1px solid ${FEATURED.accent}55`,
            borderRadius: 18,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
            boxShadow: `0 0 30px ${FEATURED.accent}22`,
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div style={{ width: 62, height: 62, borderRadius: 14, background: `${FEATURED.accent}25`, border: `1.5px solid ${FEATURED.accent}66`, display: "flex", alignItems: "center", justifyContent: "center", color: FEATURED.accent, fontFamily: "Archivo Black", fontSize: 22, flexShrink: 0 }}>2×</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: FEATURED.accent, letterSpacing: 1.4 }}>FEATURED · ENDS IN {FEATURED.endsIn.toUpperCase()}</div>
            <div style={{ fontFamily: "Archivo Black", fontSize: 18, color: "#fff", lineHeight: 1.05, marginTop: 2 }}>{FEATURED.title}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{FEATURED.sub}</div>
          </div>
          <div style={{ background: FEATURED.accent, color: "#1e1e1e", padding: "8px 12px", borderRadius: 10, fontFamily: "Archivo Black", fontSize: 13, letterSpacing: 0.3, boxShadow: "0 3px 0 rgba(0,0,0,.3)", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <TicketIcon size={14} />{FEATURED.price}
          </div>
        </button>

        <SectionLabel>POWER-UPS</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {POWER_UPS.map((p) => (
            <PowerUpCard key={p.id} item={p} affordable={tickets >= p.price} onBuy={() => tryBuyPowerUp(p)} />
          ))}
        </div>

        <SectionLabel>COSMETICS</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {COSMETICS.map((c) => (
            <CosmeticRow key={c.id} item={c} affordable={tickets >= c.price} onOpen={() => tryOpenCosmetic(c)} />
          ))}
        </div>

        <SectionLabel>TICKETS</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {BUNDLES.map((b, i) => (
            <BundleCard key={i} bundle={b} onBuy={() => beginBundleCheckout(i)} />
          ))}
        </div>
      </div>

      <div className="bottom-bar">
        <TabBar active="shop" />
      </div>

      {/* Per-flow overlays */}
      {flow?.type === "cosmetic" && (() => {
        const c = COSMETICS.find((x) => x.id === flow.id)!;
        return <CosmeticSheet item={c} canAfford={tickets >= c.price} onClose={() => setFlow(null)} onConfirm={() => confirmCosmetic(c)} />;
      })()}
      {flow?.type === "bundle" && (() => {
        const b = BUNDLES[flow.bundleIdx];
        return (
          <BundleSheet
            bundle={b}
            phase={flow.phase}
            onClose={() => setFlow(null)}
            onConfirm={() => confirmBundle(b)}
          />
        );
      })()}
      {flow?.type === "featured" && (
        <FeaturedSheet
          featured={FEATURED}
          canAfford={tickets >= FEATURED.price}
          onClose={() => setFlow(null)}
          onConfirm={confirmFeatured}
        />
      )}
      {flow?.type === "shortfall" && (
        <ShortfallSheet
          intent={flow.intent}
          haveTickets={tickets}
          onClose={() => setFlow(null)}
          onTopUp={(idx) => beginBundleCheckout(idx)}
        />
      )}

      {/* Snackbar (power-up undo) */}
      {snackbar && (
        <Snack
          label={snackbar.label}
          showUndo={!snackbar.refundedAt}
          onUndo={snackbar.onUndo}
        />
      )}

      {/* Featured boost banner — pinned at top after activation */}
      {boostBanner && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            background: "linear-gradient(180deg, var(--berry), #c64fc8)",
            color: "var(--frame)",
            border: "2px solid var(--frame)",
            borderRadius: 14,
            padding: "12px 14px",
            boxShadow: "0 4px 0 var(--frame)",
            zIndex: 60,
            animation: "waffles-v2-tile-enter 280ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div style={{ fontFamily: "Archivo Black", fontSize: 11, letterSpacing: 1.4 }}>BOOST ACTIVE</div>
          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 2 }}>{boostBanner}</div>
        </div>
      )}

      {/* Equipped toast — small confirmation after a cosmetic purchase */}
      {equippedToast && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: "44%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--maple-500)",
            color: "var(--frame)",
            padding: "14px 22px",
            borderRadius: 16,
            border: "2px solid var(--frame)",
            boxShadow: "0 6px 0 var(--frame)",
            fontFamily: "Archivo Black",
            fontSize: 14,
            letterSpacing: 0.4,
            zIndex: 60,
            animation: "waffles-v2-tile-enter 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div style={{ fontSize: 24, textAlign: "center", marginBottom: 4 }}>✓</div>
          {equippedToast}
        </div>
      )}

      {/* Ticket count-up after a bundle purchase clears */}
      {ticketCountUp && <TicketCountUp from={ticketCountUp.from} to={ticketCountUp.to} key={ticketCountUp.key} onDone={() => setTicketCountUp(null)} />}

      {/* Cosmetic / featured / bundle success confetti is rendered inside their
          sheets; bundle additionally fires confetti after sheet dismiss for
          the count-up moment. */}
      {ticketCountUp && <Confetti pieces={48} />}
    </Phone>
  );
};

// ===== Catalog cards ===========================================================

const PowerUpCard = ({ item, affordable, onBuy }: { item: PowerUp; affordable: boolean; onBuy: () => void }) => {
  const [committed, setCommitted] = useState(false);
  const click = () => {
    if (!affordable) {
      onBuy();
      return;
    }
    onBuy();
    setCommitted(true);
    setTimeout(() => setCommitted(false), 350);
  };
  return (
    <div style={{ background: "#0F0F10", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}1e`, border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <PixelImg src={item.icon} size={28} alt="" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#fff", lineHeight: 1 }}>{item.label}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{item.sub}</div>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Buy ${item.label} for ${item.price} tickets`}
        onClick={click}
        style={{
          background: committed ? "rgba(0, 207, 242, 0.25)" : affordable ? "rgba(255,201,49,.1)" : "rgba(253,251,246,0.04)",
          border: `1px solid ${committed ? "var(--leaf)" : affordable ? "rgba(255,201,49,.3)" : "rgba(253,251,246,0.08)"}`,
          color: committed ? "var(--leaf)" : affordable ? "#FFC931" : "var(--ink-faint)",
          borderRadius: 8,
          padding: "6px 0",
          fontFamily: "Archivo Black",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          cursor: "pointer",
          transition: "transform 120ms cubic-bezier(0.22, 1, 0.36, 1), background 160ms ease, color 160ms ease",
          transform: committed ? "scale(1.04)" : "scale(1)",
        }}
      >
        {committed ? "✓" : (<><TicketIcon size={13} />{item.price}</>)}
      </button>
    </div>
  );
};

const CosmeticRow = ({ item, affordable, onOpen }: { item: Cosmetic; affordable: boolean; onOpen: () => void }) => (
  <button
    type="button"
    aria-label={`${item.label} — ${item.owned ? "owned, preview" : `buy for ${item.price} tickets`}`}
    onClick={onOpen}
    style={{
      background: "#0F0F10",
      border: "1px solid rgba(255,255,255,.06)",
      borderRadius: 12,
      padding: "10px 12px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      cursor: "pointer",
      width: "100%",
      textAlign: "left",
    }}
  >
    <div style={{ width: 48, height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <CosmeticGlyph item={item} size={48} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "#fff", lineHeight: 1 }}>{item.label}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{item.type}</div>
    </div>
    {item.owned ? (
      <div style={{ background: "rgba(0,207,242,.12)", border: "1px solid rgba(0,207,242,.35)", color: "#00CFF2", borderRadius: 8, padding: "6px 12px", fontFamily: "Archivo Black", fontSize: 11 }}>OWNED</div>
    ) : (
      <div
        style={{
          background: affordable ? "#FFC931" : "rgba(255,201,49,0.25)",
          color: affordable ? "#1e1e1e" : "var(--ink-faint)",
          padding: "7px 12px",
          borderRadius: 8,
          fontFamily: "Archivo Black",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 5,
          boxShadow: affordable ? "0 3px 0 rgba(0,0,0,.25)" : undefined,
        }}
      >
        <TicketIcon size={13} color={affordable ? "#1e1e1e" : undefined} />{item.price}
      </div>
    )}
  </button>
);

const BundleCard = ({ bundle, onBuy }: { bundle: Bundle; onBuy: () => void }) => (
  <div style={{ background: "#0F0F10", border: bundle.badge ? "1.5px solid rgba(255,201,49,.4)" : "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 6px", textAlign: "center", position: "relative", boxShadow: bundle.badge ? "0 0 20px rgba(255,201,49,.1)" : "none" }}>
    {bundle.badge && <div style={{ position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)", background: "#FFC931", color: "#1e1e1e", padding: "2px 8px", borderRadius: 99, fontFamily: "Archivo Black", fontSize: 8, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{bundle.badge}</div>}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 4 }}>
      <TicketIcon size={20} />
      <span style={{ fontFamily: "Archivo Black", fontSize: 18, color: "#fff" }}>{bundle.count}</span>
    </div>
    {bundle.bonus > 0 ? (
      <div style={{ fontSize: 9, fontWeight: 800, color: "#00CFF2", marginTop: 1 }}>+{bundle.bonus} BONUS</div>
    ) : (
      <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.3)", marginTop: 1 }}>—</div>
    )}
    <button
      type="button"
      onClick={onBuy}
      aria-label={`Buy ${bundle.count + bundle.bonus} tickets for ${bundle.price}`}
      style={{ marginTop: 6, width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", borderRadius: 8, padding: "5px 0", fontFamily: "Archivo Black", fontSize: 11, cursor: "pointer" }}
    >
      {bundle.price}
    </button>
  </div>
);

// ===== Cosmetic preview composer ==============================================
// Renders Wally with the cosmetic actually applied — this is the "preview
// moment" that justifies the ceremony of opening a sheet for cosmetic buys.

const CosmeticGlyph = ({ item, size }: { item: Cosmetic; size: number }) => {
  if (item.id === "frame-gold") {
    return <div style={{ width: size * 0.7, height: size * 0.7, borderRadius: 99, border: `${Math.max(2, size * 0.06)}px solid ${item.color}`, background: "var(--surface-2)" }} />;
  }
  if (item.id === "name-pink") {
    return <div style={{ fontFamily: "var(--font-display)", fontSize: size * 0.45, color: item.color }}>Aa</div>;
  }
  return <PixelImg src={ASSETS.wally} size={size} alt="" />;
};

const WallyPreview = ({ item, applied }: { item: Cosmetic; applied: boolean }) => {
  // Composes Wally with the cosmetic. `applied=false` shows the bare avatar
  // for the "before" half of the toggle.
  const wallySize = 110;
  return (
    <div style={{ position: "relative", width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Pedestal glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 12,
          transform: "translateX(-50%)",
          width: 160,
          height: 22,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${item.color}55, transparent 70%)`,
          filter: "blur(6px)",
        }}
      />
      {/* Frame ring (Gold Frame cosmetic) */}
      {item.id === "frame-gold" && applied && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: wallySize + 30,
            height: wallySize + 30,
            borderRadius: "50%",
            border: `5px solid ${item.color}`,
            boxShadow: `0 0 0 2px var(--frame), 0 0 24px ${item.color}66`,
          }}
        />
      )}
      <PixelImg src={ASSETS.wally} size={wallySize} alt="Wally" style={{ position: "relative", zIndex: 2 }} />

      {/* Pink name plate (Pink Name cosmetic) */}
      {item.id === "name-pink" && (
        <div
          style={{
            position: "absolute",
            bottom: -4,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "Archivo Black",
            fontSize: 18,
            color: applied ? item.color : "var(--ink-soft)",
            textShadow: applied ? `0 0 18px ${item.color}88` : "none",
            letterSpacing: 0.4,
            zIndex: 3,
          }}
        >
          @you
        </div>
      )}

      {/* Waffle emote bubble (Waffle Emote cosmetic) */}
      {item.id === "emote-waffle" && applied && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 0,
            background: "var(--cream-pure)",
            border: "2px solid var(--frame)",
            borderRadius: 14,
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            boxShadow: "0 3px 0 var(--frame)",
            zIndex: 3,
          }}
        >
          <PixelImg src={ASSETS.wally} size={26} alt="" />
          <span style={{ fontFamily: "Archivo Black", fontSize: 12, color: "var(--frame)" }}>!</span>
        </div>
      )}
    </div>
  );
};

// ===== Sheets ==================================================================

const Backdrop = ({ onClick }: { onClick: () => void }) => (
  <div
    role="presentation"
    onClick={onClick}
    style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 20 }}
  />
);

const SheetShell = ({ accent, children, ariaLabel }: { accent: string; children: React.ReactNode; ariaLabel: string }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      background: "var(--surface-1)",
      borderTop: `2px solid ${accent}`,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: "20px 18px max(20px, env(safe-area-inset-bottom))",
      zIndex: 21,
      animation: "waffles-v2-tile-enter 280ms cubic-bezier(0.22, 1, 0.36, 1)",
    }}
  >
    <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(253, 251, 246, 0.2)", margin: "0 auto 14px" }} />
    {children}
  </div>
);

// ----- Cosmetic sheet (preview + buy) -----

const CosmeticSheet = ({ item, canAfford, onClose, onConfirm }: { item: Cosmetic; canAfford: boolean; onClose: () => void; onConfirm: () => void }) => {
  const [view, setView] = useState<"after" | "before">("after");
  const [bursting, setBursting] = useState(false);
  const onBuy = () => {
    setBursting(true);
    setTimeout(() => {
      onConfirm();
      setBursting(false);
    }, 420);
  };
  const isOwned = item.owned;
  return (
    <>
      <Backdrop onClick={onClose} />
      <SheetShell accent={item.color} ariaLabel={isOwned ? `${item.label} preview` : `Buy ${item.label}`}>
        {bursting && <Confetti pieces={28} />}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
          <WallyPreview item={item} applied={view === "after"} />
        </div>
        {/* Before / After toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div role="tablist" aria-label="Preview toggle" style={{ display: "inline-flex", background: "var(--surface-2)", border: "1px solid rgba(253,251,246,0.06)", padding: 3, borderRadius: 99 }}>
            {(["before", "after"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                style={{
                  background: view === v ? item.color : "transparent",
                  color: view === v ? "var(--frame)" : "var(--ink-soft)",
                  border: "none",
                  fontFamily: "Archivo Black",
                  fontSize: 11,
                  letterSpacing: 0.6,
                  padding: "6px 14px",
                  borderRadius: 99,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 1, textTransform: "uppercase" }}>{item.type}</div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 22, color: "var(--ink)", marginTop: 2 }}>{item.label}</div>
        </div>

        {!isOwned && (
          <div style={{ background: "var(--surface-2)", border: "1px solid rgba(253,251,246,0.06)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", letterSpacing: 0.4, textTransform: "uppercase" }}>Cost</span>
            <span style={{ fontFamily: "Archivo Black", fontSize: 16, color: item.color, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <TicketIcon size={18} />
              {item.price} ticket{item.price === 1 ? "" : "s"}
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={cancelBtnStyle}
          >
            {isOwned ? "CLOSE" : "CANCEL"}
          </button>
          {!isOwned && (
            <button
              type="button"
              onClick={onBuy}
              disabled={!canAfford}
              style={{
                ...primaryBtnStyle,
                background: canAfford ? item.color : "var(--surface-3)",
                color: canAfford ? "var(--frame)" : "var(--ink-faint)",
                cursor: canAfford ? "pointer" : "not-allowed",
              }}
            >
              EQUIP &amp; BUY
            </button>
          )}
        </div>
      </SheetShell>
    </>
  );
};

// ----- Bundle sheet (themed receipt) -----

const BundleSheet = ({ bundle, phase, onClose, onConfirm }: { bundle: Bundle; phase: "confirm" | "processing"; onClose: () => void; onConfirm: () => void }) => {
  const total = bundle.count + bundle.bonus;
  const accent = "#FFC931";
  return (
    <>
      <Backdrop onClick={phase === "processing" ? () => {} : onClose} />
      <SheetShell accent={accent} ariaLabel={`Buy ${total} tickets for ${bundle.price}`}>
        {/* Hero */}
        <div style={{ position: "relative", display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div
            style={{
              background: `linear-gradient(180deg, ${accent}33, ${accent}0a)`,
              border: `1.5px solid ${accent}66`,
              borderRadius: 18,
              padding: "16px 24px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <TicketIcon size={48} />
            <div>
              <div style={{ fontFamily: "Archivo Black", fontSize: 32, color: "var(--ink)", lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2 }}>Tickets</div>
            </div>
          </div>
        </div>

        {/* Receipt */}
        <div style={{ background: "var(--surface-2)", border: "1px solid rgba(253,251,246,0.06)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, color: "var(--ink)" }}>
          <ReceiptRow label="Tickets" value={`${bundle.count}`} />
          {bundle.bonus > 0 && <ReceiptRow label="Bonus" value={`+${bundle.bonus}`} valueColor="var(--leaf)" />}
          <div style={{ height: 1, background: "rgba(253,251,246,0.08)", margin: "8px 0" }} />
          <ReceiptRow label="Total" value={`${total} 🎟`} bold />
          <ReceiptRow label="Pay" value={bundle.price} bold valueColor={accent} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {phase === "confirm" ? (
            <>
              <button type="button" onClick={onClose} style={cancelBtnStyle}>CANCEL</button>
              <button
                type="button"
                onClick={onConfirm}
                style={{ ...primaryBtnStyle, background: accent, color: "var(--frame)" }}
                aria-label={`Pay ${bundle.price} for ${total} tickets`}
              >
                PAY {bundle.price}
              </button>
            </>
          ) : (
            <div
              role="status"
              aria-live="polite"
              style={{
                flex: 1,
                background: accent,
                color: "var(--frame)",
                border: "2px solid var(--frame)",
                borderRadius: 12,
                padding: "12px 0",
                fontFamily: "Archivo Black",
                fontSize: 14,
                letterSpacing: 0.4,
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 4px 0 var(--frame)",
              }}
            >
              <span style={{ position: "relative", zIndex: 1 }}>PROCESSING…</span>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  animation: "waffles-v2-shimmer 900ms linear infinite",
                }}
              />
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--ink-faint)", letterSpacing: 0.4 }}>
          Prototype — no real charge
        </div>
      </SheetShell>
    </>
  );
};

const ReceiptRow = ({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
    <span style={{ color: bold ? "var(--ink)" : "var(--ink-soft)", fontWeight: bold ? 800 : 500 }}>{label}</span>
    <span style={{ color: valueColor ?? (bold ? "var(--ink)" : "var(--ink-soft)"), fontWeight: bold ? 800 : 500 }}>{value}</span>
  </div>
);

// ----- Featured sheet (hype) -----

const FeaturedSheet = ({ featured, canAfford, onClose, onConfirm }: { featured: Featured; canAfford: boolean; onClose: () => void; onConfirm: () => void }) => {
  const [bursting, setBursting] = useState(false);
  const onActivate = () => {
    setBursting(true);
    setTimeout(() => {
      onConfirm();
      setBursting(false);
    }, 480);
  };
  return (
    <>
      <Backdrop onClick={onClose} />
      <SheetShell accent={featured.accent} ariaLabel={`Activate ${featured.title} for ${featured.price} tickets`}>
        {bursting && <Confetti pieces={36} />}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ position: "relative", width: 92, height: 92, borderRadius: 22, background: `radial-gradient(circle, ${featured.accent}55, ${featured.accent}11 70%)`, border: `2px solid ${featured.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 38, color: featured.accent, boxShadow: `0 0 36px ${featured.accent}55` }}>
            2×
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: featured.accent, letterSpacing: 1.6 }}>FEATURED · ENDS IN {featured.endsIn.toUpperCase()}</div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 26, color: "var(--ink)", marginTop: 4, letterSpacing: 0.4 }}>{featured.title}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", marginTop: 2 }}>{featured.sub}</div>
        </div>

        {/* Benefit stack */}
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {featured.benefits.map((b, i) => (
            <li
              key={i}
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(253,251,246,0.06)",
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 99, background: `${featured.accent}30`, color: featured.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Archivo Black", fontSize: 13, flexShrink: 0 }}>✓</span>
              {b}
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>NOT NOW</button>
          <button
            type="button"
            onClick={onActivate}
            disabled={!canAfford}
            style={{
              ...primaryBtnStyle,
              background: canAfford ? featured.accent : "var(--surface-3)",
              color: canAfford ? "var(--frame)" : "var(--ink-faint)",
              cursor: canAfford ? "pointer" : "not-allowed",
              display: "inline-flex",
              gap: 6,
            }}
          >
            ACTIVATE — <TicketIcon size={14} />{featured.price}
          </button>
        </div>
      </SheetShell>
    </>
  );
};

// ----- Shortfall pivot sheet -----

const ShortfallSheet = ({ intent, haveTickets, onClose, onTopUp }: { intent: SpendIntent; haveTickets: number; onClose: () => void; onTopUp: (idx: number) => void }) => {
  const need =
    intent.kind === "powerup" ? POWER_UPS.find((p) => p.id === intent.id)!.price :
    intent.kind === "cosmetic" ? COSMETICS.find((c) => c.id === intent.id)!.price :
    FEATURED.price;
  const itemLabel =
    intent.kind === "powerup" ? POWER_UPS.find((p) => p.id === intent.id)!.label :
    intent.kind === "cosmetic" ? COSMETICS.find((c) => c.id === intent.id)!.label :
    FEATURED.title;
  const shortfall = need - haveTickets;
  const suggested = suggestBundleFor(shortfall);
  const suggestedIdx = BUNDLES.indexOf(suggested);
  return (
    <>
      <Backdrop onClick={onClose} />
      <SheetShell accent="#FFC931" ariaLabel={`Need more tickets to buy ${itemLabel}`}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 26, marginBottom: 4 }}>🎟</div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 20, color: "var(--ink)" }}>Need {shortfall} more ticket{shortfall === 1 ? "" : "s"}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginTop: 4 }}>You have {haveTickets} · {itemLabel} costs {need}</div>
        </div>

        <div style={{ background: "var(--surface-2)", border: "1.5px solid var(--maple-500)", borderRadius: 14, padding: "14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 12, background: "rgba(255,201,49,0.18)", border: "1px solid rgba(255,201,49,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <TicketIcon size={22} />
            <span style={{ fontFamily: "Archivo Black", fontSize: 16, color: "var(--ink)" }}>{suggested.count + suggested.bonus}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 1, textTransform: "uppercase" }}>Quick top up</div>
            <div style={{ fontFamily: "Archivo Black", fontSize: 14, color: "var(--ink)", marginTop: 2 }}>{suggested.count + suggested.bonus} tickets · {suggested.price}</div>
            {suggested.bonus > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--leaf)", marginTop: 2 }}>Includes {suggested.bonus} bonus</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>CANCEL</button>
          <button
            type="button"
            onClick={() => onTopUp(suggestedIdx)}
            style={{ ...primaryBtnStyle, background: "var(--maple-500)", color: "var(--frame)" }}
          >
            TOP UP
          </button>
        </div>
      </SheetShell>
    </>
  );
};

// ----- Snackbar (power-up undo) -----

const Snack = ({ label, showUndo, onUndo }: { label: string; showUndo: boolean; onUndo: () => void }) => (
  <div
    role="status"
    aria-live="polite"
    style={{
      position: "absolute",
      bottom: "calc(64px + max(12px, env(safe-area-inset-bottom)) + 12px)",
      left: 14,
      right: 14,
      background: "var(--frame)",
      color: "var(--ink)",
      borderRadius: 12,
      padding: "10px 14px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      zIndex: 40,
      animation: "waffles-v2-tile-enter 240ms cubic-bezier(0.22, 1, 0.36, 1)",
      border: "1.5px solid var(--maple-500)",
      overflow: "hidden",
    }}
  >
    <span style={{ flex: 1, fontFamily: "Archivo Black", fontSize: 12, letterSpacing: 0.4 }}>{label}</span>
    {showUndo && (
      <button
        type="button"
        onClick={onUndo}
        style={{
          background: "var(--maple-500)",
          color: "var(--frame)",
          border: "none",
          fontFamily: "Archivo Black",
          fontSize: 11,
          letterSpacing: 0.6,
          padding: "5px 12px",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        UNDO
      </button>
    )}
    {/* 4-second progress bar visualises the undo grace period */}
    {showUndo && (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 2,
          background: "var(--maple-500)",
          animation: "waffles-v2-snackbar-progress 4s linear forwards",
          width: "100%",
          transformOrigin: "right center",
        }}
      />
    )}
  </div>
);

// ----- Ticket count-up after bundle purchase -----

const TicketCountUp = ({ from, to, onDone }: { from: number; to: number; onDone: () => void }) => {
  const [v, setV] = useState(from);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const dur = 1100;
    const tick = (t: number) => {
      if (startedAt.current === null) startedAt.current = t;
      const elapsed = t - startedAt.current;
      const p = Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (to - from) * eased));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(onDone, 600);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, onDone]);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        top: "40%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "var(--surface-1)",
        border: "2px solid var(--maple-500)",
        borderRadius: 18,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 6px 0 var(--frame), 0 0 60px rgba(255,201,49,0.35)",
        zIndex: 60,
        animation: "waffles-v2-tile-enter 280ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <TicketIcon size={36} />
      <div>
        <div style={{ fontFamily: "Archivo Black", fontSize: 24, color: "var(--maple-500)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v}</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 }}>Tickets</div>
      </div>
    </div>
  );
};

// ===== Shared button styles ===================================================

const cancelBtnStyle: CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "2px solid var(--frame)",
  color: "var(--ink)",
  fontFamily: "Nunito",
  fontWeight: 900,
  fontSize: 14,
  padding: "12px 0",
  borderRadius: 12,
  cursor: "pointer",
  letterSpacing: 0.3,
};

const primaryBtnStyle: CSSProperties = {
  flex: 1.4,
  border: "2px solid var(--frame)",
  fontFamily: "Nunito",
  fontWeight: 900,
  fontSize: 14,
  padding: "12px 0",
  borderRadius: 12,
  cursor: "pointer",
  letterSpacing: 0.3,
  boxShadow: "0 4px 0 var(--frame)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};
