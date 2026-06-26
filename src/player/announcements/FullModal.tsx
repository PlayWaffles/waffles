"use client";

import type { CSSProperties, ReactNode } from "react";

// ===== Full modal — the "full takeover" surface ==============================
// The shared chrome every full-screen announcement repeats: an absolutely-
// positioned dialog that fills the phone frame, a gradient backdrop, the
// `waffles-v2-onb-in` entrance, and a scrollable body over a sticky footer.
// Rich announcements (World Cup countdown, migration "what's new") pass their
// bespoke markup as `children` + `footer`; simple ones use <FullModalTemplate>.

export const FullModal = ({
  ariaLabel,
  background,
  zIndex = 90,
  decoration,
  children,
  footer,
  contentStyle,
  footerStyle,
}: {
  ariaLabel: string;
  /** Full-bleed background (usually a gradient) painted behind the content. */
  background: string;
  zIndex?: number;
  /** Absolutely-positioned glow / texture layers, rendered behind the content. */
  decoration?: ReactNode;
  /** Scrollable body. */
  children: ReactNode;
  /** Sticky bottom area — typically the CTA button(s). */
  footer?: ReactNode;
  contentStyle?: CSSProperties;
  footerStyle?: CSSProperties;
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
    style={{
      position: "absolute",
      inset: 0,
      zIndex,
      display: "flex",
      flexDirection: "column",
      background,
      animation: "waffles-v2-onb-in 0.35s var(--ease-out-quart)",
    }}
  >
    {decoration}
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "28px 24px 8px",
        position: "relative",
        zIndex: 1,
        ...contentStyle,
      }}
    >
      {children}
    </div>
    {footer != null && (
      <div style={{ padding: "10px 18px max(20px, env(safe-area-inset-bottom))", position: "relative", zIndex: 1, ...footerStyle }}>
        {footer}
      </div>
    )}
  </div>
);

// A radial-glow decoration layer — the warm top wash both takeovers share. Drop
// it into <FullModal decoration={<FullModalGlow .../>} /> (compose more than one
// for textured headers).
export const FullModalGlow = ({
  height = 300,
  color = "rgba(255,210,77,.26)",
}: {
  height?: number;
  color?: string;
}) => (
  <div
    aria-hidden
    style={{ position: "absolute", top: 0, left: 0, right: 0, height, background: `radial-gradient(ellipse at center top, ${color}, transparent 65%)`, pointerEvents: "none" }}
  />
);

// ===== Generic full-modal template ===========================================
// A no-custom-code full takeover: eyebrow + headline + a bullet list + one CTA.
// This is the fast path for a new full-modal announcement — supply data, done.

export type FullModalBullet = { icon: string; title?: string; text: string };

export const FullModalTemplate = ({
  ariaLabel,
  background = "linear-gradient(180deg, #181206 0%, #0a0a0b 100%)",
  eyebrow,
  headline,
  bullets,
  hero,
  ctaLabel,
  onClose,
  zIndex,
}: {
  ariaLabel: string;
  background?: string;
  eyebrow?: string;
  headline: ReactNode;
  bullets: FullModalBullet[];
  /** Optional hero element above the headline (image, emoji, etc.). */
  hero?: ReactNode;
  ctaLabel: string;
  onClose: () => void;
  zIndex?: number;
}) => (
  <FullModal
    ariaLabel={ariaLabel}
    background={background}
    zIndex={zIndex}
    decoration={<FullModalGlow />}
    footerStyle={{ background: "linear-gradient(180deg, transparent, #0a0a0b 30%)" }}
    footer={
      <button type="button" className="cta maple" onClick={onClose} style={{ width: "100%", flex: "none" }}>
        {ctaLabel}
      </button>
    }
  >
    {hero}
    {eyebrow && (
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, color: "var(--maple-500)", textTransform: "uppercase", marginBottom: 8 }}>{eyebrow}</div>
    )}
    <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 34, lineHeight: 1.05, color: "#fff", marginBottom: 18 }}>{headline}</div>
    <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 9 }}>
      {bullets.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", textAlign: "left" }}>
          <span style={{ fontSize: 22, flexShrink: 0, width: 26, textAlign: "center" }} aria-hidden>{p.icon}</span>
          <div style={{ minWidth: 0 }}>
            {p.title && <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", lineHeight: 1.1 }}>{p.title}</div>}
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.6)", marginTop: p.title ? 2 : 0, lineHeight: 1.3 }}>{p.text}</div>
          </div>
        </div>
      ))}
    </div>
  </FullModal>
);
