import { toPng } from "html-to-image";
import { WINNERS_CARD_W, WINNERS_CARD_H } from "./WinnersCard";

// The app's typefaces (Baloo 2 / Fredoka / Nunito), same families the app loads
// via next/font. Loaded by real name for on-screen previews + embedded for export.
const FONTS_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Fredoka:wght@500;600;700&family=Nunito:wght@700;800&display=swap";

/** Inject the brand fonts (by real family name) once, for on-screen rendering of
 *  the card — so the preview matches the export. Safe to call repeatedly. */
export function ensureWinnersFonts(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("link[data-winners-fonts]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONTS_CSS_URL;
  link.setAttribute("data-winners-fonts", "");
  document.head.appendChild(link);
}

// Build a self-contained @font-face stylesheet with the woff2 files inlined as
// data URIs. html-to-image can't read cross-origin stylesheet rules (Google
// Fonts), so we hand it this directly via `fontEmbedCSS` — that's what actually
// gets the brand typeface into the PNG. Cached after the first build.
let cachedFontEmbedCss: string | null = null;

async function buildFontEmbedCss(): Promise<string> {
  if (cachedFontEmbedCss !== null) return cachedFontEmbedCss;
  try {
    const css = await fetch(FONTS_CSS_URL).then((r) => r.text());
    const urls = Array.from(new Set(Array.from(css.matchAll(/url\((https:\/\/[^)'"]+\.woff2)\)/g), (m) => m[1])));
    const byUrl = new Map<string, string>();
    await Promise.all(
      urls.map(async (url) => {
        const buf = await fetch(url).then((r) => r.arrayBuffer());
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        byUrl.set(url, `data:font/woff2;base64,${btoa(bin)}`);
      }),
    );
    let out = css;
    for (const [url, dataUri] of byUrl) out = out.split(url).join(dataUri);
    cachedFontEmbedCss = out;
  } catch (err) {
    console.error("[winners-export] font embed failed — falling back to system font", err);
    cachedFontEmbedCss = "";
  }
  return cachedFontEmbedCss;
}

/**
 * Render a mounted WinnersCard node to a PNG download. Exports at 2× the 1200×675
 * canvas (2400×1350, still 16:9) for a crisp Twitter/X share image, with the
 * brand fonts embedded so the capture isn't in a fallback typeface.
 */
export async function downloadWinnersPng(node: HTMLElement, filename: string): Promise<void> {
  const fontEmbedCSS = await buildFontEmbedCss();
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts API unavailable — proceed */
  }
  const dataUrl = await toPng(node, {
    width: WINNERS_CARD_W,
    height: WINNERS_CARD_H,
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#0a0a0c",
    ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
