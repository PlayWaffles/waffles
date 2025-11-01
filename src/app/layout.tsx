import "./globals.css";
import { fontBody, fontDisplay, fontInput } from "@/lib/fonts";
import { Metadata } from "next";

import { cn } from "@/lib/utils";

import { Providers } from "@/components/providers/";
import { minikitConfig } from "../../minikit.config";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: minikitConfig.miniapp.name,
    description: minikitConfig.miniapp.description,
    other: {
      "fc:frame": JSON.stringify({
        version: minikitConfig.miniapp.version,
        imageUrl: minikitConfig.miniapp.heroImageUrl,
        button: {
          title: `Launch ${minikitConfig.miniapp.name}`,
          action: {
            name: `Launch ${minikitConfig.miniapp.name}`,
            type: "launch_frame",
            url: minikitConfig.miniapp.homeUrl,
            splashImageUrl: minikitConfig.miniapp.splashImageUrl,
            splashBackgroundColor: minikitConfig.miniapp.splashBackgroundColor,
          },
        },
      }),
    },
  };
}

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
      <body
        className={cn(
          "text-foreground app-background relative h-full overflow-hidden"
        )}
      >
        <Providers>
          <div className="h-dvh flex flex-col overflow-hidden">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
