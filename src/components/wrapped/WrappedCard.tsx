import { forwardRef } from "react";

/**
 * WrappedCard — a rich, static 1200×675 (16:9) "Waffles Wrapped" monthly-recap
 * graphic built from the app's real art (Wally mascot, trophy, coins, balloons,
 * pixel avatars), designed to be rendered to a Twitter/X-sized PNG with
 * html-to-image. Purely presentational; stats come from lib/wrapped/monthlyWrapped.
 */

export const WRAPPED_CARD_W = 1200;
export const WRAPPED_CARD_H = 675;

const HERO = '"Baloo 2", ui-rounded, "Segoe UI", system-ui, sans-serif';
const DISPLAY = '"Fredoka", ui-rounded, "Segoe UI", system-ui, sans-serif';
const BODY = '"Nunito", system-ui, -apple-system, sans-serif';

// Same-origin app art (so the html-to-image capture can inline it).
const A = "/images/player/optimized";
const ASSET = {
  wally: `${A}/wally.webp`,
  trophy: `${A}/trophy.webp`,
  coin: `${A}/golden-coin.webp`,
  gem: `${A}/xp-gem.webp`,
  ticket: `${A}/ticket.webp`,
  football: `${A}/wc-football.webp`,
  balloons: `${A}/wc-balloons.webp`,
  wordmark: `${A}/logo-wordmark.webp`,
  avFox: `${A}/avatar-fox.webp`,
  avBear: `${A}/avatar-bear.webp`,
  avFrog: `${A}/avatar-frog.webp`,
} as const;

const GOLD = "#FFD24D";
const INK = "#FDFBF6";
const COLORS = { gold: GOLD, leaf: "#FF9F1C", cyan: "#00CFF2", berry: "#FB72FF", green: "#36D17C" } as const;

export type WrappedStatColor = keyof typeof COLORS;
export type WrappedAsset = "ticket" | "coin" | "gem" | "football" | "trophy" | "players";
export type WrappedStat = { asset: WrappedAsset; value: string; label: string; color: WrappedStatColor };
export type WrappedData = {
  /** e.g. "June 2026". */
  monthLabel: string;
  /** Six stat tiles. */
  stats: WrappedStat[];
  /** Player-of-the-month highlight, or null when there were no winners. */
  topPlayer: { name: string; detail: string; avatar: string } | null;
};

// eslint-disable-next-line @next/next/no-img-element
const Img = (p: { src: string; alt?: string; style?: React.CSSProperties }) => <img src={p.src} alt={p.alt ?? ""} style={{ display: "block", imageRendering: "auto", ...p.style }} />;

function StatTile({ stat }: { stat: WrappedStat }) {
  const c = COLORS[stat.color];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 16, background: `linear-gradient(135deg, ${c}1f, ${c}0a)`, border: `1px solid ${c}3d`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.05)` }}>
      <div style={{ width: 52, height: 52, borderRadius: 13, background: `${c}1a`, border: `1px solid ${c}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {stat.asset === "players" ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {[ASSET.avFox, ASSET.avBear, ASSET.avFrog].map((s, i) => (
              <Img key={i} src={s} style={{ width: 22, height: 22, boxSizing: "border-box", borderRadius: "50%", marginLeft: i ? -9 : 0, border: "2px solid #15110b", objectFit: "cover" }} />
            ))}
          </div>
        ) : (
          <Img src={ASSET[stat.asset]} style={{ width: 34, height: 34, objectFit: "contain", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.4))" }} />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: HERO, fontWeight: 800, fontSize: 30, color: c, lineHeight: 1, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stat.value}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 13, color: "rgba(253,251,246,.6)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>{stat.label}</div>
      </div>
    </div>
  );
}

// Deterministic decorative scatter (coins/footballs/confetti) — pure during render.
const rand = (seed: number) => {
  const x = Math.sin(seed * 99.13) * 43758.5453;
  return x - Math.floor(x);
};
const SCATTER = Array.from({ length: 9 }, (_, i) => ({
  src: i % 3 === 0 ? ASSET.coin : i % 3 === 1 ? ASSET.football : ASSET.gem,
  left: rand(i + 1) * 96,
  top: rand(i + 5) * 92,
  size: 26 + rand(i + 11) * 26,
  rot: Math.round(rand(i + 17) * 60 - 30),
}));
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  color: ["#FFD24D", "#FF9F1C", "#FB72FF", "#00CFF2", "#36D17C"][i % 5],
  left: rand(i + 30) * 100,
  top: rand(i + 44) * 40,
  size: 6 + rand(i + 51) * 7,
  rot: Math.round(rand(i + 61) * 90 - 45),
}));

