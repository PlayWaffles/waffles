import { UserPlatform } from "@prisma";
import { excludesTestnet, gamePlatformsForPlatform } from "@/lib/platform/query";
import { env } from "@/lib/env";

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

export function buildAdminGameWhere(platform?: string) {
    const prefersTestnetGames =
        process.env.NODE_ENV !== "production" && env.rootUrl.includes("localhost");
    const pf = buildPlatformWhere(platform);
    if (pf.platform) {
        const platforms = gamePlatformsForPlatform(pf.platform);
        const platformWhere =
            platforms.length === 1 ? { platform: pf.platform } : { platform: { in: platforms } };
        if (prefersTestnetGames && (pf.platform === UserPlatform.FARCASTER || pf.platform === UserPlatform.BASE_APP)) {
            return { ...platformWhere, isTestnet: true };
        }
        return excludesTestnet(pf.platform)
            ? { ...platformWhere, isTestnet: false }
            : platformWhere;
    }

    if (prefersTestnetGames) {
        return {
            OR: [
                { platform: UserPlatform.MINIPAY },
                { platform: UserPlatform.FARCASTER, isTestnet: true },
                { platform: UserPlatform.BASE_APP, isTestnet: true },
            ],
        };
    }

    return {
        OR: [
            { platform: UserPlatform.MINIPAY },
            { platform: UserPlatform.FARCASTER, isTestnet: false },
            { platform: UserPlatform.BASE_APP, isTestnet: false },
        ],
    };
}

export function buildAdminEntryWhere(platform?: string) {
    const gameWhere = buildAdminGameWhere(platform);
    return { game: gameWhere };
}

export function buildProductionGameWhere(platform?: string) {
    const pf = buildPlatformWhere(platform);
    if (pf.platform) {
        const platforms = gamePlatformsForPlatform(pf.platform);
        const platformWhere =
            platforms.length === 1 ? { platform: pf.platform } : { platform: { in: platforms } };
        return excludesTestnet(pf.platform)
            ? { ...platformWhere, isTestnet: false }
            : platformWhere;
    }

    return {
        OR: [
            { platform: UserPlatform.MINIPAY },
            { platform: UserPlatform.FARCASTER, isTestnet: false },
            { platform: UserPlatform.BASE_APP, isTestnet: false },
        ],
    };
}

export function buildProductionEntryWhere(platform?: string) {
    const gameWhere = buildProductionGameWhere(platform);
    return { game: gameWhere };
}

export function calculateProtocolRevenue(grossAmount: number | null | undefined) {
    return (grossAmount || 0) * PLATFORM_FEE_RATE;
}

export function calculatePrizePoolContribution(grossAmount: number | null | undefined) {
    const gross = grossAmount || 0;
    const net = gross - calculateProtocolRevenue(gross);
    return Math.round(net * 1_000_000) / 1_000_000;
}
