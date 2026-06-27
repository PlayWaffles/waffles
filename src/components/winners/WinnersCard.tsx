import { forwardRef } from "react";

/**
 * WinnersCard — a static, self-contained 1200×675 (16:9) graphic of a game's
 * winners, designed to be rendered to a PNG (Twitter/X share size) with
 * html-to-image. Used by the /sample/winners preview and the admin per-game
 * export. Colours are hardcoded (brand tokens) and fonts fall back gracefully so
 * it renders identically wherever it's mounted — it does NOT depend on the
 * surrounding page providing CSS variables.
 */

export const WINNERS_CARD_W = 1200;
export const WINNERS_CARD_H = 675;

// Use the app's next/font CSS vars when present (player/sample), else the font by
// name (admin loads them via a <link>), else a rounded system fallback.
const HERO = 'var(--font-baloo), "Baloo 2", ui-rounded, "Segoe UI", system-ui, sans-serif';
const DISPLAY = 'var(--font-fredoka), "Fredoka", ui-rounded, "Segoe UI", system-ui, sans-serif';
const BODY = 'var(--font-nunito), "Nunito", system-ui, -apple-system, sans-serif';

const GOLD = "#FFD24D";
const INK = "#FDFBF6";

export type WinnerEntry = { rank: number; name: string; score: number; prize: number; avatar: string };

export type WinnersCardProps = {
  /** e.g. "World Cup Bowl #177". */
  title: string;
  /** e.g. "Football". */
  category: string;
  /** Prize pool in USDT. */
  pool: number;
  /** Currency label (default "USDT"). */
  currency?: string;
  /** Winners sorted by rank; the top 3 fill the podium. */
  winners: WinnerEntry[];
  /** Total paid winners, for "N winners split it" (defaults to winners.length). */
  winnerCount?: number;
};

const PLACE = {
  1: { solid: GOLD, glow: "rgba(255,210,77,0.55)", medal: "🥇", height: 150, avatar: 116, ring: "#FFE08A" },
  2: { solid: "#C9D6E5", glow: "rgba(201,214,229,0.4)", medal: "🥈", height: 112, avatar: 86, ring: "#E4ECF5" },
  3: { solid: "#E0884E", glow: "rgba(224,136,78,0.4)", medal: "🥉", height: 92, avatar: 86, ring: "#F0A877" },
} as const;

const money = (n: number, currency: string) => `${n.toFixed(2)} ${currency}`;

