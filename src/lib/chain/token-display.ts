import type { GameNetwork } from "./network";
import type { ChainPlatform } from "./platform";

interface TokenDisplayTarget {
  platform: ChainPlatform;
  network?: GameNetwork | null;
}

interface FormatTokenAmountOptions extends TokenDisplayTarget {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function isCeloPaymentTarget(target: TokenDisplayTarget) {
  return (
    target.platform === "MINIPAY" ||
    target.network === "CELO_MAINNET" ||
    target.network === "CELO_SEPOLIA"
  );
}

export function getPaymentTokenSymbolForTarget(target: TokenDisplayTarget) {
  return isCeloPaymentTarget(target) ? "USDT" : "USDC";
}

export function formatPaymentTokenAmount(
  amount: number,
  options: FormatTokenAmountOptions,
) {
  const formattedAmount = amount.toLocaleString("en-US", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });

  return isCeloPaymentTarget(options)
    ? `${formattedAmount} ${getPaymentTokenSymbolForTarget(options)}`
    : `$${formattedAmount}`;
}
