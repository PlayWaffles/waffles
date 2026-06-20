export const MINIPAY_PAYMENT_TOKEN_SYMBOL = "USDT";
export const MINIPAY_PAYMENT_TOKEN_NAME = "USDT digital dollars";
// MiniPay "Add Cash" deeplink, pre-targeted to USDT (the token Waffles entries
// are paid in, and the one MiniPay users actually hold). Opening this drops the
// user into MiniPay's on-ramp so they can fund and come back to play.
export const MINIPAY_DEPOSIT_URL = "https://link.minipay.xyz/add_cash?tokens=USDT";

export const MINIPAY_USDT_ONLY_MESSAGE =
  "Waffles currently accepts USDT digital dollars only.";

export const MINIPAY_LOW_BALANCE_MESSAGE =
  "Not enough USDT digital dollars. Add Cash in MiniPay and try again.";
