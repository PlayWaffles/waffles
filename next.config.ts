import type { NextConfig } from "next";
import withOutray from "@outray/next";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

const deploymentIdEnvNames = [
  "NEXT_DEPLOYMENT_ID",
  "DEPLOYMENT_VERSION",
  "GIT_SHA",
  "GIT_COMMIT_SHA",
  "COMMIT_SHA",
  "SOURCE_COMMIT",
  "VERCEL_GIT_COMMIT_SHA",
  "RAILWAY_GIT_COMMIT_SHA",
  "CF_PAGES_COMMIT_SHA",
  "HEROKU_SLUG_COMMIT",
] as const;

function getDeploymentId() {
  for (const name of deploymentIdEnvNames) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing deployment identifier. Set NEXT_DEPLOYMENT_ID, DEPLOYMENT_VERSION, or GIT_SHA to enable Next.js rolling-deploy version skew protection.",
    );
  }

  return "development";
}

const deploymentId = getDeploymentId();

function assertServerActionsEncryptionKey() {
  if (process.env.NODE_ENV !== "production") return;

  const configuredKey = process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim();
  if (configuredKey) {
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = /^[a-f0-9]{64}$/i.test(configuredKey)
      ? Buffer.from(configuredKey, "hex").toString("base64")
      : configuredKey;
    return;
  }

  const authSecret = process.env.AUTH_SECRET?.trim();
  if (authSecret) {
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = crypto
      .createHash("sha256")
      .update(authSecret)
      .digest("base64");
    return;
  }

  throw new Error(
    "Missing NEXT_SERVER_ACTIONS_ENCRYPTION_KEY or AUTH_SECRET. Set one shared secret for every Dokploy build and runtime pod so Server Actions remain valid across rolling deploys.",
  );
}

assertServerActionsEncryptionKey();

const nextConfig: NextConfig = {
  deploymentId,
  generateBuildId: async () => deploymentId,
  allowedDevOrigins: ["*.outray.app"],
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  // v2 migration cutover: the player experience is the ported v2 SPA at /play
  // (the old (game) routes are superseded — the SPA handles home/levels/compete/
  // leaderboard/profile internally). Temporary (307) so it's trivially reversible.
  redirects: async () => [
    { source: "/", destination: "/play", permanent: false },
    { source: "/game", destination: "/play", permanent: false },
    { source: "/leaderboard", destination: "/play", permanent: false },
    { source: "/profile", destination: "/play", permanent: false },
  ],
};

export default withOutray(nextConfig);
