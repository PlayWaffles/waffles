import type { ReactNode } from "react";
import { Nunito, Fredoka, Baloo_2 } from "next/font/google";
import "@/app/v2/_app/styles.css";

// v2's canonical type system, scoped to the player experience. Mounted under the
// (app) group so it inherits <Providers> (auth/wagmi/query) — the v2 app's
// ProtoProvider resolves the real signed-in user via these fonts' parent
// context. No GameHeader here: the v2 SPA renders its own chrome.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", display: "swap" });

export default function PlayLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${nunito.variable} ${fredoka.variable} ${baloo.variable}`}>{children}</div>
  );
}
