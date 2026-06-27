import type { ReactNode } from "react";
import { Nunito, Fredoka, Baloo_2 } from "next/font/google";
import "@/player/styles.css";

// Standalone preview layout — loads the player's fonts + design tokens so the
// winners graphic renders in the real app typeface (Baloo/Fredoka/Nunito) and
// colours. No <Providers> needed: the page is pure/presentational with mock data.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", display: "swap" });

export default function WinnersPreviewLayout({ children }: { children: ReactNode }) {
  return <div className={`${nunito.variable} ${fredoka.variable} ${baloo.variable}`}>{children}</div>;
}
