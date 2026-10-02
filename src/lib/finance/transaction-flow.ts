export type CashDirection = 'in' | 'out' | null

type FlowTransaction = { kind: string; reference_type?: string | null }

export function cashDirection(transaction: FlowTransaction): CashDirection {
  if (transaction.kind === 'income' || transaction.kind === 'loan_payment' || transaction.kind === 'investment_return') return 'in'
  if (transaction.kind === 'expense' || transaction.kind === 'loan_out' || transaction.kind === 'investment_out' || transaction.kind === 'debt_payment') return 'out'
  if (transaction.kind !== 'transfer') return null
  if (transaction.reference_type === 'cash_box_deposit' || transaction.reference_type === 'cash_box_transfer_in') return 'in'
  if (transaction.reference_type === 'cash_box_withdrawal' || transaction.reference_type === 'cash_box_transfer_out' || transaction.reference_type === 'fixed_asset_purchase') return 'out'
  return null
}

export function externalFlowDirection(transaction: FlowTransaction): CashDirection {
  if (transaction.reference_type === 'cash_box_transfer_in' || transaction.reference_type === 'cash_box_transfer_out') return null
  return cashDirection(transaction)
}

export function transactionLabel(transaction: FlowTransaction): string {
  if (transaction.kind === 'transfer') {
    switch (transaction.reference_type) {
      case 'cash_box_deposit': return 'Ingreso a caja'
      case 'cash_box_withdrawal': return 'Retiro de caja'
      case 'cash_box_transfer_in': return 'Entrada a caja'
      case 'cash_box_transfer_out': return 'Traslado a caja'
      case 'fixed_asset_purchase': return 'Compra de activo'
      default: return 'Traslado'
    }
  }
  const labels: Record<string, string> = {
    income: 'Ingreso', expense: 'Gasto', loan_out: 'Préstamo entregado', loan_payment: 'Cuota cobrada',
    investment_out: 'Inversión', investment_return: 'Redención inversión', debt_payment: 'Pago de deuda',
  }
  return labels[transaction.kind] || 'Movimiento'
}
