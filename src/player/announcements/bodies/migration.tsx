"use client";

import { ASSETS, PixelImg } from "../../shared";
import { FullModalTemplate, type FullModalBullet } from "../FullModal";

// One-time welcome shown to users migrated from the old app. Gated server-side
// (migrated user + not yet dismissed in the DB); the host handles persistence.
// The content is plain enough to ride the generic full-modal template — it's the
// reference example of a "no custom code" full-modal announcement.

const WHATS_NEW: FullModalBullet[] = [
  { icon: "✨", title: "Fresh new look", text: "We redesigned the whole thing." },
  { icon: "🪜", title: "Levels", text: "Climb through levels and earn rewards as you play." },
  { icon: "📈", title: "Earn XP", text: "Every game you play earns XP and levels up your profile." },
  { icon: "🍯", title: "Syrup", text: "Your new in-game currency — spend it on power-ups, cosmetics & emotes." },
  { icon: "⏱️", title: "Games every 4 hours", text: "A new tournament every 4 hours. No more waiting to play." },
  { icon: "🎯", title: "Daily missions", text: "Knock them out for extra rewards." },
  { icon: "🔥", title: "Daily rewards & streaks", text: "Show up daily and keep your streak alive." },
];

export const MigrationBody = ({ onClose }: { onClose: () => void }) => (
  <FullModalTemplate
    ariaLabel="Welcome to the new Waffles"
    zIndex={95}
    eyebrow="What's new"
    headline={<>Waffles got a glow-up 🧇</>}
    hero={<PixelImg src={ASSETS.trophy} size={92} alt="" style={{ filter: "drop-shadow(0 0 26px rgba(255,210,77,.5))", marginBottom: 6 }} />}
    bullets={WHATS_NEW}
    ctaLabel="Go get your levels and cook 🔥"
    onClose={onClose}
  />
);
