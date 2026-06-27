"use client";

import { useEffect, useRef, useState } from "react";
import { WrappedCard, WRAPPED_CARD_W, WRAPPED_CARD_H, type WrappedData } from "@/components/wrapped/WrappedCard";
// Reuse the generic 1200×675 export + font-embed pipeline.
import { downloadWinnersPng as downloadSharePng, ensureWinnersFonts as ensureShareFonts } from "@/components/winners/exportWinners";

export function WrappedPreview({ data, fileSlug }: { data: WrappedData; fileSlug: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureShareFonts();
    const measure = () => setScale(Math.min(1, Math.min(window.innerWidth - 40, WRAPPED_CARD_W) / WRAPPED_CARD_W));
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
      await downloadSharePng(cardRef.current, `waffles-wrapped-${fileSlug}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#08080a", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0 60px", overflowX: "hidden" }}>
      <div style={{ width: WRAPPED_CARD_W * scale, maxWidth: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 4px", color: "rgba(253,251,246,.5)", fontFamily: "system-ui" }}>
        <span style={{ fontSize: 13 }}>{data.monthLabel} · live data · 1200 × 675 · Twitter 16:9</span>
        <button onClick={onDownload} disabled={busy} style={{ fontSize: 13, color: "#1E1E1E", background: "#FFD24D", border: "none", borderRadius: 999, padding: "8px 16px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontWeight: 700 }}>
          {busy ? "Exporting…" : "⬇ Download PNG"}
        </button>
      </div>

      <div style={{ width: WRAPPED_CARD_W * scale, height: WRAPPED_CARD_H * scale }}>
        <div style={{ width: WRAPPED_CARD_W, height: WRAPPED_CARD_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <WrappedCard ref={cardRef} {...data} />
        </div>
      </div>
    </div>
  );
}
