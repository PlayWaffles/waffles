import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { verifyMessage } from "viem";
import { createClient as createQuickAuthClient } from "@farcaster/quick-auth";

// Module-level singleton — avoids re-initialization per request
const farcasterAuthClient = createQuickAuthClient();
import { Prisma, UserPlatform } from "@prisma";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { generateInviteCode } from "@/lib/utils";
import { parseCookieHeader } from "@/lib/platform/server";

const SESSION_COOKIE = "waffles_session";
const NONCE_COOKIE = "waffles_auth_nonce";
const NONCE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_RETRIES = 10;

const JWT_TYPE_SESSION = "session" as const;
const JWT_TYPE_NONCE = "nonce" as const;

function getUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isPreviousUtcDate(previous: Date, current: Date) {
  const previousDay = Date.UTC(
    previous.getUTCFullYear(),
    previous.getUTCMonth(),
    previous.getUTCDate(),
  );
  const currentDay = Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate(),
  );

  return currentDay - previousDay === 24 * 60 * 60 * 1000;
}

function getAuthSecret() {
  const secret = env.authSecret || env.partykitSecret;
  if (!secret) {
    throw new Error("AUTH_SECRET or PARTYKIT_SECRET must be configured");
  }
  return new TextEncoder().encode(secret);
}

export function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