export const WrappedCard = forwardRef<HTMLDivElement, WrappedData>(function WrappedCard(
  { monthLabel, stats, topPlayer },
  ref,
) {
  return (
    <div ref={ref} style={{ position: "relative", width: WRAPPED_CARD_W, height: WRAPPED_CARD_H, overflow: "hidden", borderRadius: 24, background: "radial-gradient(135% 115% at 26% -20%, #3a2c0c 0%, #1c1610 44%, #0a0a0c 84%)", fontFamily: BODY, color: INK }}>
      {/* glows */}
      <div style={{ position: "absolute", top: -160, left: -60, width: 660, height: 560, background: "radial-gradient(ellipse at center, rgba(255,210,77,.26), transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -180, right: -80, width: 620, height: 520, background: "radial-gradient(ellipse at center, rgba(0,207,242,.14), transparent 62%)", pointerEvents: "none" }} />
      {/* scattered art (faint) */}
      {SCATTER.map((s, i) => (
        <Img key={i} src={s.src} style={{ position: "absolute", left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, objectFit: "contain", transform: `rotate(${s.rot}deg)`, opacity: 0.16, pointerEvents: "none" }} />
      ))}
      {/* confetti specks */}
      {CONFETTI.map((c, i) => (
        <div key={`c${i}`} style={{ position: "absolute", left: `${c.left}%`, top: `${c.top}%`, width: c.size, height: c.size * 0.6, background: c.color, borderRadius: 2, transform: `rotate(${c.rot}deg)`, opacity: 0.85, pointerEvents: "none" }} />
      ))}

      <div style={{ position: "relative", zIndex: 3, height: "100%", display: "flex", flexDirection: "column", padding: "34px 46px 28px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Img src={ASSET.wordmark} alt="Waffles" style={{ height: 26, width: "auto", objectFit: "contain" }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(253,251,246,.5)" }}>Monthly recap</span>
        </div>

        {/* Body: hero (left) + title & stats (right) */}
        <div style={{ flex: 1, display: "flex", gap: 30, marginTop: 8, minHeight: 0 }}>
          {/* LEFT — mascot hero + player of the month */}
          <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* flex:1 wrapper vertically centers the fixed-size mascot cluster in
                whatever height is left, so the bottom never has dead space and the
                balloons/trophy stay tight to Wally. */}
            <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "relative", width: 330, height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "absolute", width: 330, height: 330, background: "radial-gradient(circle, rgba(255,210,77,.30), transparent 62%)" }} />
                <Img src={ASSET.balloons} style={{ position: "absolute", top: -6, right: 14, width: 132, transform: "rotate(6deg)", filter: "drop-shadow(0 8px 16px rgba(0,0,0,.4))" }} />
                <Img src={ASSET.wally} style={{ position: "relative", width: 232, objectFit: "contain", filter: "drop-shadow(0 14px 22px rgba(0,0,0,.5))" }} />
                <Img src={ASSET.trophy} style={{ position: "absolute", bottom: 6, left: 26, width: 120, objectFit: "contain", filter: "drop-shadow(0 10px 16px rgba(0,0,0,.5))", transform: "rotate(-6deg)" }} />
              </div>
            </div>

            {topPlayer && (
              <div style={{ width: "100%", marginTop: 4, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "linear-gradient(135deg, rgba(255,210,77,.16), rgba(255,210,77,.05))", border: "1px solid rgba(255,210,77,.4)", boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Img src={topPlayer.avatar} style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid #FFE08A", objectFit: "cover" }} />
                  <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", fontSize: 22 }}>👑</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--maple-500, #FFD24D)" }}>Player of the month</div>
                  <div style={{ fontFamily: HERO, fontWeight: 800, fontSize: 21, color: INK, lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topPlayer.name}</div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: GOLD }}>{topPlayer.detail}</div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — title + stat grid */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <h1 style={{ fontFamily: HERO, fontWeight: 800, fontSize: 70, lineHeight: 0.86, margin: 0, letterSpacing: -0.5 }}>
              <span style={{ color: INK }}>WAFFLES</span>{" "}
              <span style={{ color: GOLD, textShadow: "0 0 32px rgba(255,210,77,.5)" }}>WRAPPED</span>
            </h1>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, color: "rgba(253,251,246,.6)", marginTop: 6 }}>{monthLabel} · the month in review</div>

            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: 12, marginTop: 18 }}>
              {stats.map((s, i) => (
                <StatTile key={i} stat={s} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: "rgba(253,251,246,.5)" }}>Play live trivia · climb the table · win real USDT</span>
          <span style={{ fontFamily: HERO, fontWeight: 800, fontSize: 16, color: GOLD }}>playwaffles.fun</span>
        </div>
      </div>
    </div>
  );
});
