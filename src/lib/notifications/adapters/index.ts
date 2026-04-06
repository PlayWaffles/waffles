import { UserPlatform } from "@prisma";
import type { PlatformNotifier } from "./types";
import { farcasterNotifier } from "./farcaster";
import { minipayNotifier } from "./minipay";

const notifiers: Record<UserPlatform, PlatformNotifier> = {
  [UserPlatform.FARCASTER]: farcasterNotifier,
  [UserPlatform.MINIPAY]: minipayNotifier,
  [UserPlatform.BASE_APP]: minipayNotifier,
};

export function getNotifier(platform: UserPlatform): PlatformNotifier {
  return notifiers[platform];
}

export type { PlatformNotifier } from "./types";
