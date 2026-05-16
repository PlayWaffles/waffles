import type { Metadata } from "next";
import { Nunito, Archivo_Black } from "next/font/google";
import "./styles.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-body",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Waffles · v2 Prototype",
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${nunito.variable} ${archivoBlack.variable}`}>{children}</div>
  );
}
