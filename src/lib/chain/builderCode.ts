import { concatHex, numberToHex, size, stringToHex, type Hex } from "viem";
import { env } from "@/lib/env";
import type { ChainTarget } from "./network";

const ERC_8021_SUFFIX = "0x80218021802180218021802180218021" as const;
const MAX_CODES_SIZE_BYTES = 0xff;

function parseBuilderCodes(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}

function buildBuilderCodeDataSuffix(codes: string[]): Hex | undefined {
  if (!codes.length) return undefined;

  const encodedCodes = stringToHex(codes.join(","));
  const encodedCodesSize = size(encodedCodes);

  if (encodedCodesSize > MAX_CODES_SIZE_BYTES) {
    console.error(
      "[Builder Code] NEXT_PUBLIC_BASE_BUILDER_CODE is too long (max 255 bytes).",
    );
    return undefined;
  }

  return concatHex([
    encodedCodes,
    numberToHex(encodedCodesSize, { size: 1 }),
    numberToHex(0, { size: 1 }),
    ERC_8021_SUFFIX,
  ]);
}

const builderCodes = parseBuilderCodes(env.nextPublicBaseBuilderCode);

export const builderCodeDataSuffix = buildBuilderCodeDataSuffix(builderCodes);

export const builderCodeSendCallsCapability = builderCodeDataSuffix
  ? {
      dataSuffix: {
        value: builderCodeDataSuffix,
        optional: true as const,
      },
    }
  : undefined;

export function withBuilderCodeDataSuffix<
  T extends Record<string, unknown> & { dataSuffix?: Hex },
>(request: T, target: Pick<ChainTarget, "platform">): T {
  if (target.platform !== "BASE_APP") return request;
  if (!builderCodeDataSuffix) return request;
  return { ...request, dataSuffix: builderCodeDataSuffix };
}