function PodiumColumn({ w, currency }: { w: WinnerEntry; currency: string }) {
  const p = PLACE[(w.rank <= 3 ? w.rank : 3) as 1 | 2 | 3];
  const champ = w.rank === 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", width: champ ? 240 : 200 }}>
      {champ && <div style={{ fontSize: 44, marginBottom: 2, lineHeight: 1 }}>👑</div>}
      <div style={{ position: "relative" }}>
        <div style={{ width: p.avatar, height: p.avatar, borderRadius: "50%", overflow: "hidden", border: `4px solid ${p.ring}`, boxShadow: `0 0 30px ${p.glow}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={w.avatar} alt={w.name} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ position: "absolute", bottom: -4, right: -4, width: champ ? 40 : 32, height: champ ? 40 : 32, borderRadius: "50%", background: "#0F0F10", border: `2px solid ${p.ring}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: champ ? 21 : 17 }}>
          {p.medal}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 12, padding: "0 6px", maxWidth: champ ? 230 : 196 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: champ ? 24 : 20, color: INK, lineHeight: 1.1, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
        <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: "rgba(253,251,246,.45)", fontVariantNumeric: "tabular-nums" }}>{w.score.toLocaleString()} pts</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: champ ? 24 : 20, color: p.solid, background: `${p.solid}1f`, border: `1.5px solid ${p.solid}66`, borderRadius: 999, padding: champ ? "5px 16px" : "4px 13px", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{money(w.prize, currency)}</span>
      </div>
      <div style={{ width: "100%", marginTop: 14, height: p.height, borderRadius: "14px 14px 0 0", background: `linear-gradient(180deg, ${p.solid}3a, ${p.solid}0d)`, border: `1px solid ${p.solid}45`, borderBottom: "none", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", paddingTop: 12 }}>
          <span style={{ fontFamily: HERO, fontWeight: 800, fontSize: champ ? 64 : 48, color: p.solid, opacity: 0.92 }}>{w.rank}</span>
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${p.ring}, transparent)` }} />
      </div>
    </div>
  );
}

// Deterministic decorative confetti specks (static — this is an export graphic).
const rand = (seed: number) => {
  const x = Math.sin(seed * 99.13) * 43758.5453;
  return x - Math.floor(x);
};
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  color: ["#FFD24D", "#FF9F1C", "#FB72FF", "#00CFF2", "#36D17C"][i % 5],
  left: rand(i + 1) * 100,
  top: rand(i + 7) * 34,
  size: 6 + rand(i + 19) * 7,
  rot: Math.round(rand(i + 31) * 90 - 45),
}));

export const WinnersCard = forwardRef<HTMLDivElement, WinnersCardProps>(function WinnersCard(
  { title, category, pool, currency = "USDT", winners, winnerCount },
  ref,
) {
  const podiumOrder = [winners[1], winners[0], winners[2]].filter(Boolean) as WinnerEntry[];
  const champ = winners[0];
  const count = winnerCount ?? winners.length;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: WINNERS_CARD_W,
        height: WINNERS_CARD_H,
        overflow: "hidden",
        borderRadius: 24,
        background: "radial-gradient(120% 90% at 50% -10%, #2a2008 0%, #14110b 38%, #0a0a0c 78%)",
        fontFamily: BODY,
        color: INK,
      }}
    >
      {/* Gold spotlight */}
      <div style={{ position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)", width: 1000, height: 560, background: "radial-gradient(ellipse at center top, rgba(255,210,77,.22), transparent 62%)", pointerEvents: "none" }} />
      {/* Decorative confetti */}
      {CONFETTI.map((c, i) => (
        <div key={i} style={{ position: "absolute", left: `${c.left}%`, top: c.top, width: c.size, height: c.size * 0.6, background: c.color, borderRadius: 2, transform: `rotate(${c.rot}deg)`, opacity: 0.9 }} />
      ))}

      <div style={{ position: "relative", zIndex: 6, height: "100%", display: "flex", flexDirection: "column", padding: "44px 56px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="Waffles" style={{ width: 38, height: 30, objectFit: "contain" }} />
            <span style={{ fontFamily: HERO, fontWeight: 800, fontSize: 26, letterSpacing: 0.5 }}>WAFFLES</span>
          </div>
          <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(253,251,246,.5)" }}>
            {title}{category ? ` · ${category}` : ""}
          </span>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <h1 style={{ fontFamily: HERO, fontWeight: 800, fontSize: 78, lineHeight: 0.92, color: GOLD, margin: 0, textShadow: "0 0 30px rgba(255,210,77,.4)" }}>WINNERS</h1>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, padding: "6px 16px", borderRadius: 999, background: "rgba(255,210,77,.1)", border: "1px solid rgba(255,210,77,.32)" }}>
            <span style={{ fontSize: 17 }}>🏆</span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, color: INK, fontVariantNumeric: "tabular-nums" }}>{money(pool, currency)} pool</span>
            <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: "rgba(253,251,246,.45)" }}>· {count} winners split it</span>
          </div>
        </div>

        {/* Podium */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 14, marginTop: 8 }}>
          {podiumOrder.map((w) => (
            <PodiumColumn key={w.rank} w={w} currency={currency} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 14 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, color: GOLD }}>
            {champ ? `🥇 ${champ.name} takes ${money(champ.prize, currency)}` : ""}
          </span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, color: "rgba(253,251,246,.4)" }}>playwaffles.fun</span>
        </div>
      </div>
    </div>
  );
});
