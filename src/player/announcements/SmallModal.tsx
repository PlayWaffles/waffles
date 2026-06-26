"use client";

import type { ReactNode } from "react";
import { Sheet, Button } from "../shared";
import { TONE, type Tone } from "./tone";

// ===== Small modal — the "compact sheet" surface =============================
// A single announcement popped as a bottom sheet: emoji badge, title, body and
// an optional CTA. Built on the shared <Sheet> so it gets the dimmed backdrop,
// slide-up/down animation and tap-to-dismiss for free. Use this for an
// announcement that's more than a passing toast but doesn't warrant a full
// takeover.

export const SmallModal = ({
  emoji,
  title,
  body,
  tone = "maple",
  ctaLabel,
  onCta,
  onClose,
  zIndex = 90,
}: {
  emoji: string;
  title: string;
  body: ReactNode;
  tone?: Tone;
  ctaLabel?: string;
  /** Runs on CTA tap. The sheet's own animated close fires alongside it. */
  onCta?: () => void;
  onClose: () => void;
  zIndex?: number;
}) => {
  const c = TONE[tone];
  return (
    <Sheet ariaLabel={title} accent={c.fg} onClose={onClose} zIndex={zIndex}>
      {(close) => (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 12, background: c.bg, border: `1px solid ${c.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--ink)", lineHeight: 1.15 }}>{title}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.45 }}>{body}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {ctaLabel ? (
              <>
                <Button variant="ghost" flex={1} onClick={close}>Dismiss</Button>
                <Button
                  variant="primary"
                  accent={c.fg}
                  flex={2}
                  onClick={() => {
                    onCta?.();
                    close();
                  }}
                >
                  {ctaLabel}
                </Button>
              </>
            ) : (
              <Button variant="primary" accent={c.fg} flex={1} onClick={close}>Got it</Button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
};