export function buildSignInMessage(address: string, nonce: string) {
  return [
    "Sign in to Waffles on Celo MiniPay.",
    "",
    `Address: ${normalizeAddress(address)}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

export interface AuthResult {
  userId: string;
  platform: UserPlatform;
  fid?: number;
  address?: string;
  username?: string | null;
  pfpUrl?: string | null;
}

export interface ApiError {
  error: string;
  code?: string;
}

interface SessionPayload {
  type: typeof JWT_TYPE_SESSION;
  userId: string;
  platform: UserPlatform;
  fid?: number;
  address?: string;
}

interface NoncePayload {
  type: typeof JWT_TYPE_NONCE;
  address: string;
  nonce: string;
}

async function signPayload(payload: SessionPayload | NoncePayload, expiresIn: string) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getAuthSecret());
}

async function readCookieToken(name: string) {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value ?? null;
}

async function setCookieToken(name: string, value: string, maxAgeSeconds: number) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.rootUrl.startsWith("https://"),
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(NONCE_COOKIE);
}

const USER_PROFILE_SELECT = {
  id: true,
  fid: true,
  wallet: true,
  platform: true,
  username: true,
  pfpUrl: true,
} as const;

async function ensureUser(
  where: Prisma.UserWhereUniqueInput,
  createData: Omit<Prisma.UserCreateInput, "inviteCode">,
) {
  const existing = await prisma.user.findUnique({
    where,
    select: USER_PROFILE_SELECT,
  });

  if (existing) {
    return existing;
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await prisma.user.create({
        data: {
          ...createData,
          inviteCode: generateInviteCode(),
        } as Prisma.UserCreateInput,
        select: USER_PROFILE_SELECT,
      });
    } catch (error) {
      const isInviteCodeCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes("inviteCode");

      if (!isInviteCodeCollision || i === MAX_RETRIES - 1) {
        throw error;
      }
    }
  }

  throw new Error("Failed to create user");
}

function ensureUserByWallet(address: string) {
  return ensureUser(
    { wallet: normalizeAddress(address) },
    { platform: UserPlatform.MINIPAY, wallet: normalizeAddress(address) },
  );
}

function ensureUserByFid(fid: number) {
  return ensureUser(
    { fid },
    { platform: UserPlatform.FARCASTER, fid },
  );
}

async function touchUserLoginStreak(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentStreak: true,
      bestStreak: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return;
  }

  const now = new Date();
  const todayKey = getUtcDateKey(now);
  const lastLoginKey = user.lastLoginAt ? getUtcDateKey(user.lastLoginAt) : null;

  if (lastLoginKey === todayKey) {
    return;
  }

  const nextCurrentStreak =
    user.lastLoginAt && isPreviousUtcDate(user.lastLoginAt, now)
      ? Math.max(user.currentStreak, 0) + 1
      : 1;

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: nextCurrentStreak,
      bestStreak: Math.max(user.bestStreak, nextCurrentStreak),
      lastLoginAt: now,
    },
  });
}

export async function createNonce(address: string) {
  const normalizedAddress = normalizeAddress(address);
  const nonce = crypto.randomUUID();
  const token = await signPayload(
    { type: JWT_TYPE_NONCE, address: normalizedAddress, nonce },
    `${NONCE_TTL_SECONDS}s`,
  );

  await setCookieToken(NONCE_COOKIE, token, NONCE_TTL_SECONDS);

  return {
    nonce,
    message: buildSignInMessage(normalizedAddress, nonce),
  };
}

export async function verifyWalletSignature(address: string, signature: string) {
  const normalizedAddress = normalizeAddress(address);
  const nonceToken = await readCookieToken(NONCE_COOKIE);

  if (!nonceToken) {
    return null;
  }

  const { payload } = await jwtVerify(nonceToken, getAuthSecret());

  if (
    payload.type !== JWT_TYPE_NONCE ||
    typeof payload.address !== "string" ||
    typeof payload.nonce !== "string"
  ) {
    return null;
  }

  if (normalizeAddress(payload.address) !== normalizedAddress) {
    return null;
  }

  const message = buildSignInMessage(normalizedAddress, payload.nonce);
  const verified = await verifyMessage({
    address: normalizedAddress as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });

  if (!verified) {
    return null;
  }

  const user = await ensureUserByWallet(normalizedAddress);
  await touchUserLoginStreak(user.id);
  const session = await signPayload(
    {
      type: JWT_TYPE_SESSION,
      userId: user.id,
      platform: UserPlatform.MINIPAY,
      address: normalizedAddress,
    },
    `${SESSION_TTL_SECONDS}s`,
  );

  await setCookieToken(SESSION_COOKIE, session, SESSION_TTL_SECONDS);
  await clearNonceCookie();

  return {
    userId: user.id,
    platform: UserPlatform.MINIPAY,
    address: normalizedAddress,
  };
}

async function clearNonceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(NONCE_COOKIE);
}

export async function getAuthFromRequest(
  request?: Request,
): Promise<AuthResult | null> {
  const authorizationHeader = request?.headers.get("authorization");
  const bearerToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (bearerToken) {
    try {
      const domain = new URL(env.rootUrl).host;
      const payload = await farcasterAuthClient.verifyJwt({ token: bearerToken, domain });
      const user = await ensureUserByFid(payload.sub);
      await touchUserLoginStreak(user.id);

      return {
        userId: user.id,
        platform: UserPlatform.FARCASTER,
        fid: payload.sub,
        username: user.username,
        pfpUrl: user.pfpUrl,
      };
    } catch {
      return null;
    }
  }

  const sessionToken = request
    ? parseCookieHeader(request.headers.get("cookie"), SESSION_COOKIE)
    : await readCookieToken(SESSION_COOKIE);

  if (!sessionToken) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(sessionToken, getAuthSecret());
    if (
      payload.type !== JWT_TYPE_SESSION ||
      typeof payload.userId !== "string" ||
      (payload.platform !== UserPlatform.MINIPAY &&
        payload.platform !== UserPlatform.FARCASTER)
    ) {
      return null;
    }

    // Streak already recorded at login — skip on session reuse to avoid a DB hit per request
    return {
      userId: payload.userId,
      platform: payload.platform,
      fid: typeof payload.fid === "number" ? payload.fid : undefined,
      address:
        typeof payload.address === "string"
          ? normalizeAddress(payload.address)
          : undefined,
    };
  } catch {
    return null;
  }
}

const currentUserSelect = {
  id: true,
  platform: true,
  username: true,
  pfpUrl: true,
  wallet: true,
} as const;

export async function getCurrentUser() {
  const auth = await getAuthFromRequest();
  if (!auth) return null;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: currentUserSelect,
  });

  return user ?? null;
}

export async function requireCurrentUser() {
  const auth = await getAuthFromRequest();
  if (!auth) {
    throw new Error("Authentication required");
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: currentUserSelect,
  });

  if (!user) {
    throw new Error("User not found");
  }

  return { auth, user };
}

export function withAuth<T extends object = Record<string, string>>(
  handler: (
    request: NextRequest,
    auth: AuthResult,
    params: T,
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<T> },
  ): Promise<NextResponse> => {
    const auth = await getAuthFromRequest(request);

    if (!auth) {
      return NextResponse.json<ApiError>(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const params = await context.params;
    return handler(request, auth, params);
  };
}

export function withOptionalAuth<T extends object = Record<string, string>>(
  handler: (
    request: NextRequest,
    auth: AuthResult | null,
    params: T,
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<T> },
  ): Promise<NextResponse> => {
    const auth = await getAuthFromRequest(request);
    const params = await context.params;
    return handler(request, auth, params);
  };
}
