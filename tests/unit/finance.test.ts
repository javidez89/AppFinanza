import { describe, expect, it } from "vitest";
import { amortizationSchedule } from "../../src/lib/finance/loan";
import { cdtReturn } from "../../src/lib/finance/cdt";
import { netWorth, transferEntries } from "../../src/lib/finance/ledger";

describe("motor financiero", () => {
  it("amortiza préstamo hasta saldo cero", () => {
    const rows = amortizationSchedule(1_000_000, 1.5, "monthly", 12);
    expect(rows).toHaveLength(12);
    expect(rows.at(-1)?.balance).toBe(0);
    expect(rows.reduce((sum, row) => sum + row.principal, 0)).toBe(1_000_000);
  });

  it("calcula rendimiento de CDT por días", () => {
    const result = cdtReturn(1_000_000, 12, new Date("2026-01-01"), new Date("2027-01-01"));
    expect(result.days).toBe(365);
    expect(result.maturityValue).toBeCloseTo(1_120_000, 2);
  });

  it("una transferencia no cambia patrimonio", () => {
    expect(netWorth(transferEntries(500_000))).toBe(0);
  });
});
