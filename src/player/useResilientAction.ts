"use client";

import { useEffect, useState } from "react";
import {
  isDeploymentSkewError,
  reloadForDeploymentSkew,
} from "@/components/DeploymentSkewReloader";

type Options = { retries?: number; delayMs?: number };

/**
 * Run a one-shot player API call on mount (and whenever `deps` change), retrying
 * when it resolves null/undefined or throws.
 *
 * Why this exists: v2 player API calls authenticate via a session cookie set
 * asynchronously by AuthBootstrap, which can lag the client mount that the page
 * gates on. A plain fire-once `useEffect(...).catch(() => {})` left screens
 * permanently empty whenever it raced that cookie (or a transient gap, e.g. the
 * moment between hourly tournament rounds). This retries a few times before
 * giving up, so the data fills in once the session/data is actually ready —
 * without each screen re-implementing the same retry loop.
 *
 * A null/undefined result is treated as "not ready, retry"; if a screen has a
 * legitimately-empty success value, map it after this returns (e.g. treat a
 * board with `fieldSize === 0` as empty) rather than returning null from the
 * action.
 */
export function useResilientAction<T>(
  action: () => Promise<T | null | undefined>,
  deps: unknown[] = [],
  { retries = 5, delayMs = 1200 }: Options = {},
): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setLoading(true);

    const run = () => {
      action()
        .then((res) => {
          if (!active) return;
          if (res != null) {
            setData(res);
            setLoading(false);
            return;
          }
          if (attempts++ < retries) timer = setTimeout(run, delayMs);
          else setLoading(false);
        })
        .catch((error) => {
          if (isDeploymentSkewError(error)) {
            reloadForDeploymentSkew();
            return;
          }
          if (!active) return;
          if (attempts++ < retries) timer = setTimeout(run, delayMs);
          else setLoading(false);
        });
    };
    run();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}
