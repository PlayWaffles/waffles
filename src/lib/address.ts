export function formatAddress(
  address: string | null | undefined,
  start = 6,
  end = 4,
) {
  if (!address) return "Unknown";
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function getDisplayName(input: {
  username?: string | null;
  wallet?: string | null;
}) {
  return input.username || formatAddress(input.wallet) || "Player";
}
