"use client";

import { motion } from "framer-motion";
import type { VMedia } from "../data";
import { AudioClue } from "./AudioClue";

/**
 * Stand-in artwork for media-driven formats. The real game loads `mediaUrl` /
 * `soundUrl` from Cloudinary; here we draw self-contained SVGs so the sample
 * needs no assets while still showing how the picture/audio carries the clue.
 */
export function Illustration({ media }: { media: VMedia }) {
  if (media.kind === "audio") {
    return <AudioClue line={media.line} />;
  }

  return (
    <motion.figure
      className="mx-auto mb-4 w-full px-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <div className="relative mx-auto w-full max-w-[280px] aspect-video rounded-[10px] overflow-hidden bg-card border border-border shadow-[0_8px_0_#000] flex items-center justify-center">
        {media.kind === "jersey" ? <JerseyArt /> : <TrophyArt />}
      </div>
    </motion.figure>
  );
}

/** Argentina home kit — sky-blue & white vertical stripes. */
function JerseyArt() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-label="Football kit">
      <defs>
        <clipPath id="shirt">
          <path d="M70 24 L86 16 Q100 26 114 16 L130 24 L150 40 L138 56 L126 48 L126 104 L74 104 L74 48 L62 56 L50 40 Z" />
        </clipPath>
      </defs>
      <rect width="200" height="120" fill="#0e0e0e" />
      <g clipPath="url(#shirt)">
        <rect x="40" y="10" width="120" height="100" fill="#ffffff" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={52 + i * 24} y="10" width="12" height="100" fill="#74ACDF" />
        ))}
      </g>
      <path
        d="M70 24 L86 16 Q100 26 114 16 L130 24 L150 40 L138 56 L126 48 L126 104 L74 104 L74 48 L62 56 L50 40 Z"
        fill="none"
        stroke="#1e1e1e"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text x="100" y="86" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1e1e1e">
        10
      </text>
    </svg>
  );
}

/** Generic gold trophy silhouette. */
function TrophyArt() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-label="Trophy">
      <rect width="200" height="120" fill="#0e0e0e" />
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE08A" />
          <stop offset="0.5" stopColor="#F5BB1B" />
          <stop offset="1" stopColor="#C9881A" />
        </linearGradient>
      </defs>
      <g fill="url(#gold)" stroke="#8a5e12" strokeWidth="2">
        <path d="M74 24 h52 v10 q0 26 -26 30 q-26 -4 -26 -30 Z" />
        <path d="M74 28 q-18 0 -18 -12 h12 q0 6 6 8 Z" />
        <path d="M126 28 q18 0 18 -12 h-12 q0 6 -6 8 Z" />
        <rect x="94" y="62" width="12" height="18" />
        <path d="M82 80 h36 l4 12 h-44 Z" />
        <rect x="72" y="92" width="56" height="10" rx="2" />
      </g>
      <ellipse cx="100" cy="40" rx="9" ry="11" fill="#fff" opacity="0.18" />
    </svg>
  );
}
