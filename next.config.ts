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
  rewrites: async () => {
    const partykitHost =
      process.env.NEXT_PUBLIC_PARTYKIT_HOST || "http://127.0.0.1:1999";
    return [
      {
        source: "/parties/:path*",
        destination: `${partykitHost}/parties/:path*`,
      },
    ];
  },
};

export default withOutray(nextConfig);
