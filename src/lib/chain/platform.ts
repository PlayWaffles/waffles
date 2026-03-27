export type ChainPlatform = "FARCASTER" | "MINIPAY";

export function assertChainPlatform(platform: string): ChainPlatform {
  return platform === "MINIPAY" ? "MINIPAY" : "FARCASTER";
}
