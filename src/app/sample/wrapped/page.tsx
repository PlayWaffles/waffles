/**
 * Sample page: Waffles Wrapped (monthly recap) — REAL DATA.
 *
 * Visit /sample/wrapped to preview. Server-fetches this month's MiniPay stats and
 * renders the shareable 1200×675 (Twitter 16:9) card with a Download PNG.
 */

import { getMonthlyWrapped } from "@/lib/wrapped/monthlyWrapped";
import { WrappedPreview } from "./WrappedPreview";

// Always compute fresh (month-to-date), never statically cache.
export const dynamic = "force-dynamic";

export default async function WrappedSamplePage() {
  const data = await getMonthlyWrapped();
  const fileSlug = data.monthLabel.toLowerCase().replace(/\s+/g, "-");
  return <WrappedPreview data={data} fileSlug={fileSlug} />;
}
