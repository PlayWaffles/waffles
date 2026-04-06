import { z } from "zod";

const isServer = typeof window === "undefined";

const envSchema = z.object({
  // Server-only (optional on client, required on server)
  NEYNAR_API_KEY: isServer
    ? z.string().min(1, "NEYNAR_API_KEY is required")
    : z.string().optional(),

  // Database
  DATABASE_URL: isServer
    ? z.string().min(1, "DATABASE_URL is required")
    : z.string().optional(),
  AUTH_SECRET: z.string().optional(),

  // Chain role keys (server-only, optional - only needed for admin operations)
  DEFAULT_ADMIN_PRIVATE_KEY: z.string().optional(),
  SUPER_ADMIN_PRIVATE_KEY: z.string().optional(),
  OPERATOR_PRIVATE_KEY: z.string().optional(),
  SETTLER_PRIVATE_KEY: z.string().optional(),

  // PartyKit
  PARTYKIT_SECRET: isServer
    ? z.string().min(1, "PARTYKIT_SECRET is required")
    : z.string().optional(),
  NEXT_PUBLIC_PARTYKIT_HOST: z
    .string()
    .min(1, "NEXT_PUBLIC_PARTYKIT_HOST is required"),

  // Cloudinary (media storage with public URLs)
  CLOUDINARY_CLOUD_NAME: isServer
    ? z.string().min(1, "CLOUDINARY_CLOUD_NAME is required")
    : z.string().optional(),
  CLOUDINARY_API_KEY: isServer
    ? z.string().min(1, "CLOUDINARY_API_KEY is required")
    : z.string().optional(),
  CLOUDINARY_API_SECRET: isServer
    ? z.string().min(1, "CLOUDINARY_API_SECRET is required")
    : z.string().optional(),

  // Client
  NEXT_PUBLIC_ONCHAINKIT_API_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_ONCHAINKIT_API_KEY is required"),
  NEXT_PUBLIC_BASE_MAINNET_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_BASE_BUILDER_CODE: z.string().optional(),
  NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_BASE_APP: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_SEPOLIA: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_MINIPAY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_APP: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_MINIPAY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_BLOCK_EXPLORER_URL: z.string().url().optional(),
  NEXT_PUBLIC_LEADERBOARD_PAGE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(25),
  NEXT_PUBLIC_TREASURY_WALLET: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Treasury Wallet address")
    .optional(),
  NEXT_PUBLIC_HOME_URL_PATH: z
    .string()
    .min(1, "NEXT_PUBLIC_HOME_URL_PATH is required"),

  // Account Association (optional for development)
  NEXT_PUBLIC_ACCOUNT_ASSOCIATION_HEADER: z.string().optional(),
  NEXT_PUBLIC_ACCOUNT_ASSOCIATION_PAYLOAD: z.string().optional(),
  NEXT_PUBLIC_ACCOUNT_ASSOCIATION_SIGNATURE: z.string().optional(),

  // URLs
  NEXT_PUBLIC_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
});

