import { toPng } from "html-to-image";
import { WINNERS_CARD_W, WINNERS_CARD_H } from "./WinnersCard";

/**
 * Render a mounted WinnersCard node to a PNG download. Exports at 2× the 1200×675
 * canvas (2400×1350, still 16:9) for a crisp Twitter/X share image. Waits for the
 * brand fonts to be ready so the capture isn't in a fallback typeface.
 */
export async function downloadWinnersPng(node: HTMLElement, filename: string): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts API unavailable — proceed with whatever's loaded */
  }
  const dataUrl = await toPng(node, {
    width: WINNERS_CARD_W,
    height: WINNERS_CARD_H,
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#0a0a0c",
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
