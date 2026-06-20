"use client";

import { useEffect } from "react";

// Next.js server actions are versioned per build. After a deploy, a client still
// running the PREVIOUS build calls an action id the new server doesn't have →
// "Failed to find Server Action … this request might be from an older or newer
// deployment". The only fix is to load the new build. This catches that error
// globally — including event-handler rejections, which never reach the React
// error boundary — and reloads once, so users don't have to manually close and
// reopen the app after every deploy.

const SKEW_SIGNATURES = ["Failed to find Server Action", "older or newer deployment"];
const RELOAD_GUARD_KEY = "waffles.skew-reload-at";

export function isDeploymentSkewError(value: unknown): boolean {
  const msg =
    typeof value === "string" ? value : ((value as { message?: string } | null)?.message ?? "");
  return SKEW_SIGNATURES.some((sig) => msg.includes(sig));
}

export function reloadForDeploymentSkew(): void {
  try {
    // Guard against reload loops (e.g. if the error somehow recurs immediately).
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? "0");
    if (Date.now() - last < 15_000) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage unavailable — fall through and reload anyway */
  }
  window.location.reload();
}

export function DeploymentSkewReloader() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isDeploymentSkewError(e.reason)) reloadForDeploymentSkew();
    };
    const onError = (e: ErrorEvent) => {
      if (isDeploymentSkewError(e.error) || isDeploymentSkewError(e.message)) {
        reloadForDeploymentSkew();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
