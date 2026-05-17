import { env } from "@/lib/env";

export function getMiniAppHomeUrl() {
  const path = env.homeUrlPath.startsWith("/") ? env.homeUrlPath : `/${env.homeUrlPath}`;
  return `${env.rootUrl}${path}`;
}

export function buildMiniAppEmbed(params: {
  imageUrl: string;
  buttonTitle?: string;
  url?: string;
}) {
  return {
    version: "1",
    imageUrl: params.imageUrl,
    button: {
      title: params.buttonTitle || "Open Waffles",
      action: {
        type: "launch_frame",
        name: "Waffles",
        url: params.url || getMiniAppHomeUrl(),
        splashImageUrl: `${env.rootUrl}/icon.webp`,
        splashBackgroundColor: "#0B0B10",
      },
    },
  };
}

