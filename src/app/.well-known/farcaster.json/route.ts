import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getMiniAppHomeUrl } from "@/lib/farcaster";

export function GET() {
  const iconUrl = `${env.rootUrl}/icon.png`;
  const imageUrl = `${env.rootUrl}/images/hero-image.png`;

  return NextResponse.json({
    accountAssociation: {
      header: env.accountAssociation.header,
      payload: env.accountAssociation.payload,
      signature: env.accountAssociation.signature,
    },
    miniapp: {
      version: "1",
      name: "Waffles",
      iconUrl,
      homeUrl: getMiniAppHomeUrl(),
      imageUrl,
      buttonTitle: "Open Waffles",
      splashImageUrl: iconUrl,
      splashBackgroundColor: "#0B0B10",
      webhookUrl: `${env.rootUrl}/api/webhook/notify`,
    },
  });
}

