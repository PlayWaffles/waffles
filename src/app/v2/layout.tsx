import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nunito, Fredoka, Baloo_2 } from "next/font/google";
import "./_app/styles.css";

// v2's canonical type system. Loaded here (not in celo's root layout) so these
// three Google fonts only ship on the v2 experience. Exposed as CSS variables
// that v2/_app/styles.css consumes (--font-body/display/hero resolve to these).
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", display: "swap" });

export const metadata: Metadata = {
  title: "Waffles",
  description: "Real-time multiplayer trivia.",
};

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <div className={`${nunito.variable} ${fredoka.variable} ${baloo.variable}`}>
      {children}
    </div>
  );
}
