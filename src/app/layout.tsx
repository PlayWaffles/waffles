import "./globals.css";
import { fontBody, fontDisplay, fontInput } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Script from "next/script";
import { env } from "@/lib/env";

const UMAMI_HOST = process.env.NEXT_PUBLIC_UMAMI_HOST;
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export const metadata: Metadata = {
  title: "Waffles",
  description: "Guess the movie scene. Win real prizes.",
  keywords: ["waffles", "games", "movie scenes", "trivia", "minipay", "celo", "farcaster"],
  openGraph: {
    title: "Waffles",
    description: "Guess the movie scene. Win real prizes.",
    url: env.rootUrl,
    type: "website",
    images: [
      {
        url: "/images/hero-image.webp",
        width: 1200,
        height: 630,
        alt: "Waffles OG Image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Waffles",
    description: "Guess the movie scene. Win real prizes.",
    images: ["/images/hero-image.webp"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  other: {
    "base:app_id": "69cc9bb31aacdcc17b25514a",  
  },
  metadataBase: new URL(env.rootUrl),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(
        fontBody.variable,
        fontDisplay.variable,
        fontInput.variable,
        "suppress-hydration-warning"
      )}
      suppressHydrationWarning
    >
      <head>
        <meta
          name="talentapp:project_verification"
          content="cb7e8f3cc47a4f96fa8ae003b816bb151935001d54d2b59921f406883f8654aec81065f628abf64c5a30798a55236c29f009254a77edfb310033f31589aaa359"
        />
        <meta
          name="app_transfer_verification"
          content="69cc9bb31aacdcc17b25514a"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        {UMAMI_HOST && UMAMI_WEBSITE_ID ? (
          <Script
            defer
            src={`${UMAMI_HOST.replace(/\/$/, "")}/script.js`}
            data-website-id={UMAMI_WEBSITE_ID}
            data-domains="playwaffles.fun,www.playwaffles.fun,miniapp.playwaffles.fun,waffles-staging.cyberverse.cloud"
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
