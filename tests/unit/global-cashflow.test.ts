import { describe, expect, it } from 'vitest'
import { buildGlobalCashflow } from '../../src/lib/finance/global-cashflow'

describe('buildGlobalCashflow', () => {
  it('separa gastos, caja y asignaciones de capital sin duplicarlos', () => {
    const summary = buildGlobalCashflow([
      { kind: 'income', amount: 150_000_000, transaction_date: '2026-09-18' },
      { kind: 'expense', amount: 10_000_000, transaction_date: '2026-10-01' },
      { kind: 'expense', amount: 5_000_000, transaction_date: '2026-11-02' },
      { kind: 'transfer', amount: 20_000_000, transaction_date: '2026-10-03', reference_type: 'cash_box_deposit' },
      { kind: 'transfer', amount: 50_000, transaction_date: '2026-10-04', reference_type: 'cash_box_withdrawal' },
      { kind: 'transfer', amount: 43_000_000, transaction_date: '2026-10-05', reference_type: 'fixed_asset_purchase' },
      { kind: 'loan_out', amount: 50_000_000, transaction_date: '2026-10-06', reference_type: 'loan' },
    ], '2026-11')

    expect(summary).toMatchObject({
      incomeTotal: 150_000_000,
      expenseTotal: 15_000_000,
      expenseMonth: 5_000_000,
      cashBoxDirectIn: 20_000_000,
      cashBoxWithdrawals: 50_000,
      assetPurchases: 43_000_000,
      loansGranted: 50_000_000,
      cashIn: 170_000_000,
      cashOut: 108_050_000,
    })
  })
})
