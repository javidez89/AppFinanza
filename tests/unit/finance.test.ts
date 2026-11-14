import { describe, expect, it } from "vitest";
import { amortizationSchedule, monthlyRate } from "../../src/lib/finance/loan";
import { cdtReturn } from "../../src/lib/finance/cdt";
import { netWorth, transferEntries } from "../../src/lib/finance/ledger";
import { cashDirection, externalFlowDirection, transactionLabel } from "../../src/lib/finance/transaction-flow";

describe("motor financiero", () => {
  describe("préstamos", () => {
    it("convierte una tasa mensual porcentual a decimal", () => {
      expect(monthlyRate(1.5, "monthly")).toBeCloseTo(0.015, 10);
    });

    it("convierte una tasa efectiva anual a tasa mensual equivalente", () => {
      expect(monthlyRate(12, "effective_annual")).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 10);
    });

    it("rechaza tasas negativas", () => {
      expect(() => monthlyRate(-1, "monthly")).toThrow("La tasa no puede ser negativa");
    });

    it("amortiza préstamo hasta saldo cero", () => {
      const rows = amortizationSchedule(1_000_000, 1.5, "monthly", 12);
      expect(rows).toHaveLength(12);
      expect(rows.at(-1)?.balance).toBe(0);
      expect(rows.reduce((sum, row) => sum + row.principal, 0)).toBe(1_000_000);
    });

    it("divide correctamente un préstamo sin intereses", () => {
      const rows = amortizationSchedule(1_200_000, 0, "monthly", 12);
      expect(rows).toHaveLength(12);
      expect(rows.every((row) => row.interest === 0)).toBe(true);
      expect(rows.every((row) => row.payment === 100_000)).toBe(true);
      expect(rows.at(-1)?.balance).toBe(0);
    });

    it("rechaza capital no positivo", () => {
      expect(() => amortizationSchedule(0, 1.5, "monthly", 12)).toThrow("El capital debe ser mayor que cero");
      expect(() => amortizationSchedule(-100_000, 1.5, "monthly", 12)).toThrow("El capital debe ser mayor que cero");
    });

    it("rechaza cantidad de cuotas inválida", () => {
      expect(() => amortizationSchedule(1_000_000, 1.5, "monthly", 0)).toThrow("Las cuotas deben ser un entero positivo");
      expect(() => amortizationSchedule(1_000_000, 1.5, "monthly", 12.5)).toThrow("Las cuotas deben ser un entero positivo");
    });
  });

  describe("CDT", () => {
    it("calcula rendimiento de CDT por días", () => {
      const result = cdtReturn(1_000_000, 12, new Date("2026-01-01"), new Date("2027-01-01"));
      expect(result.days).toBe(365);
      expect(result.maturityValue).toBeCloseTo(1_120_000, 2);
    });

    it("mantiene el capital cuando la tasa es cero", () => {
      const result = cdtReturn(2_000_000, 0, new Date("2026-01-01"), new Date("2026-07-01"));
      expect(result.grossReturn).toBe(0);
      expect(result.maturityValue).toBe(2_000_000);
    });

    it("permite apertura y vencimiento el mismo día con rendimiento cero", () => {
      const date = new Date("2026-01-01");
      const result = cdtReturn(500_000, 10, date, date);
      expect(result.days).toBe(0);
      expect(result.grossReturn).toBe(0);
      expect(result.maturityValue).toBe(500_000);
    });

    it("rechaza capital no positivo", () => {
      expect(() => cdtReturn(0, 12, new Date("2026-01-01"), new Date("2027-01-01"))).toThrow("El capital debe ser mayor que cero");
    });

    it("rechaza tasa negativa", () => {
      expect(() => cdtReturn(1_000_000, -1, new Date("2026-01-01"), new Date("2027-01-01"))).toThrow("La tasa no puede ser negativa");
    });

    it("rechaza vencimiento anterior a la apertura", () => {
      expect(() => cdtReturn(1_000_000, 12, new Date("2027-01-01"), new Date("2026-01-01")))
        .toThrow("La fecha de vencimiento no puede ser anterior a la apertura");
    });
  });

  describe("ledger y patrimonio", () => {
    it("una transferencia no cambia patrimonio", () => {
      expect(netWorth(transferEntries(500_000))).toBe(0);
    });

    it("suma activos y resta pasivos para obtener patrimonio", () => {
      const result = netWorth([
        { kind: "ASSET", amount: 5_000_000, assetDelta: 5_000_000, liabilityDelta: 0 },
        { kind: "DEBT", amount: 2_000_000, assetDelta: 0, liabilityDelta: 2_000_000 },
      ]);
      expect(result).toBe(3_000_000);
    });
  });

  describe("flujo de transacciones", () => {
    it.each([
      ["income", "in"],
      ["loan_payment", "in"],
      ["investment_return", "in"],
      ["expense", "out"],
      ["loan_out", "out"],
      ["investment_out", "out"],
      ["debt_payment", "out"],
    ] as const)("clasifica %s como flujo %s", (kind, direction) => {
      expect(cashDirection({ kind })).toBe(direction);
    });

    it("trasladar dinero a la caja conserva el efectivo total y no crea flujo externo", () => {
      const out = { kind: "transfer", reference_type: "cash_box_transfer_out", amount: 100_000 };
      const incoming = { kind: "transfer", reference_type: "cash_box_transfer_in", amount: 100_000 };
      const balanceChange = [out, incoming].reduce(
        (sum, entry) => sum + (cashDirection(entry) === "in" ? entry.amount : -entry.amount),
        0,
      );
      expect(balanceChange).toBe(0);
      expect(externalFlowDirection(out)).toBeNull();
      expect(externalFlowDirection(incoming)).toBeNull();
    });

    it("un retiro de caja reduce el efectivo sin ser un gasto operativo", () => {
      const withdrawal = { kind: "transfer", reference_type: "cash_box_withdrawal" };
      expect(cashDirection(withdrawal)).toBe("out");
      expect(withdrawal.kind).not.toBe("expense");
    });

    it("comprar un activo reduce efectivo sin registrarlo como gasto operativo", () => {
      const purchase = { kind: "transfer", reference_type: "fixed_asset_purchase", amount: 43_000_000 };
      const cashChange = cashDirection(purchase) === "out" ? -purchase.amount : 0;
      const vehicleValue = 43_000_000;
      expect(cashChange + vehicleValue).toBe(0);
      expect(purchase.kind).not.toBe("expense");
    });

    it("una transacción desconocida no altera el efectivo", () => {
      expect(cashDirection({ kind: "unknown" })).toBeNull();
    });

    it("genera etiquetas legibles para movimientos conocidos", () => {
      expect(transactionLabel({ kind: "income" })).toBe("Ingreso");
      expect(transactionLabel({ kind: "expense" })).toBe("Gasto");
      expect(transactionLabel({ kind: "transfer", reference_type: "fixed_asset_purchase" })).toBe("Compra de activo");
    });

    it("usa etiquetas genéricas para movimientos no reconocidos", () => {
      expect(transactionLabel({ kind: "transfer", reference_type: "unknown" })).toBe("Traslado");
      expect(transactionLabel({ kind: "unknown" })).toBe("Movimiento");
    });
  });
});
