import { describe, expect, it } from 'vitest'
import { accountCashEntries, cashDirection, transactionLabel } from '../../src/lib/finance/transaction-flow'

describe('cash box movement visibility', () => {
  it('shows the expense and loan responsible for the reported negative balance', () => {
    const movements = [
      { id: 'deposit-1', kind: 'transfer', reference_type: 'cash_box_deposit', amount: 4_800_000 },
      { id: 'deposit-2', kind: 'transfer', reference_type: 'cash_box_deposit', amount: 5_000_000 },
      { id: 'withdrawal', kind: 'transfer', reference_type: 'cash_box_withdrawal', amount: 50_000 },
      { id: 'deposit-3', kind: 'transfer', reference_type: 'cash_box_deposit', amount: 10_000_000 },
      { id: 'deposit-4', kind: 'transfer', reference_type: 'cash_box_deposit', amount: 1_000_000 },
      { id: 'expense', kind: 'expense', reference_type: null, amount: 500_000 },
      { id: 'loan', kind: 'loan_out', reference_type: 'loan', amount: 50_000_000 },
    ].map((movement) => ({ ...movement, account_id: 'cash-box' }))
    const visible = accountCashEntries(movements, 'cash-box')
    expect(visible.map((entry) => entry.id)).toEqual(movements.map((entry) => entry.id))
    expect(visible.reduce((balance, entry) => balance + (cashDirection(entry) === 'in' ? entry.amount : -entry.amount), 0)).toBe(-29_750_000)
    expect(transactionLabel(visible[5])).toBe('Gasto')
    expect(transactionLabel(visible[6])).toBe('Préstamo entregado')
  })

  it('excludes other accounts and transfers without a cash direction', () => {
    const movements = [
      { id: 'ours', account_id: 'cash-box', kind: 'income' },
      { id: 'other', account_id: 'bank', kind: 'expense' },
      { id: 'unassigned', account_id: null, kind: 'expense' },
      { id: 'neutral', account_id: 'cash-box', kind: 'transfer', reference_type: null },
    ]
    expect(accountCashEntries(movements, 'cash-box').map((entry) => entry.id)).toEqual(['ours'])
    expect(accountCashEntries(movements)).toEqual([])
  })

  it('includes investment movements, loan collections and debt payments with their direction', () => {
    const movements = ['investment_out', 'investment_return', 'loan_payment', 'debt_payment']
      .map((kind) => ({ account_id: 'cash-box', kind }))
    expect(accountCashEntries(movements, 'cash-box').map(cashDirection)).toEqual(['out', 'in', 'in', 'out'])
  })
})
