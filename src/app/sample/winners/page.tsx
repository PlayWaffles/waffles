"use client";

/**
 * Sample page: Winners graphic (shareable card)
 *
 * Visit /sample/winners to preview the exportable winners card.
 *
 * The card (<WinnersCard>) is a fixed 1200×675 (16:9) — the Twitter/X share image
 * size — rendered in the app typeface + colours. "Download PNG" exports it via
 * html-to-image. The same card + export are reused for the admin per-game export.
 */

import { useEffect, useRef, useState } from "react";
import { WinnersCard, WINNERS_CARD_W, WINNERS_CARD_H, type WinnerEntry } from "@/components/winners/WinnersCard";
import { downloadWinnersPng, ensureWinnersFonts } from "@/components/winners/exportWinners";

const GAME = { title: "World Cup Bowl #177", category: "Football", pool: 4.0 };
const SHARES = [0.28, 0.19, 0.14, 0.1, 0.08, 0.07, 0.07, 0.07];
const NAMES = ["SwiftFalcon42", "GoldenOwl17", "CleverFox88", "LuckyMaple31", "MightyAce54", "RoyalPanda09", "SneakyTiger73", "BraveWhiz26"];

const WINNERS: WinnerEntry[] = SHARES.map((share, i) => ({
  rank: i + 1,
  name: NAMES[i],
  score: 2480 - i * 170 - (i % 2) * 40,
  prize: Math.round(GAME.pool * share * 100) / 100,
  avatar: `https://i.pravatar.cc/160?u=${NAMES[i]}`,
}));

export default function WinnersSamplePage() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureWinnersFonts();
    const measure = () => setScale(Math.min(1, (Math.min(window.innerWidth - 40, 1200)) / WINNERS_CARD_W));
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const onDownload = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      await downloadWinnersPng(cardRef.current, "waffles-winners-177");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#08080a", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0 60px", overflowX: "hidden" }}>
      <div style={{ width: WINNERS_CARD_W * scale, maxWidth: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 4px", color: "rgba(253,251,246,.5)", fontFamily: "system-ui" }}>
        <span style={{ fontSize: 13 }}>1200 × 675 · Twitter 16:9</span>
        <button
          onClick={onDownload}
          disabled={busy}
          style={{ fontSize: 13, color: "#1E1E1E", background: "#FFD24D", border: "none", borderRadius: 999, padding: "8px 16px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontWeight: 700 }}
        >
          {busy ? "Exporting…" : "⬇ Download PNG"}
        </button>
      </div>

      {/* Scaled preview; the captured node (cardRef) stays full 1200×675. */}
      <div style={{ width: WINNERS_CARD_W * scale, height: WINNERS_CARD_H * scale }}>
        <div style={{ width: WINNERS_CARD_W, height: WINNERS_CARD_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <WinnersCard ref={cardRef} title={GAME.title} category={GAME.category} pool={GAME.pool} winners={WINNERS} />
        </div>
      </div>
    </div>
  );
}
