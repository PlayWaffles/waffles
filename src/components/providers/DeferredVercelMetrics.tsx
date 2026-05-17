"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
  { ssr: false },
);

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((mod) => mod.Analytics),
  { ssr: false },
);

export function DeferredVercelMetrics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setEnabled(true), 3000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!enabled) return null;

  return (
    <>
      <SpeedInsights />
      <Analytics />
    </>
  );
}
