"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { FIRST_TICKET_DISCOUNT, isFirstTicketOfferAvailable, markFirstTicketOfferUsed, syrupLabel, TOURNAMENT_TICKET_COST, usdtLabel, useProto, USDT_PER_TICKET } from "../state";
import { ASSETS, AssetWell, Button, Card, Confetti, GameLoader, InfoButton, Phone, PixelImg, Sheet, SyrupIcon, TabBar, TicketIcon, TopHeader } from "../shared";
import { playSound } from "../sound";
import { buyBundle, getShopCatalog, purchase } from "@/actions/player";
import type { ShopCatalog } from "@/lib/player/economy";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";
import { useUser } from "@/hooks/useUser";

const TICKET_INFO = `Syrup is earned by playing — daily rewards, levels and missions. Spend it on lives, power-ups for solo levels, and cosmetics. Tournaments are entered with USDC and prizes are paid in USDT from your Prize Wallet.`;

// ===== Catalog =================================================================
// Prices/labels/ownership come from the DB via getShopCatalog — the single
// source of truth, so the price shown is always the price charged. Only the bits
// the DB doesn't hold live here: power-up icons (client assets) and the FEATURED
// card's marketing copy, both keyed by slug.

type PowerUp = { id: string; label: string; sub: string; price: number; color: string; icon: string };
type Cosmetic = { id: string; label: string; type: string; price: number; color: string; owned: boolean };
type Bundle = { count: number; bonus: number; price: string; badge: string | null };
type Featured = { title: string; sub: string; price: number; accent: string; benefits: string[]; endsIn: string };

// Power-up icons are client assets (not in the DB), keyed by catalog slug.
const POWERUP_ICON: Record<string, string> = {
  "pu-5050": ASSETS.powerup5050,
  "pu-time": ASSETS.powerupTime,
  "pu-skip": ASSETS.powerupSkip,
  "pu-shield": ASSETS.powerupShield,
};

// Marketing copy for the FEATURED card (presentation only — not in the DB).
const FEATURED_PRESENTATION = {
  accent: "#FB72FF",
  benefits: ["2× XP on the next 3 tournaments", "Stacks with daily missions", "Streak counter still ticks"],
  endsIn: "1d 22h",
};

type BuiltCatalog = { powerUps: PowerUp[]; cosmetics: Cosmetic[]; bundles: Bundle[]; featured: Featured | null };

// Map the DB catalog rows into the render-ready shapes, merging in the
// client-only presentation (icons + featured marketing).
function buildCatalog(cat: ShopCatalog): BuiltCatalog {
  const powerUps: PowerUp[] = [];
  const cosmetics: Cosmetic[] = [];
  const bundles: Bundle[] = [];
  let featured: Featured | null = null;
  for (const it of cat.items) {
    if (it.kind === "POWERUP") {
      powerUps.push({ id: it.slug.replace(/^pu-/, ""), label: it.label, sub: it.sub ?? "", price: it.priceTickets ?? 0, color: it.color ?? "#00CFF2", icon: POWERUP_ICON[it.slug] ?? ASSETS.powerup5050 });
    } else if (it.kind === "COSMETIC") {
      cosmetics.push({ id: it.slug, label: it.label, type: it.sub ?? "", price: it.priceTickets ?? 0, color: it.color ?? "#FFC931", owned: cat.ownedCosmetics.includes(it.slug) });
    } else if (it.kind === "BUNDLE") {
      const p = (it.payload ?? {}) as { count?: number; bonus?: number };
      bundles.push({ count: p.count ?? 0, bonus: p.bonus ?? 0, price: `$${(it.priceFiat ?? 0).toFixed(2)}`, badge: it.sub });
    } else if (it.kind === "FEATURED") {
      featured = { title: it.label, sub: it.sub ?? "", price: it.priceTickets ?? 0, ...FEATURED_PRESENTATION };
    }
  }
  return { powerUps, cosmetics, bundles, featured };
}

