import { describe, expect, it } from "vitest";
import { amortizationSchedule } from "../../src/lib/finance/loan";
import { cdtReturn } from "../../src/lib/finance/cdt";
import { netWorth, transferEntries } from "../../src/lib/finance/ledger";
import { cashDirection, externalFlowDirection } from "../../src/lib/finance/transaction-flow";

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

  it("trasladar dinero a la caja conserva el efectivo total y no crea ingresos ni gastos", () => {
    const out = { kind: "transfer", reference_type: "cash_box_transfer_out", amount: 100_000 };
    const incoming = { kind: "transfer", reference_type: "cash_box_transfer_in", amount: 100_000 };
    const balanceChange = [out, incoming].reduce((sum, entry) => sum + (cashDirection(entry) === "in" ? entry.amount : -entry.amount), 0);
    expect(balanceChange).toBe(0);
    expect(externalFlowDirection(out)).toBeNull();
    expect(externalFlowDirection(incoming)).toBeNull();
  });

  it("un retiro de caja reduce el efectivo sin ser un gasto operativo", () => {
    const withdrawal = { kind: "transfer", reference_type: "cash_box_withdrawal" };
    expect(cashDirection(withdrawal)).toBe("out");
    expect(withdrawal.kind).not.toBe("expense");
  });

  it("comprar un carro al mismo valor conserva el patrimonio", () => {
    const purchase = { kind: "transfer", reference_type: "fixed_asset_purchase", amount: 43_000_000 };
    const cashChange = cashDirection(purchase) === "out" ? -purchase.amount : 0;
    const vehicleValue = 43_000_000;
    expect(cashChange + vehicleValue).toBe(0);
    expect(purchase.kind).not.toBe("expense");
  });
});
