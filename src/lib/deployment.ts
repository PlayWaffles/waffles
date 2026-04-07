import { env } from "@/lib/env";

const PRODUCTION_HOST = "miniapp.playwaffles.fun";

function getRootHost() {
  try {
    return new URL(env.rootUrl).host;
  } catch {
    return "";
  }
}

export function isProductionDeployment() {
  return getRootHost() === PRODUCTION_HOST;
}

export function isLocalDevelopmentDeployment() {
  return !isProductionDeployment() && getRootHost().includes("localhost");
}
