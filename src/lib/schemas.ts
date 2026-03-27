import { z } from "zod";

export const userPlatformSchema = z.enum(["FARCASTER", "MINIPAY"]);

// --- Common Schemas ---
export const fidSchema = z.coerce
  .number()
  .int()
  .positive("Invalid FID format.");
export const walletSchema = z.string().trim().optional().nullable();
export const userIdSchema = z.string().trim().min(1, "User ID is required.");
export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username cannot be empty.")
  .optional()
  .nullable();
export const pfpUrlSchema = z
  .string()
  .pipe(z.url("Invalid PFP URL."))
  .optional()
  .nullable();

// --- Invite Schemas ---
export const validateReferralSchema = z.object({
  // The 6-character code the user entered
  code: z.string().trim().length(6, "Code must be 6 characters.").toUpperCase(),
  // The logged-in user using the code
  userId: userIdSchema,
});

// --- Chat Schemas ---
export const sendMessageSchema = z.object({
  gameId: z.number().int().positive("Invalid Game ID."),
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(500, "Message exceeds 500 characters."),
  fid: fidSchema,
});

// --- Onboarding Schemas ---
export const syncUserSchema = z.object({
  platform: userPlatformSchema,
  fid: z.number().int().positive("FID must be a positive integer.").optional().nullable(),
  username: usernameSchema,
  pfpUrl: pfpUrlSchema,
  wallet: z.string().trim().optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.platform === "FARCASTER" && !value.fid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fid"],
      message: "FID is required for Farcaster users.",
    });
  }

  if (value.platform === "MINIPAY" && !value.wallet?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["wallet"],
      message: "Wallet address is required for MiniPay users.",
    });
  }
});