// Cheapest bundle that covers the shortfall — used for the insufficient-tickets
// auto-suggest pivot. Falls back to the largest bundle if nothing covers it.
const suggestBundleFor = (bundles: Bundle[], shortfall: number): Bundle => {
  const fit = bundles.find((b) => b.count + b.bonus >= shortfall);
  return fit ?? bundles[bundles.length - 1];
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

type Snackbar = { id: string; label: string; slug?: string; refundedAt?: number; onUndo: () => void };

// ===== Component ==============================================================

export const ShopScreen = () => {
  const proto = useProto();
  const tickets = proto.tickets;
  const { user } = useUser();
  const authedUserId = user?.id ?? null;

  const [flow, setFlow] = useState<Flow>(null);
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);
  const [boostBanner, setBoostBanner] = useState<string | null>(null);
  const [equippedToast, setEquippedToast] = useState<string | null>(null);
  const [ticketCountUp, setTicketCountUp] = useState<{ from: number; to: number; key: number } | null>(null);
  const firstTicketViewedRef = useRef(false);

  // Catalog (prices/labels/ownership) from the DB — the single source of truth.
  // Built into the render shapes once loaded; empty while fetching (the screen
  // shows a loader until `catalog` resolves, below).
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  // Wait for the shared user query before fetching. Calling the server action
  // before the session cookie is ready returns null, which created a visible
  // retry delay on first Shop navigation.
  const [loadError, setLoadError] = useState(false);
  const reqId = useRef(0);
  const fetchCatalog = useCallback(() => {
    if (!authedUserId) return;
    const id = ++reqId.current;
    setLoadError(false);
    getShopCatalog()
      .then((c) => {
        if (id !== reqId.current) return;
        if (c) setCatalog(c);
        else setLoadError(true);
      })
      .catch(() => {
        if (id !== reqId.current) return;
        setLoadError(true);
      });
  }, [authedUserId]);
  useEffect(() => {
    if (!authedUserId) return;
    const ref = reqId;
    fetchCatalog();
    // Invalidate any in-flight attempt / pending retry on unmount.
    return () => { ref.current++; };
  }, [authedUserId, fetchCatalog]);
  const built = useMemo<BuiltCatalog>(
    () => (catalog ? buildCatalog(catalog) : { powerUps: [], cosmetics: [], bundles: [], featured: null }),
    [catalog],
  );
  const { powerUps, cosmetics, bundles, featured } = built;

  // First-timer half-price ticket offer (client-read, hydration-safe). Hidden
  // locally the moment it's bought, since localStorage changes don't re-notify.
  const firstTicketOffer = useSyncExternalStore(() => () => {}, isFirstTicketOfferAvailable, () => false);
  const [offerHidden, setOfferHidden] = useState(false);
  const showFirstTicketOffer = firstTicketOffer && !offerHidden;
  useEffect(() => {
    trackClientEvent(AnalyticsEvent.ShopViewed, {
      screen: "shop",
      tickets_balance: tickets,
      first_ticket_offer_available: showFirstTicketOffer,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showFirstTicketOffer || firstTicketViewedRef.current) return;
    firstTicketViewedRef.current = true;
    trackClientEvent(AnalyticsEvent.FirstTicketOfferViewed, {
      screen: "shop",
      tickets_balance: tickets,
      price_usdt: TOURNAMENT_TICKET_COST * (1 - FIRST_TICKET_DISCOUNT) * USDT_PER_TICKET,
      ticket_delta: TOURNAMENT_TICKET_COST,
    });
  }, [showFirstTicketOffer, tickets]);

  const buyFirstTicket = () => {
    trackClientEvent(AnalyticsEvent.FirstTicketOfferBuyClicked, {
      screen: "shop",
      tickets_before: tickets,
      price_usdt: TOURNAMENT_TICKET_COST * (1 - FIRST_TICKET_DISCOUNT) * USDT_PER_TICKET,
      ticket_delta: TOURNAMENT_TICKET_COST,
    });
    markFirstTicketOfferUsed();
    setOfferHidden(true);
    playSound("purchase");
    const before = tickets;
    proto.update({ tickets: before + TOURNAMENT_TICKET_COST }); // prototype — no real charge
    setTicketCountUp({ from: before, to: before + TOURNAMENT_TICKET_COST, key: Date.now() });
  };
  const eventSeq = useRef(0);
  const nextEventKey = () => {
    eventSeq.current += 1;
    return eventSeq.current;
  };

  // ---- Snackbar lifecycle (4-second auto-commit window for power-ups) -------
  // Power-up purchases commit balance immediately and show a 4s snackbar; if
  // the user taps UNDO during the window we refund. After 4s the snackbar
  // dismisses without further action.
  useEffect(() => {
    if (!snackbar || snackbar.refundedAt) return;
    const slug = snackbar.slug;
    const t = setTimeout(() => {
      // Final commit (undo window elapsed without a refund): persist the spend +
      // grant server-side. Deferring to here means no server refund is needed.
      if (slug) {
        void purchase(slug)
          .then((result) => {
            trackClientEvent(result?.ok ? AnalyticsEvent.ShopPurchaseSucceeded : AnalyticsEvent.ShopPurchaseFailed, {
              screen: "shop",
              sku: slug,
              item_kind: "powerup",
              reason: result?.ok ? null : result?.reason ?? "purchase_failed",
              tickets_after: result?.ok ? result.tickets : null,
            });
          })
          .catch((error) => {
            trackClientEvent(AnalyticsEvent.ShopPurchaseFailed, {
              screen: "shop",
              sku: slug,
              item_kind: "powerup",
              reason: error instanceof Error ? error.message : "purchase_failed",
            });
          });
      }
      setSnackbar(null);
    }, 4000);
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
      trackClientEvent(AnalyticsEvent.ShopPurchaseFailed, {
        screen: "shop",
        sku: `pu-${p.id}`,
        item_kind: "powerup",
        reason: "insufficient_tickets",
        price_tickets: p.price,
        tickets_before: tickets,
      });
      setFlow({ type: "shortfall", intent: { kind: "powerup", id: p.id } });
      return;
    }
    trackClientEvent(AnalyticsEvent.ShopPurchaseIntent, {
      screen: "shop",
      sku: `pu-${p.id}`,
      item_kind: "powerup",
      price_tickets: p.price,
      tickets_before: tickets,
    });
    // Commit immediately, queue the snackbar with an undo handler that refunds.
    playSound("purchase");
    proto.update({ tickets: tickets - p.price });
    setSnackbar({
      id: `pu-${p.id}-${nextEventKey()}`,
      label: `${p.label} purchased`,
      slug: `pu-${p.id}`,
      onUndo: () => {
        trackClientEvent(AnalyticsEvent.ShopPurchaseFailed, {
          screen: "shop",
          sku: `pu-${p.id}`,
          item_kind: "powerup",
          reason: "undo",
          price_tickets: p.price,
        });
        // Use a fresh state read via proto.update's functional patch.
        proto.update((s) => ({ tickets: s.tickets + p.price }));
        setSnackbar((sb) => (sb ? { ...sb, label: "Refunded", refundedAt: nextEventKey(), onUndo: () => {} } : sb));
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
      trackClientEvent(AnalyticsEvent.ShopPurchaseFailed, {
        screen: "shop",
        sku: c.id,
        item_kind: "cosmetic",
        reason: "insufficient_tickets",
        price_tickets: c.price,
        tickets_before: tickets,
      });
      setFlow({ type: "shortfall", intent: { kind: "cosmetic", id: c.id } });
      return;
    }
    trackClientEvent(AnalyticsEvent.ShopPurchaseIntent, {
      screen: "shop",
      sku: c.id,
      item_kind: "cosmetic",
      price_tickets: c.price,
      tickets_before: tickets,
    });
    setFlow({ type: "cosmetic", id: c.id });
  };

  const tryOpenFeatured = () => {
    if (!featured) return;
    if (tickets < featured.price) {
      trackClientEvent(AnalyticsEvent.ShopPurchaseFailed, {
        screen: "shop",
        sku: "boost-double-xp",
        item_kind: "featured",
        reason: "insufficient_tickets",
        price_tickets: featured.price,
        tickets_before: tickets,
      });
      setFlow({ type: "shortfall", intent: { kind: "featured" } });
      return;
    }
    trackClientEvent(AnalyticsEvent.ShopPurchaseIntent, {
      screen: "shop",
      sku: "boost-double-xp",
      item_kind: "featured",
      price_tickets: featured.price,
      tickets_before: tickets,
    });
    setFlow({ type: "featured" });
  };

  const confirmCosmetic = (c: Cosmetic) => {
    playSound("purchase");
    proto.update({ tickets: tickets - c.price });
    void purchase(c.id)
      .then((result) => {
        trackClientEvent(result?.ok ? AnalyticsEvent.ShopPurchaseSucceeded : AnalyticsEvent.ShopPurchaseFailed, {
          screen: "shop",
          sku: c.id,
          item_kind: "cosmetic",
          reason: result?.ok ? null : result?.reason ?? "purchase_failed",
          price_tickets: c.price,
          tickets_after: result?.ok ? result.tickets : tickets - c.price,
        });
      })
      .catch((error) => {
        trackClientEvent(AnalyticsEvent.ShopPurchaseFailed, {
          screen: "shop",
          sku: c.id,
          item_kind: "cosmetic",
          reason: error instanceof Error ? error.message : "purchase_failed",
        });
      }); // cosmetic slugs match the seeded catalog (frame-gold, …)
    setEquippedToast(`${c.label} equipped`);
    setFlow(null);
  };

  const confirmFeatured = () => {
    if (!featured) return;
    playSound("purchase");
    proto.update({ tickets: tickets - featured.price });
    void purchase("boost-double-xp")
      .then((result) => {
        trackClientEvent(result?.ok ? AnalyticsEvent.ShopPurchaseSucceeded : AnalyticsEvent.ShopPurchaseFailed, {
          screen: "shop",
          sku: "boost-double-xp",
          item_kind: "featured",
          reason: result?.ok ? null : result?.reason ?? "purchase_failed",
          price_tickets: featured.price,
          tickets_after: result?.ok ? result.tickets : tickets - featured.price,
        });
      })
      .catch((error) => {
        trackClientEvent(AnalyticsEvent.ShopPurchaseFailed, {
          screen: "shop",
          sku: "boost-double-xp",
          item_kind: "featured",
          reason: error instanceof Error ? error.message : "purchase_failed",
        });
      });
    setBoostBanner(`${featured.title} active — ${featured.benefits[0]}`);
    setFlow(null);
  };

  const beginBundleCheckout = (idx: number) => {
    const b = bundles[idx];
    trackClientEvent(AnalyticsEvent.ShopPurchaseIntent, {
      screen: "shop",
      sku: `bundle-${b.count}`,
      item_kind: "bundle",
      bundle_id: `bundle-${b.count}`,
      price_usdt: Number(b.price.replace(/^\$/, "")),
      ticket_delta: b.count + b.bonus,
      tickets_before: tickets,
    });
    setFlow({ type: "bundle", bundleIdx: idx, phase: "confirm" });
  };

  const confirmBundle = (b: Bundle) => {
    setFlow({ type: "bundle", bundleIdx: bundles.indexOf(b), phase: "processing" });
    // Simulated payment processing — short shimmer before the success state.
    const before = tickets;
    setTimeout(() => {
      const total = b.count + b.bonus;
      playSound("purchase");
      proto.update({ tickets: before + total });
      void buyBundle(`bundle-${b.count}`)
        .then((result) => {
          trackClientEvent(result ? AnalyticsEvent.ShopPurchaseSucceeded : AnalyticsEvent.ShopPurchaseFailed, {
            screen: "shop",
            sku: `bundle-${b.count}`,
            item_kind: "bundle",
            bundle_id: `bundle-${b.count}`,
            reason: result ? null : "bundle_unavailable",
            price_usdt: Number(b.price.replace(/^\$/, "")),
            ticket_delta: total,
            tickets_after: result?.tickets ?? before + total,
          });
        })
        .catch((error) => {
          trackClientEvent(AnalyticsEvent.ShopPurchaseFailed, {
            screen: "shop",
            sku: `bundle-${b.count}`,
            item_kind: "bundle",
            reason: error instanceof Error ? error.message : "bundle_failed",
          });
        }); // persist top-up (payment rail TBD)
      setTicketCountUp({ from: before, to: before + total, key: nextEventKey() });
      setFlow(null);
    }, 750);
  };

  // ---- Render ---------------------------------------------------------------

  // Hold the catalog-dependent UI until the DB catalog resolves (prices/labels
  // come from there now, so there's nothing meaningful to show before it loads).
  if (!catalog) {
    return (
      <Phone statusDark>
        <div className="bg-deep" />
        <TopHeader tickets={tickets} title="SHOP" />
        {loadError ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 32px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)" }}>Couldn’t load the shop</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", maxWidth: 260 }}>Check your connection and try again.</div>
            <Button onClick={fetchCatalog}>TRY AGAIN</Button>
          </div>
        ) : (
          <GameLoader />
        )}
        <div className="bottom-bar">
          <TabBar active="shop" />
        </div>
      </Phone>
    );
  }

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div style={{ position: "absolute", top: -40, left: -40, right: -40, height: 240, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.18), transparent 60%)" }} />

      <TopHeader tickets={tickets} title="SHOP" />

      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 80, padding: "4px 14px 14px", overflow: "auto" }}>
        {/* Balance — one compact row (the count, a label, and the help button). */}
        <Card accent="var(--maple-500)" radius={14} pad="10px 14px" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <SyrupIcon size={24} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "#fff", lineHeight: 1 }}>{tickets}</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.45)", letterSpacing: 0.8, textTransform: "uppercase" }}>Syrup</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.4)" }}>Your balance</span>
          <InfoButton title="Syrup" text={TICKET_INFO} size={18} />
        </Card>

        {/* Featured offer card */}
        {featured && (
        <>
        <ShopSectionLabel>FEATURED</ShopSectionLabel>
          <button
            type="button"
            onClick={tryOpenFeatured}
            aria-label={`Featured offer — ${featured.title} for ${syrupLabel(featured.price)}`}
            style={{
              background: `linear-gradient(135deg, ${featured.accent}33, #0F0F10 70%)`,
              border: `1px solid ${featured.accent}55`,
              borderRadius: 18,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: `0 0 30px ${featured.accent}22`,
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ width: 62, height: 62, borderRadius: 14, background: `${featured.accent}25`, border: `1.5px solid ${featured.accent}66`, display: "flex", alignItems: "center", justifyContent: "center", color: featured.accent, fontFamily: "var(--font-display)", fontSize: 22, flexShrink: 0 }}>2×</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: featured.accent, letterSpacing: 1.4 }}>FEATURED · ENDS IN {featured.endsIn.toUpperCase()}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff", lineHeight: 1.05, marginTop: 2 }}>{featured.title}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{featured.sub}</div>
            </div>
            <div style={{ background: featured.accent, color: "#1e1e1e", padding: "8px 12px", borderRadius: 10, fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 0.3, boxShadow: "0 3px 0 rgba(0,0,0,.3)", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <SyrupIcon size={14} />{featured.price}
            </div>
          </button>
        </>
        )}

        <ShopSectionLabel>POWER-UPS · solo levels</ShopSectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {powerUps.map((p) => (
            <PowerUpCard key={p.id} item={p} affordable={tickets >= p.price} onBuy={() => tryBuyPowerUp(p)} />
          ))}
        </div>

        <ShopSectionLabel>COSMETICS</ShopSectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {cosmetics.map((c) => (
            <CosmeticRow key={c.id} item={c} affordable={tickets >= c.price} onOpen={() => tryOpenCosmetic(c)} />
          ))}
        </div>

        <ComingSoonLabel>SYRUP</ComingSoonLabel>
        <ComingSoonVeil note="Buy Syrup with USDT here soon — for now, earn it by playing.">
          {showFirstTicketOffer && (
            <button
              type="button"
              onClick={buyFirstTicket}
              aria-label={`Buy your first ticket at half price, ${usdtLabel(TOURNAMENT_TICKET_COST * (1 - FIRST_TICKET_DISCOUNT))}`}
              style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: "rgba(255,201,49,0.10)", border: "1.5px solid var(--maple-500)", borderRadius: 14, padding: "12px 14px", marginBottom: 10, cursor: "pointer" }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <TicketIcon size={28} />
                <div style={{ position: "absolute", top: -10, right: -16, background: "var(--live-red)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 9, padding: "2px 6px", borderRadius: 99, border: "1.5px solid var(--frame)" }}>-50%</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 1, textTransform: "uppercase" }}>First-timer offer</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", marginTop: 2 }}>Your first ticket, half price</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-faint)", marginTop: 2 }}>1 ticket = 1 live entry</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textDecoration: "line-through" }}>{usdtLabel(TOURNAMENT_TICKET_COST)}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--leaf)" }}>{usdtLabel(TOURNAMENT_TICKET_COST * (1 - FIRST_TICKET_DISCOUNT))}</div>
              </div>
            </button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {bundles.map((b, i) => (
              <BundleCard key={i} bundle={b} onBuy={() => beginBundleCheckout(i)} />
            ))}
          </div>
        </ComingSoonVeil>
      </div>

      <div className="bottom-bar">
        <TabBar active="shop" />
      </div>

      {/* Per-flow overlays */}
      {flow?.type === "cosmetic" && (() => {
        const c = cosmetics.find((x) => x.id === flow.id);
        return c ? <CosmeticSheet item={c} canAfford={tickets >= c.price} onClose={() => setFlow(null)} onConfirm={() => confirmCosmetic(c)} /> : null;
      })()}
      {flow?.type === "bundle" && (() => {
        const b = bundles[flow.bundleIdx];
        return b ? (
          <BundleSheet
            bundle={b}
            phase={flow.phase}
            onClose={() => setFlow(null)}
            onConfirm={() => confirmBundle(b)}
          />
        ) : null;
      })()}
      {flow?.type === "featured" && featured && (
        <FeaturedSheet
          featured={featured}
          canAfford={tickets >= featured.price}
          onClose={() => setFlow(null)}
          onConfirm={confirmFeatured}
        />
      )}
      {flow?.type === "shortfall" && (() => {
        const intent = flow.intent;
        const need =
          intent.kind === "powerup" ? (powerUps.find((p) => p.id === intent.id)?.price ?? 0) :
          intent.kind === "cosmetic" ? (cosmetics.find((c) => c.id === intent.id)?.price ?? 0) :
          (featured?.price ?? 0);
        const itemLabel =
          intent.kind === "powerup" ? (powerUps.find((p) => p.id === intent.id)?.label ?? "") :
          intent.kind === "cosmetic" ? (cosmetics.find((c) => c.id === intent.id)?.label ?? "") :
          (featured?.title ?? "");
        return (
          <ShortfallSheet
            need={need}
            itemLabel={itemLabel}
            bundles={bundles}
            haveTickets={tickets}
            onClose={() => setFlow(null)}
            onTopUp={(idx) => beginBundleCheckout(idx)}
          />
        );
      })()}

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
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 1.4 }}>BOOST ACTIVE</div>
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
            fontFamily: "var(--font-display)",
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

