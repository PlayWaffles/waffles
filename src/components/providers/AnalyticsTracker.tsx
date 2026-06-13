"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  AnalyticsEvent,
  captureFirstTouchAttribution,
  trackClientEvent,
} from "@/lib/analytics";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const url = useMemo(() => {
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, queryString]);

  useEffect(() => {
    const attribution = captureFirstTouchAttribution();
    trackClientEvent(AnalyticsEvent.PageViewed, {
      path: pathname,
      url,
      title: document.title,
      ...attribution,
    });
  }, [pathname, url]);

  return null;
}
