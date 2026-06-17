import type { NextConfig } from "next";
import withOutray from "@outray/next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