// ===== "Coming soon" treatment ================================================
// Power-ups and cosmetics are teased but not yet purchasable. We keep the real
// cards rendering (so players can see what's coming) but dim them and lay a
// non-interactive veil on top — the underlying buy buttons are inert and hidden
// from assistive tech, so no purchase can fire.

const ComingSoonLabel = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 2 }}>
    <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "rgba(255,255,255,.5)", letterSpacing: 1.2 }}>{children}</span>
    <span style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 1, color: "var(--maple-500)", background: "rgba(255,201,49,.12)", border: "1px solid rgba(255,201,49,.32)", borderRadius: 99, padding: "2px 7px" }}>SOON</span>
  </div>
);

// Plain section header for shipped (interactive) shop sections.
const ShopSectionLabel = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 2 }}>
    <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "rgba(255,255,255,.7)", letterSpacing: 1.2 }}>{children}</span>
  </div>
);

const ComingSoonVeil = ({ note, children }: { note: string; children: ReactNode }) => (
  <div style={{ position: "relative", marginBottom: 14 }}>
    <div aria-hidden="true" inert style={{ opacity: 0.4, filter: "saturate(.55)", pointerEvents: "none", userSelect: "none" }}>
      {children}
    </div>
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, background: "rgba(15,15,16,.28)" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 99, padding: "7px 14px", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 0.5, color: "#fff" }}>
        <span aria-hidden="true">🔒</span> Coming soon
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)", textAlign: "center", padding: "0 16px" }}>{note}</div>
    </div>
  </div>
);

