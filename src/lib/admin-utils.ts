import { UserPlatform } from "@prisma";

export type PlatformWhere = { platform: UserPlatform } | Record<string, never>;

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
