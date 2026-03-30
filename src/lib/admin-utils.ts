import { UserPlatform } from "@prisma";

export type PlatformWhere = { platform: UserPlatform } | Record<string, never>;
export const PLATFORM_FEE_RATE = 0.2;

export function buildPlatformWhere(platform?: string): PlatformWhere {
    if (platform && Object.values(UserPlatform).includes(platform as UserPlatform)) {
        return { platform: platform as UserPlatform };
    }
    return {};
}

export function buildGamePlatformWhere(platform?: string) {
    const pf = buildPlatformWhere(platform);
    return pf.platform ? { game: pf } : {};
}

export function buildProductionGameWhere(platform?: string) {
    const pf = buildPlatformWhere(platform);
    return pf.platform
        ? { platform: pf.platform, isTestnet: false }
        : { isTestnet: false };
}

export function buildProductionEntryWhere(platform?: string) {
    const gameWhere = buildProductionGameWhere(platform);
    return { game: gameWhere };
}

export function calculateProtocolRevenue(grossAmount: number | null | undefined) {
    return (grossAmount || 0) * PLATFORM_FEE_RATE;
}
