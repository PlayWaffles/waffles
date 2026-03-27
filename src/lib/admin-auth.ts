import { cookies } from "next/headers";
import { prisma } from "./db";
import { env } from "./env";
import bcrypt from "bcryptjs";

const SESSION_COOKIE_NAME = "admin-session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

export interface AdminSession {
  userId: string;
  fid: number | null;
  username: string | null;
  pfpUrl: string | null;
  role: "ADMIN";
  expiresAt: number;
}

export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
  try {
    const user = await prisma.user.findFirst({
      where: { username },
      select: {
        id: true,
        fid: true,
        username: true,
        pfpUrl: true,
        role: true,
        password: true,
      },
    });

    if (!user) {
      return { success: false, error: "Invalid credentials" };
    }

    if (user.role !== "ADMIN") {
      return { success: false, error: "Access denied: Admin role required" };
    }

    if (!user.password) {
      return {
        success: false,
        error: "Password not set. Please complete setup.",
      };
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return { success: false, error: "Invalid credentials" };
    }

    const session: AdminSession = {
      userId: user.id,
      fid: user.fid,
      username: user.username,
      pfpUrl: user.pfpUrl,
      role: "ADMIN",
      expiresAt: Date.now() + SESSION_DURATION * 1000,
    };

    return { success: true, session };
  } catch (error) {
    console.error("Admin auth error:", error);
    return { success: false, error: "Authentication failed" };
  }
}

export async function createAdminSession(session: AdminSession): Promise<void> {
  const cookieStore = await cookies();
  const sessionData = JSON.stringify(session);

  cookieStore.set(SESSION_COOKIE_NAME, sessionData, {
    httpOnly: true,
    secure: env.rootUrl.startsWith("https://"),
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const session: AdminSession = JSON.parse(sessionCookie.value);

    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch (error) {
    console.error("Failed to get admin session:", error);
    return null;
  }
}

export async function requireAdminSession(): Promise<{
  authenticated: boolean;
  session?: AdminSession;
  error?: string;
}> {
  const session = await getAdminSession();

  if (!session) {
    return {
      authenticated: false,
      error: "Not authenticated",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    return {
      authenticated: false,
      error: "Admin access revoked",
    };
  }

  return {
    authenticated: true,
    session,
  };
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function createAdminAccount(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user exists by username
    const existingUser = await prisma.user.findFirst({
      where: { username },
      select: { id: true, role: true, password: true },
    });

    if (!existingUser) {
      return {
        success: false,
        error: "User not found. Please sign up in the main app first.",
      };
    }

    if (existingUser.role !== "ADMIN") {
      return {
        success: false,
        error: "You must be manually assigned the Admin role first.",
      };
    }

    if (existingUser.password) {
      return {
        success: false,
        error: "Admin account already exists for this user",
      };
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Create admin account error:", error);
    return { success: false, error: "Failed to create admin account" };
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
