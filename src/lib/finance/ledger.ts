export type LedgerEntry = { kind: string; amount: number; assetDelta: number; liabilityDelta: number };

export function netWorth(entries: LedgerEntry[]) {
  return entries.reduce((total, entry) => total + entry.assetDelta - entry.liabilityDelta, 0);
}

export const transferEntries = (amount: number): LedgerEntry[] => [
  { kind: "TRANSFER_OUT", amount, assetDelta: -amount, liabilityDelta: 0 },
  { kind: "TRANSFER_IN", amount, assetDelta: amount, liabilityDelta: 0 },
];
