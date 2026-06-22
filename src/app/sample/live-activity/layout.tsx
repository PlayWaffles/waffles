import type { ReactNode } from "react";
import { Nunito, Fredoka, Baloo_2 } from "next/font/google";
import "@/player/styles.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", display: "swap" });

export default function LiveActivityPreviewLayout({ children }: { children: ReactNode }) {
  return <div className={`${nunito.variable} ${fredoka.variable} ${baloo.variable}`}>{children}</div>;
}
