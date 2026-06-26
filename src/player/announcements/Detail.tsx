"use client";

import { useProto } from "../state";
import { SmallModal } from "./SmallModal";
import { FullModal } from "./FullModal";
import { TONE } from "./tone";

// ===== Announcement detail modal =============================================
// The destination for a tap on a non-navigating announcement (toast / banner /
// inbox). Reads `proto.announcementDetail` and opens it as the surface the
// announcement asked for: a compact bottom sheet ("small") or a full-screen
// takeover ("full"). Rendered globally in the player page so it works on any
// screen — a winner can open their result straight from the mid-game toast.

export const AnnouncementDetail = () => {
  const proto = useProto();
  const a = proto.announcementDetail;
  if (!a) return null;

  const close = () => proto.update({ announcementDetail: null });
  const c = TONE[a.tone];

  if (a.surface === "full") {
    return (
      <FullModal
        ariaLabel={a.title}
        zIndex={150}
        background="linear-gradient(180deg, #181206 0%, #0a0a0b 100%)"
        footerStyle={{ background: "linear-gradient(180deg, transparent, #0a0a0b 30%)" }}
        footer={
          <button type="button" className="cta maple" onClick={close} style={{ width: "100%", flex: "none" }}>
            Got it
          </button>
        }
      >
        <div style={{ flexShrink: 0, width: 84, height: 84, borderRadius: 22, background: c.bg, border: `1px solid ${c.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, marginBottom: 18 }}>{a.emoji}</div>
        <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 32, lineHeight: 1.06, color: "#fff", marginBottom: 12, maxWidth: 340 }}>{a.title}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,.7)", lineHeight: 1.5, maxWidth: 340, whiteSpace: "pre-line" }}>{a.body}</div>
      </FullModal>
    );
  }

  return (
    <SmallModal
      emoji={a.emoji}
      title={a.title}
      body={<span style={{ whiteSpace: "pre-line" }}>{a.body}</span>}
      tone={a.tone}
      zIndex={150}
      onClose={close}
    />
  );
};