// Shared syrup price tag — one consistent affordable/unaffordable treatment for
// every "spend Syrup" button in the shop (power-ups + cosmetics), so they all
// read the same. `block` makes it a full-width button face; `committed` shows
// the post-buy ✓ flash.
const PriceTag = ({ price, affordable, committed = false, block = false }: {
  price: number;
  affordable: boolean;
  committed?: boolean;
  block?: boolean;
}) => (
  <div
    style={{
      background: committed ? "rgba(0,207,242,.25)" : affordable ? "rgba(255,201,49,.1)" : "rgba(253,251,246,0.04)",
      border: `1px solid ${committed ? "var(--leaf)" : affordable ? "rgba(255,201,49,.3)" : "rgba(253,251,246,0.08)"}`,
      color: committed ? "var(--leaf)" : affordable ? "#FFC931" : "var(--ink-faint)",
      borderRadius: 8,
      padding: block ? "6px 0" : "6px 14px",
      width: block ? "100%" : undefined,
      fontFamily: "var(--font-display)",
      fontSize: 13,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      transition: "transform 120ms cubic-bezier(0.22, 1, 0.36, 1), background 160ms ease, color 160ms ease",
      transform: committed ? "scale(1.04)" : "scale(1)",
    }}
  >
    {committed ? "✓" : (<><SyrupIcon size={13} />{price}</>)}
  </div>
);

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
    <Card radius={14} pad={12} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <AssetWell size={62} accent={item.color} radius={14}>
          <PixelImg src={item.icon} size={48} alt="" />
        </AssetWell>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", lineHeight: 1 }}>{item.label}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{item.sub}</div>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Buy ${item.label} for ${syrupLabel(item.price)}`}
        onClick={click}
        style={{ border: "none", background: "transparent", padding: 0, width: "100%", cursor: "pointer" }}
      >
        <PriceTag price={item.price} affordable={affordable} committed={committed} block />
      </button>
    </Card>
  );
};

