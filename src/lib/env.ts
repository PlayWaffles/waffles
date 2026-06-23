import { z } from "zod";

const isServer = typeof window === "undefined";

function isProductionRuntime() {
  if (process.env.NODE_ENV !== "production") return false;
  return !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";
}

function cleanEnvString(value: unknown) {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

const addressSchema = z.preprocess(
  cleanEnvString,
  z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
);

const optionalUrlSchema = z.preprocess(
  cleanEnvString,
  z.string().url().optional(),
);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

type AddressString = `0x${string}`;

function formatEnvErrors(error: z.ZodError) {
  return Object.entries(error.flatten().fieldErrors)
    .map(([name, messages]) => {
      const details = Array.isArray(messages) ? messages.join(", ") : String(messages);
      return `${name}: ${details}`;
    })
    .join("; ");
}

function requireAddress(
  name: string,
  value: string | undefined,
): AddressString {
  if (!value || value.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`${name} is not configured`);
  }

  return value as AddressString;
}

function resolveAddress(
  name: string,
  ...values: (string | undefined)[]
): AddressString {
  return requireAddress(name, values.find(Boolean));
}

const envSchema = z.object({
  // Server-only (optional on client, required on server)
  NEYNAR_API_KEY: isServer
    ? z.string().min(1, "NEYNAR_API_KEY is required")
    : z.string().optional(),

  // Database
  DATABASE_URL: isServer
    ? z.string().min(1, "DATABASE_URL is required")
    : z.string().optional(),
  // Signs wallet session cookies and authorizes internal/cron endpoints.
  AUTH_SECRET: isServer
    ? z.string().min(1, "AUTH_SECRET is required")
    : z.string().optional(),

  // Chain role keys (server-only, optional - only needed for admin operations)
  DEFAULT_ADMIN_PRIVATE_KEY: z.string().optional(),
  SUPER_ADMIN_PRIVATE_KEY: z.string().optional(),
  OPERATOR_PRIVATE_KEY: z.string().optional(),
  SETTLER_PRIVATE_KEY: z.string().optional(),

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
  NEXT_PUBLIC_BASE_MAINNET_RPC_URL: optionalUrlSchema,
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: optionalUrlSchema,
  NEXT_PUBLIC_CELO_MAINNET_RPC_URL: optionalUrlSchema,
  NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL: optionalUrlSchema,
  NEXT_PUBLIC_CHAIN_NETWORK: z.enum(["mainnet", "testnet"], {
    error: "NEXT_PUBLIC_CHAIN_NETWORK must be mainnet or testnet",
  }),
  NEXT_PUBLIC_BASE_BUILDER_CODE: z.string().optional(),
  NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS: addressSchema,
  NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER: addressSchema,
  NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_BASE_APP: addressSchema,
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET: addressSchema,
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_SEPOLIA: addressSchema,
  NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_MINIPAY: addressSchema,
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS: addressSchema,
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER: addressSchema,
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_APP: addressSchema,
  NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_MINIPAY: addressSchema,
  NEXT_PUBLIC_BLOCK_EXPLORER_URL: optionalUrlSchema,
  NEXT_PUBLIC_LEADERBOARD_PAGE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(25),
  NEXT_PUBLIC_TREASURY_WALLET: z.preprocess(
    cleanEnvString,
    z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Treasury Wallet address")
      .optional(),
  ),
  NEXT_PUBLIC_TREASURY_WALLET_MINIPAY: addressSchema,
  NEXT_PUBLIC_HOME_URL_PATH: z
    .string()
    .min(1, "NEXT_PUBLIC_HOME_URL_PATH is required"),

  // Account Association (optional for development)
  NEXT_PUBLIC_ACCOUNT_ASSOCIATION_HEADER: z.string().optional(),
  NEXT_PUBLIC_ACCOUNT_ASSOCIATION_PAYLOAD: z.string().optional(),
  NEXT_PUBLIC_ACCOUNT_ASSOCIATION_SIGNATURE: z.string().optional(),

  // URLs
  NEXT_PUBLIC_URL: optionalUrlSchema,
  NEXT_PUBLIC_APP_URL: optionalUrlSchema,
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
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    NEXT_PUBLIC_ONCHAINKIT_API_KEY: process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
    NEXT_PUBLIC_BASE_MAINNET_RPC_URL:
      process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL,
    NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL:
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_CELO_MAINNET_RPC_URL:
      process.env.NEXT_PUBLIC_CELO_MAINNET_RPC_URL,
    NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL:
      process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_CHAIN_NETWORK: process.env.NEXT_PUBLIC_CHAIN_NETWORK,
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
    NEXT_PUBLIC_TREASURY_WALLET_MINIPAY:
      process.env.NEXT_PUBLIC_TREASURY_WALLET_MINIPAY,
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
    const message = formatEnvErrors(parsed.error);
    if (typeof window === "undefined") {
      console.error("❌ Invalid environment variables:", message);
    }

    throw new Error(`Invalid environment variables: ${message}`);
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
    isProduction: isProductionRuntime(),
    neynarApiKey: data.NEYNAR_API_KEY!,
    // Database
    databaseUrl: data.DATABASE_URL,
    authSecret: data.AUTH_SECRET,
    // Chain role keys
    defaultAdminPrivateKey:
      data.DEFAULT_ADMIN_PRIVATE_KEY || data.SUPER_ADMIN_PRIVATE_KEY,
    operatorPrivateKey: data.OPERATOR_PRIVATE_KEY,
    settlerPrivateKey: data.SETTLER_PRIVATE_KEY,
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
    nextPublicCeloMainnetRpcUrl:
      data.NEXT_PUBLIC_CELO_MAINNET_RPC_URL || "https://forno.celo.org",
    nextPublicCeloSepoliaRpcUrl:
      data.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL ||
      "https://forno.celo-sepolia.celo-testnet.org",
    nextPublicChainNetwork: data.NEXT_PUBLIC_CHAIN_NETWORK,
    nextPublicBaseBuilderCode: data.NEXT_PUBLIC_BASE_BUILDER_CODE,
    nextPublicWaffleContractAddress: data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS,
    nextPublicWaffleContractAddressFarcaster: resolveAddress(
      "NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER",
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER,
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS ||
        undefined,
    ),
    nextPublicWaffleContractAddressBaseApp: resolveAddress(
      "NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_BASE_APP",
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_BASE_APP,
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_FARCASTER ||
        data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS ||
        undefined,
    ),
    nextPublicPaymentTokenAddressBaseMainnet: requireAddress(
      "NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET",
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET,
    ),
    nextPublicPaymentTokenAddressBaseSepolia: resolveAddress(
      "NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_SEPOLIA",
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_SEPOLIA,
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER ||
        undefined,
    ),
    nextPublicWaffleContractAddressMiniPay: resolveAddress(
      "NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_MINIPAY",
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS_MINIPAY,
      data.NEXT_PUBLIC_WAFFLE_CONTRACT_ADDRESS ||
        undefined,
    ),
    nextPublicPaymentTokenAddress: data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS,
    nextPublicPaymentTokenAddressFarcaster: resolveAddress(
      "NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER",
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER,
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ||
        undefined,
    ),
    nextPublicPaymentTokenAddressBaseApp: resolveAddress(
      "NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_APP",
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_APP,
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_BASE_MAINNET ||
        data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_FARCASTER ||
        data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ||
        undefined,
    ),
    nextPublicPaymentTokenAddressMiniPay: resolveAddress(
      "NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_MINIPAY",
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS_MINIPAY,
      data.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ||
        undefined,
    ),
    nextPublicBlockExplorerUrl:
      data.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
      "https://celo-sepolia.blockscout.com",
    nextPublicLeaderboardPageSize: data.NEXT_PUBLIC_LEADERBOARD_PAGE_SIZE,
    homeUrlPath: data.NEXT_PUBLIC_HOME_URL_PATH,
    nextPublicTreasuryWallet: requireAddress(
      "NEXT_PUBLIC_TREASURY_WALLET",
      data.NEXT_PUBLIC_TREASURY_WALLET,
    ),
    nextPublicTreasuryWalletMiniPay: requireAddress(
      "NEXT_PUBLIC_TREASURY_WALLET_MINIPAY",
      data.NEXT_PUBLIC_TREASURY_WALLET_MINIPAY,
    ),
    accountAssociation: {
      header: data.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_HEADER,
      payload: data.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_PAYLOAD,
      signature: data.NEXT_PUBLIC_ACCOUNT_ASSOCIATION_SIGNATURE,
    },
  };
};

export const env = getEnv();

export function assertProductionCron() {
  if (env.isProduction) return null;

  return {
    error: "Cron jobs only run in production",
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  };
}

export function getTreasuryWalletForPlatform(platform: string): `0x${string}` {
  if (platform === "MINIPAY") {
    return env.nextPublicTreasuryWalletMiniPay;
  }

  return env.nextPublicTreasuryWallet;
}
