export type ChainPlatform = "FARCASTER" | "MINIPAY" | "BASE_APP";

export function assertChainPlatform(platform: string): ChainPlatform {
  if (platform === "MINIPAY") return "MINIPAY";
  if (platform === "BASE_APP") return "BASE_APP";
  return "FARCASTER";
}