const CosmeticRow = ({ item, affordable, onOpen }: { item: Cosmetic; affordable: boolean; onOpen: () => void }) => (
  <button
    type="button"
    aria-label={`${item.label} — ${item.owned ? "owned, preview" : `buy for ${syrupLabel(item.price)}`}`}
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
      <AssetWell size={54} accent={item.color} radius={13}>
        <CosmeticGlyph item={item} size={48} />
      </AssetWell>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", lineHeight: 1 }}>{item.label}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{item.type}</div>
    </div>
    {item.owned ? (
      <div style={{ background: "rgba(0,207,242,.12)", border: "1px solid rgba(0,207,242,.35)", color: "#00CFF2", borderRadius: 8, padding: "6px 12px", fontFamily: "var(--font-display)", fontSize: 11 }}>OWNED</div>
    ) : (
      <PriceTag price={item.price} affordable={affordable} />
    )}
  </button>
);

const BundleCard = ({ bundle, onBuy }: { bundle: Bundle; onBuy: () => void }) => (
  <div style={{ background: "#0F0F10", border: bundle.badge ? "1.5px solid rgba(255,201,49,.4)" : "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 6px", textAlign: "center", position: "relative", boxShadow: bundle.badge ? "0 0 20px rgba(255,201,49,.1)" : "none" }}>
    {bundle.badge && <div style={{ position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)", background: "#FFC931", color: "#1e1e1e", padding: "2px 8px", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{bundle.badge}</div>}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
      <SyrupIcon size={20} />
      <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff" }}>{bundle.count}</span>
    </div>
    {bundle.bonus > 0 ? (
      <div style={{ fontSize: 9, fontWeight: 800, color: "#00CFF2", marginTop: 1 }}>+{bundle.bonus} BONUS</div>
    ) : (
      <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.3)", marginTop: 1 }}>—</div>
    )}
    <button
      type="button"
      onClick={onBuy}
      aria-label={`Buy ${syrupLabel(bundle.count + bundle.bonus)} for ${bundle.price}`}
      style={{ marginTop: 6, width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", borderRadius: 8, padding: "5px 0", fontFamily: "var(--font-display)", fontSize: 11, cursor: "pointer" }}
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
  const proto = useProto();
  const handle = `@${proto.username || "you"}`;
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
            fontFamily: "var(--font-display)",
            fontSize: 18,
            color: applied ? item.color : "var(--ink-soft)",
            textShadow: applied ? `0 0 18px ${item.color}88` : "none",
            letterSpacing: 0.4,
            zIndex: 3,
          }}
        >
          {handle}
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
          <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--frame)" }}>!</span>
        </div>
      )}
    </div>
  );
};

