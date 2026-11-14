import { externalFlowDirection } from './transaction-flow'

export type GlobalCashflowTransaction = {
  kind: string
  amount: number
  transaction_date: string
  reference_type?: string | null
}

export function buildGlobalCashflow(transactions: readonly GlobalCashflowTransaction[], month: string) {
  return transactions.reduce((summary, transaction) => {
    const amount = Number(transaction.amount) || 0
    const isCurrentMonth = transaction.transaction_date.slice(0, 7) === month
    const direction = externalFlowDirection(transaction)

    if (direction === 'in') summary.cashIn += amount
    if (direction === 'out') summary.cashOut += amount
    if (transaction.kind === 'income') {
      summary.incomeTotal += amount
      if (isCurrentMonth) summary.incomeMonth += amount
    }
    if (transaction.kind === 'expense') {
      summary.expenseTotal += amount
      if (isCurrentMonth) summary.expenseMonth += amount
    }
    if (transaction.kind === 'loan_out') summary.loansGranted += amount
    if (transaction.kind === 'investment_out') summary.investmentsMade += amount
    if (transaction.reference_type === 'fixed_asset_purchase') summary.assetPurchases += amount
    if (transaction.reference_type === 'cash_box_deposit') summary.cashBoxDirectIn += amount
    if (transaction.reference_type === 'cash_box_withdrawal') summary.cashBoxWithdrawals += amount
    return summary
  }, {
    incomeTotal: 0,
    incomeMonth: 0,
    expenseTotal: 0,
    expenseMonth: 0,
    cashIn: 0,
    cashOut: 0,
    loansGranted: 0,
    investmentsMade: 0,
    assetPurchases: 0,
    cashBoxDirectIn: 0,
    cashBoxWithdrawals: 0,
  })
}
