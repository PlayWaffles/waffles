import { UserPlatform, type Prisma } from "@prisma";

import { normalizeAddress } from "@/lib/auth";

function normalizeUsername(username: string) {
  return username.trim().replace(/^@/, "").toLowerCase();
}

export async function resolveCanonicalFarcasterUser(
  tx: Prisma.TransactionClient,
  userId: string,
  username?: string | null,
) {
  const currentUser = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      platform: true,
      fid: true,
      username: true,
    },
  });

  if (!currentUser || currentUser.platform !== UserPlatform.FARCASTER) {
    throw new Error("Only Farcaster users can use this sync");
  }

  const normalizedUsername = username ? normalizeUsername(username) : null;
  if (!normalizedUsername) {
    return currentUser;
  }

  const matchingUser = await tx.user.findFirst({
    where: {
      id: { not: currentUser.id },
      platform: UserPlatform.FARCASTER,
      username: { equals: normalizedUsername, mode: "insensitive" },
    },
    select: {
      id: true,
      platform: true,
      fid: true,
      username: true,
    },
  });

  if (!matchingUser) {
    return currentUser;
  }

  if (
    currentUser.fid &&
    matchingUser.fid &&
    currentUser.fid !== matchingUser.fid
  ) {
    return currentUser;
  }

  if (
    currentUser.fid &&
    !matchingUser.fid
  ) {
    await tx.user.update({
      where: { id: currentUser.id },
      data: { fid: null },
    });

    return tx.user.update({
      where: { id: matchingUser.id },
      data: {
        fid: currentUser.fid,
        username: username ?? matchingUser.username,
      },
      select: {
        id: true,
        platform: true,
        fid: true,
        username: true,
      },
    });
  }

  return matchingUser;
}

export async function attachWalletToFarcasterUser(
  tx: Prisma.TransactionClient,
  userId: string,
  wallet: string,
) {
  const normalizedWallet = normalizeAddress(wallet);
  if (!normalizedWallet) {
    throw new Error("Invalid wallet address");
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      platform: true,
      wallet: true,
    },
  });

  if (!user || user.platform !== UserPlatform.FARCASTER) {
    throw new Error("Only Farcaster users can use this sync");
  }

  const [directWalletConflict, linkedWalletConflict] = await Promise.all([
    tx.user.findFirst({
      where: {
        wallet: normalizedWallet,
        id: { not: user.id },
      },
      select: { id: true },
    }),
    tx.userWallet.findFirst({
      where: {
        wallet: normalizedWallet,
        userId: { not: user.id },
      },
      select: { id: true },
    }),
  ]);

  if (directWalletConflict || linkedWalletConflict) {
    throw new Error("This wallet is already linked to another user");
  }

  if (!user.wallet) {
    await tx.user.update({
      where: { id: user.id },
      data: { wallet: normalizedWallet },
    });
  }

  await tx.userWallet.upsert({
    where: { wallet: normalizedWallet },
    update: {
      lastUsedAt: new Date(),
    },
    create: {
      userId: user.id,
      wallet: normalizedWallet,
      platform: UserPlatform.FARCASTER,
      lastUsedAt: new Date(),
    },
  });

  return normalizedWallet;
}

export async function farcasterUserHasWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  wallet: string,
) {
  const normalizedWallet = normalizeAddress(wallet);

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      wallet: true,
      platform: true,
    },
  });

  if (!user || user.platform !== UserPlatform.FARCASTER) {
    return false;
  }

  if (user.wallet && normalizeAddress(user.wallet) === normalizedWallet) {
    return true;
  }

  const linkedWallet = await tx.userWallet.findUnique({
    where: { wallet: normalizedWallet },
    select: { userId: true },
  });

  return linkedWallet?.userId === userId;
}

export async function touchFarcasterWalletUsage(
  tx: Prisma.TransactionClient,
  userId: string,
  wallet: string,
) {
  const normalizedWallet = normalizeAddress(wallet);

  await tx.userWallet.updateMany({
    where: {
      userId,
      wallet: normalizedWallet,
      platform: UserPlatform.FARCASTER,
    },
    data: {
      lastUsedAt: new Date(),
    },
  });
}

const WALLET_USER_SELECT = {
  id: true,
  username: true,
  pfpUrl: true,
  wallet: true,
  hasGameAccess: true,
  isBanned: true,
} as const;

export async function resolveUserByWalletForPlatform(
  tx: Prisma.TransactionClient,
  platform: UserPlatform,
  wallet: string,
) {
  const normalizedWallet = normalizeAddress(wallet);

  if (platform === UserPlatform.MINIPAY) {
    return tx.user.findFirst({
      where: {
        platform,
        wallet: { equals: normalizedWallet, mode: "insensitive" },
      },
      select: WALLET_USER_SELECT,
    });
  }

  return tx.user.findFirst({
    where: {
      platform,
      OR: [
        { wallet: { equals: normalizedWallet, mode: "insensitive" } },
        { wallets: { some: { wallet: normalizedWallet } } },
      ],
    },
    select: WALLET_USER_SELECT,
  });
}