// ===== Sheets ==================================================================

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
      <Sheet onClose={onClose} accent={item.color} ariaLabel={isOwned ? `${item.label} preview` : `Buy ${item.label}`}>
        {(close) => (
        <>
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
                  fontFamily: "var(--font-display)",
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
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", marginTop: 2 }}>{item.label}</div>
        </div>

        {!isOwned && (
          <div style={{ background: "var(--surface-2)", border: "1px solid rgba(253,251,246,0.06)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", letterSpacing: 0.4, textTransform: "uppercase" }}>Cost</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: item.color, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <SyrupIcon size={18} />
              {syrupLabel(item.price)}
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" flex={1} onClick={close}>
            {isOwned ? "CLOSE" : "CANCEL"}
          </Button>
          {!isOwned && (
            <Button
              flex={1.4}
              onClick={onBuy}
              disabled={!canAfford}
              accent={item.color}
              style={canAfford ? undefined : { background: "var(--surface-3)", color: "var(--ink-faint)" }}
            >
              EQUIP &amp; BUY
            </Button>
          )}
        </div>
        </>
        )}
      </Sheet>
  );
};

// ----- Bundle sheet (themed receipt) -----

const BundleSheet = ({ bundle, phase, onClose, onConfirm }: { bundle: Bundle; phase: "confirm" | "processing"; onClose: () => void; onConfirm: () => void }) => {
  const total = bundle.count + bundle.bonus;
  const accent = "#FFC931";
  return (
      <Sheet onClose={phase === "processing" ? undefined : onClose} accent={accent} ariaLabel={`Buy ${syrupLabel(total)} for ${bundle.price}`}>
        {(close) => (
        <>
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
            <SyrupIcon size={48} />
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--ink)", lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2 }}>Syrup</div>
            </div>
          </div>
        </div>

        {/* Receipt */}
        <div style={{ background: "var(--surface-2)", border: "1px solid rgba(253,251,246,0.06)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, color: "var(--ink)" }}>
          <ReceiptRow label="Syrup" value={`${bundle.count}`} />
          {bundle.bonus > 0 && <ReceiptRow label="Bonus" value={`+${bundle.bonus}`} valueColor="var(--leaf)" />}
          <div style={{ height: 1, background: "rgba(253,251,246,0.08)", margin: "8px 0" }} />
          <ReceiptRow label="Total" value={syrupLabel(total)} bold />
          <ReceiptRow label="Pay" value={bundle.price} bold valueColor={accent} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {phase === "confirm" ? (
            <>
              <Button variant="ghost" flex={1} onClick={close}>CANCEL</Button>
              <Button flex={1.4} onClick={onConfirm} accent={accent} ariaLabel={`Pay ${bundle.price} for ${syrupLabel(total)}`}>
                PAY {bundle.price}
              </Button>
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
                fontFamily: "var(--font-display)",
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
        </>
        )}
      </Sheet>
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
      <Sheet onClose={onClose} accent={featured.accent} ariaLabel={`Activate ${featured.title} for ${syrupLabel(featured.price)}`}>
        {(close) => (
        <>
        {bursting && <Confetti pieces={36} />}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ position: "relative", width: 92, height: 92, borderRadius: 22, background: `radial-gradient(circle, ${featured.accent}55, ${featured.accent}11 70%)`, border: `2px solid ${featured.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 38, color: featured.accent, boxShadow: `0 0 36px ${featured.accent}55` }}>
            2×
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: featured.accent, letterSpacing: 1.6 }}>FEATURED · ENDS IN {featured.endsIn.toUpperCase()}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink)", marginTop: 4, letterSpacing: 0.4 }}>{featured.title}</div>
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
              <span style={{ width: 22, height: 22, borderRadius: 99, background: `${featured.accent}30`, color: featured.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 13, flexShrink: 0 }}>✓</span>
              {b}
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" flex={1} onClick={close}>NOT NOW</Button>
          <Button
            flex={1.4}
            onClick={onActivate}
            disabled={!canAfford}
            accent={featured.accent}
            style={canAfford ? undefined : { background: "var(--surface-3)", color: "var(--ink-faint)" }}
          >
            ACTIVATE — <SyrupIcon size={14} />{featured.price}
          </Button>
        </div>
        </>
        )}
      </Sheet>
  );
};

// ----- Shortfall pivot sheet -----

const ShortfallSheet = ({ need, itemLabel, bundles, haveTickets, onClose, onTopUp }: { need: number; itemLabel: string; bundles: Bundle[]; haveTickets: number; onClose: () => void; onTopUp: (idx: number) => void }) => {
  const shortfall = need - haveTickets;
  const suggested = suggestBundleFor(bundles, shortfall);
  const suggestedIdx = bundles.indexOf(suggested);
  return (
      <Sheet onClose={onClose} accent="#FFC931" ariaLabel={`Need more Syrup to buy ${itemLabel}`}>
        {(close) => (
        <>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}><SyrupIcon size={26} /></div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)" }}>Need {shortfall} more Syrup</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginTop: 4 }}>You have {syrupLabel(haveTickets)} · {itemLabel} costs {syrupLabel(need)}</div>
        </div>

        <div style={{ background: "var(--surface-2)", border: "1.5px solid var(--maple-500)", borderRadius: 14, padding: "14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 12, background: "rgba(255,201,49,0.18)", border: "1px solid rgba(255,201,49,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <SyrupIcon size={22} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ink)" }}>{suggested.count + suggested.bonus}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--maple-500)", letterSpacing: 1, textTransform: "uppercase" }}>Quick top up</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--ink)", marginTop: 2 }}>{syrupLabel(suggested.count + suggested.bonus)} · {suggested.price}</div>
            {suggested.bonus > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--leaf)", marginTop: 2 }}>Includes {suggested.bonus} bonus</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" flex={1} onClick={close}>CANCEL</Button>
          <Button flex={1.4} onClick={() => onTopUp(suggestedIdx)}>
            TOP UP
          </Button>
        </div>
        </>
        )}
      </Sheet>
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
    <span style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 0.4 }}>{label}</span>
    {showUndo && (
      <button
        type="button"
        onClick={onUndo}
        style={{
          background: "var(--maple-500)",
          color: "var(--frame)",
          border: "none",
          fontFamily: "var(--font-display)",
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
      <SyrupIcon size={36} />
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--maple-500)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v}</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--ink-faint)", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 }}>Syrup</div>
      </div>
    </div>
  );
};