const getEnv = () => {
  const parsed = envSchema.safeParse({
    NEYNAR_API_KEY: process.env.NEYNAR_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    DEFAULT_ADMIN_PRIVATE_KEY: process.env.DEFAULT_ADMIN_PRIVATE_KEY,
    SUPER_ADMIN_PRIVATE_KEY: process.env.SUPER_ADMIN_PRIVATE_KEY,
    OPERATOR_PRIVATE_KEY: process.env.OPERATOR_PRIVATE_KEY,
    SETTLER_PRIVATE_KEY: process.env.SETTLER_PRIVATE_KEY,
    PARTYKIT_SECRET: process.env.PARTYKIT_SECRET,
    NEXT_PUBLIC_PARTYKIT_HOST: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    NEXT_PUBLIC_ONCHAINKIT_API_KEY: process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
    NEXT_PUBLIC_BASE_MAINNET_RPC_URL:
      process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL,
    NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL:
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_BASE_BUILDER_CODE: process.env.NEXT_PUBLIC_BASE_BUILDER_CODE,
    NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS:
      process.env.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS,
    NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER:
      process.env.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER,
    NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_BASE_APP:
      process.env.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_BASE_APP,
    NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET:
      process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET,
    NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_SEPOLIA:
      process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_SEPOLIA,
    NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_MINIPAY:
      process.env.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_MINIPAY,
    NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS:
      process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS,
    NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER:
      process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER,
    NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_APP:
      process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_APP,
    NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_MINIPAY:
      process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_MINIPAY,
    NEXT_PUBLIC_BLOCK_EXPLORER_URL:
      process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL,
    NEXT_PUBLIC_LEADERBOARD_PAGE_SIZE:
      process.env.NEXT_PUBLIC_LEADERBOARD_PAGE_SIZE,
    NEXT_PUBLIC_TREASURY_WALLET: process.env.NEXT_PUBLIC_TREASURY_WALLET,
    NEXT_PUBLIC_HOME_URL_PATH: process.env.NEXT_PUBLIC_HOME_URL_PATH,
    NEXT_PUBLIC_ACCOUNT_ASSOCIATION_HEADER:
      process.env.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_HEADER,
    NEXT_PUBLIC_ACCOUNT_ASSOCIATION_PAYLOAD:
      process.env.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_PAYLOAD,
    NEXT_PUBLIC_ACCOUNT_ASSOCIATION_SIGNATURE:
      process.env.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_SIGNATURE,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });

  if (!parsed.success) {
    // Only log on server to avoid exposing errors to client
    if (typeof window === "undefined") {
      console.error(
        "❌ Invalid environment variables:",
        JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
      );
      throw new Error("Invalid environment variables");
    } else {
      // On client, just log to console but don't crash
      console.warn(
        "⚠️ Environment validation failed (non-fatal on client):",
        parsed.error.flatten().fieldErrors
      );
      // Return defaults for client
      return {
        rootUrl: "http://localhost:3000",
        neynarApiKey: "",
        databaseUrl: "",
        authSecret: undefined,
        defaultAdminPrivateKey: undefined,
        operatorPrivateKey: undefined,
        settlerPrivateKey: undefined,
        partykitSecret: "",
        partykitHost: "",
        cloudinaryCloudName: "",
        cloudinaryApiKey: "",
        cloudinaryApiSecret: "",
        nextPublicOnchainkitApiKey: "",
        nextPublicBaseMainnetRpcUrl: "https://mainnet.base.org",
        nextPublicBaseSepoliaRpcUrl: "https://sepolia.base.org",
        nextPublicBaseBuilderCode: undefined,
        nextPublicWaffleContractAddress:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicWaffleContractAddressFarcaster:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicWaffleContractAddressBaseApp:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicPaymentTokenAddressBaseMainnet:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicPaymentTokenAddressBaseSepolia:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicWaffleContractAddressMiniPay:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicPaymentTokenAddress:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicPaymentTokenAddressFarcaster:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicPaymentTokenAddressBaseApp:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicPaymentTokenAddressMiniPay:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nextPublicBlockExplorerUrl: "https://celo-sepolia.blockscout.com",
        nextPublicLeaderboardPageSize: 25,
        homeUrlPath: "",
        nextPublicTreasuryWallet:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        accountAssociation: {
          header: undefined,
          payload: undefined,
          signature: undefined,
        },
      };
    }
  }

  const data = parsed.data;

  const resolveRootUrl = () => {
    if (data.NEXT_PUBLIC_URL) return data.NEXT_PUBLIC_URL;
    if (data.NEXT_PUBLIC_APP_URL) return data.NEXT_PUBLIC_APP_URL;
    if (
      data.VERCEL_ENV === "production" &&
      data.VERCEL_PROJECT_PRODUCTION_URL
    ) {
      return `https://${data.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    if (data.VERCEL_URL) return `https://${data.VERCEL_URL}`;
    return "http://localhost:3000";
  };

  return {
    rootUrl: resolveRootUrl().replace(/\/$/, ""),
    neynarApiKey: data.NEYNAR_API_KEY!,
    // Database
    databaseUrl: data.DATABASE_URL,
    authSecret: data.AUTH_SECRET,
    // Chain role keys
    defaultAdminPrivateKey:
      data.DEFAULT_ADMIN_PRIVATE_KEY || data.SUPER_ADMIN_PRIVATE_KEY,
    operatorPrivateKey: data.OPERATOR_PRIVATE_KEY,
    settlerPrivateKey: data.SETTLER_PRIVATE_KEY,
    // PartyKit
    partykitSecret: data.PARTYKIT_SECRET,
    partykitHost: data.NEXT_PUBLIC_PARTYKIT_HOST,
    // Cloudinary (media storage with public URLs)
    cloudinaryCloudName: data.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: data.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: data.CLOUDINARY_API_SECRET,
    // Client-side
    nextPublicOnchainkitApiKey: data.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
    nextPublicBaseMainnetRpcUrl:
      data.NEXT_PUBLIC_BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
    nextPublicBaseSepoliaRpcUrl:
      data.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    nextPublicBaseBuilderCode: data.NEXT_PUBLIC_BASE_BUILDER_CODE,
    nextPublicWaffleContractAddress: (data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicWaffleContractAddressFarcaster: (data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER ||
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicWaffleContractAddressBaseApp: (data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_BASE_APP ||
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER ||
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicPaymentTokenAddressBaseMainnet: (data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicPaymentTokenAddressBaseSepolia: (data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_SEPOLIA ||
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicWaffleContractAddressMiniPay: (data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_MINIPAY ||
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicPaymentTokenAddress: (data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicPaymentTokenAddressFarcaster: (data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER ||
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicPaymentTokenAddressBaseApp: (data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_APP ||
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER ||
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET ||
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicPaymentTokenAddressMiniPay: (data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_MINIPAY ||
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    nextPublicBlockExplorerUrl:
      data.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
      "https://celo-sepolia.blockscout.com",
    nextPublicLeaderboardPageSize: data.NEXT_PUBLIC_LEADERBOARD_PAGE_SIZE,
    homeUrlPath: data.NEXT_PUBLIC_HOME_URL_PATH,
    nextPublicTreasuryWallet: (data.NEXT_PUBLIC_TREASURY_WALLET ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    accountAssociation: {
      header: data.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_HEADER,
      payload: data.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_PAYLOAD,
      signature: data.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_SIGNATURE,
    },
  };
};

export const env = getEnv();
