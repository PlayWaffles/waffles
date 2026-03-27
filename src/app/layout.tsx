import "./globals.css";
import { fontBody, fontDisplay, fontInput } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Waffles",
  description: "Pattern-matching tournaments built for everyone.",
  keywords: ["waffles", "games", "minipay", "celo", "tournaments", "fun"],
  openGraph: {
    title: "Waffles",
    description: "Play daily social games",
    url: env.rootUrl,
    type: "website",
    images: [
      {
        url: "/images/hero-image.png",
        width: 1200,
        height: 630,
        alt: "Waffles OG Image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Waffles",
    description: "Play daily social games",
    images: ["/images/hero-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
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
        {/* Preload onboarding images - browser fetches immediately */}
        <link rel="preload" as="image" href="/logo-onboarding.png" />
        <link
          rel="preload"
          as="image"
          href="/images/illustrations/waffle-ticket.png"
        />
        <link
          rel="preload"
          as="image"
          href="/images/illustrations/money-bag.png"
        />
        <link rel="preload" as="image" href="/images/illustrations/crown.png" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
