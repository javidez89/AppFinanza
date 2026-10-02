'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/finance'
import { cashDirection, externalFlowDirection } from '@/lib/finance/transaction-flow'

type TransactionKind = 'income' | 'expense' | 'transfer' | 'loan_out' | 'loan_payment' | 'investment_out' | 'investment_return' | 'debt_payment'

type Account = {
  id: string
  name: string
  account_type: 'cash' | 'checking' | 'savings' | 'wallet'
  institution: string | null
  opening_balance: number
  active: boolean
}

type Transaction = {
  id: string
  kind: TransactionKind
  description: string
  category: string
  amount: number
  transaction_date: string
  account_id?: string | null
  reference_type?: string | null
}

type Loan = { id: string; borrower_name: string; status: string }
type Installment = { id: string; loan_id: string; due_date: string; principal_amount: number; total_amount: number; status: string }
type Investment = { id: string; institution: string; principal: number; projected_maturity_value: number; maturity_date: string; status: string }
type FixedAsset = { id: string; name: string; asset_type: 'vehicle' | 'property' | 'equipment' | 'other'; acquisition_date: string; acquisition_cost: number; current_value: number; notes: string | null }

type CreditCard = {
  id: string
  name: string
  institution: string
  credit_limit: number
  current_balance: number
  cutoff_day: number
  payment_day: number
  active: boolean
}

type Budget = { id: string; category: string; month: string; limit_amount: number }
type SavingsGoal = { id: string; name: string; target_amount: number; current_amount: number; target_date: string | null; status: 'active' | 'completed' | 'cancelled' }
type PersonalDebt = {
  id: string
  creditor_name: string
  description: string | null
  principal: number
  outstanding_balance: number
  annual_interest_rate: number
  minimum_payment: number
  due_day: number | null
  status: 'active' | 'paid' | 'cancelled'
}

type Section = 'overview' | 'accounts' | 'assets' | 'cards' | 'budgets' | 'goals' | 'debts' | 'reports'
type FormKind = null | 'account' | 'asset' | 'card' | 'budget' | 'goal' | 'debt'
type ActionTarget = null | { kind: 'goal' | 'card' | 'debt'; id: string; title: string }

const todayISO = () => new Date().toISOString().slice(0, 10)
const currentMonthKey = () => todayISO().slice(0, 7)
const monthDate = (key: string) => `${key}-01`
const monthKey = (date: string) => date.slice(0, 7)

function daysUntil(date: string) {
  const start = new Date(`${todayISO()}T12:00:00`).getTime()
  const end = new Date(`${date}T12:00:00`).getTime()
  return Math.ceil((end - start) / 86_400_000)
}

function daysUntilDayOfMonth(day: number) {
  const now = new Date()
  let due = new Date(now.getFullYear(), now.getMonth(), Math.min(day, 28), 12)
  if (due.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()) {
    due = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(day, 28), 12)
  }
  return Math.ceil((due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()) / 86_400_000)
}

function shortDate(date: string | null) {
  if (!date) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function accountTypeLabel(type: Account['account_type']) {
  return type === 'cash' ? 'Efectivo' : type === 'checking' ? 'Cuenta corriente' : type === 'savings' ? 'Cuenta de ahorros' : 'Billetera digital'
}

export function ManagementPanel({
  accounts,
  transactions,
  loans,
  installments,
  investments,
  notify,
  onDataChanged,
}: {
  accounts: Account[]
  transactions: Transaction[]
  loans: Loan[]
  installments: Installment[]
  investments: Investment[]
  notify: (message: string) => void
  onDataChanged: () => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const [section, setSection] = useState<Section>('overview')
  const [form, setForm] = useState<FormKind>(null)
  const [saving, setSaving] = useState(false)
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [debts, setDebts] = useState<PersonalDebt[]>([])
  const [reportMonth, setReportMonth] = useState(currentMonthKey())
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null)
  const [actionAmount, setActionAmount] = useState('')
  const [actionAccountId, setActionAccountId] = useState('')

  const [accountForm, setAccountForm] = useState({ name: '', type: 'savings' as Account['account_type'], institution: '', openingBalance: '' })
  const [assetForm, setAssetForm] = useState({ name: '', type: 'vehicle' as FixedAsset['asset_type'], date: todayISO(), cost: '', currentValue: '', notes: '', purchaseMode: 'already' as 'already' | 'existing' | 'new', existingTransactionId: '', accountId: '' })
  const [valuationTarget, setValuationTarget] = useState<FixedAsset | null>(null)
  const [valuationAmount, setValuationAmount] = useState('')
  const [cardForm, setCardForm] = useState({ name: '', institution: '', creditLimit: '', currentBalance: '', cutoffDay: '15', paymentDay: '25' })
  const [budgetForm, setBudgetForm] = useState({ category: 'Hogar', month: currentMonthKey(), limit: '' })
  const [goalForm, setGoalForm] = useState({ name: '', target: '', current: '', targetDate: '' })
  const [debtForm, setDebtForm] = useState({ creditor: '', description: '', principal: '', outstanding: '', annualRate: '', minimumPayment: '', dueDay: '15' })

  const loadExtras = useCallback(async () => {
    const [cardResult, budgetResult, goalResult, debtResult, assetResult] = await Promise.all([
      supabase.from('credit_cards').select('*').order('created_at', { ascending: false }),
      supabase.from('budgets').select('*').order('month', { ascending: false }),
      supabase.from('savings_goals').select('*').order('created_at', { ascending: false }),
      supabase.from('personal_debts').select('*').order('created_at', { ascending: false }),
      supabase.from('fixed_assets').select('*').order('created_at', { ascending: false }),
    ])
    const error = cardResult.error || budgetResult.error || goalResult.error || debtResult.error || assetResult.error
    if (error) {
      notify(`No se pudieron cargar los módulos gerenciales: ${error.message}`)
      return
    }
    setCreditCards((cardResult.data ?? []) as CreditCard[])
    setBudgets((budgetResult.data ?? []) as Budget[])
    setGoals((goalResult.data ?? []) as SavingsGoal[])
    setDebts((debtResult.data ?? []) as PersonalDebt[])
    setFixedAssets((assetResult.data ?? []) as FixedAsset[])
  }, [notify, supabase])

  useEffect(() => { void loadExtras() }, [loadExtras])
  useEffect(() => { if (!actionAccountId && accounts[0]?.id) setActionAccountId(accounts[0].id) }, [accounts, actionAccountId])

  const accountBalances = useMemo(() => accounts.map((account) => {
    const movement = transactions.filter((tx) => tx.account_id === account.id).reduce((sum, tx) => {
      if (cashDirection(tx) === 'in') return sum + Number(tx.amount)
      if (cashDirection(tx) === 'out') return sum - Number(tx.amount)
      return sum
    }, 0)
    return { ...account, balance: Number(account.opening_balance) + movement }
  }), [accounts, transactions])

  const unassignedCash = useMemo(() => transactions.filter((tx) => !tx.account_id).reduce((sum, tx) => {
    if (cashDirection(tx) === 'in') return sum + Number(tx.amount)
    if (cashDirection(tx) === 'out') return sum - Number(tx.amount)
    return sum
  }, 0), [transactions])

  const cashTotal = accountBalances.reduce((sum, account) => sum + account.balance, 0) + unassignedCash
  const investmentAssets = investments.filter((item) => item.status === 'active' || item.status === 'matured').reduce((sum, item) => sum + Number(item.principal), 0)
  const fixedAssetValue = fixedAssets.reduce((sum, item) => sum + Number(item.current_value), 0)
  const receivableAssets = installments.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + Number(item.principal_amount), 0)
  const cardLiabilities = creditCards.filter((item) => item.active).reduce((sum, item) => sum + Number(item.current_balance), 0)
  const debtLiabilities = debts.filter((item) => item.status === 'active').reduce((sum, item) => sum + Number(item.outstanding_balance), 0)
  const totalAssets = cashTotal + investmentAssets + receivableAssets + fixedAssetValue
  const totalLiabilities = cardLiabilities + debtLiabilities
  const netWorth = totalAssets - totalLiabilities

  const budgetRows = useMemo(() => budgets.map((budget) => {
    const key = monthKey(budget.month)
    const spent = transactions
      .filter((tx) => tx.kind === 'expense' && tx.category === budget.category && monthKey(tx.transaction_date) === key)
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
    const limit = Number(budget.limit_amount)
    return { ...budget, spent, percentage: limit > 0 ? (spent / limit) * 100 : 0, available: limit - spent }
  }), [budgets, transactions])

  const alerts = useMemo(() => {
    const rows: Array<{ level: 'danger' | 'warning' | 'info'; title: string; text: string }> = []
    installments.filter((item) => item.status !== 'paid' && daysUntil(item.due_date) < 0).slice(0, 4).forEach((item) => {
      const loan = loans.find((entry) => entry.id === item.loan_id)
      rows.push({ level: 'danger', title: 'Cuota vencida', text: `${loan?.borrower_name ?? 'Préstamo'} · ${formatCOP(item.total_amount)} · venció ${shortDate(item.due_date)}` })
    })
    investments.filter((item) => (item.status === 'active' || item.status === 'matured') && daysUntil(item.maturity_date) >= 0 && daysUntil(item.maturity_date) <= 30).forEach((item) => {
      rows.push({ level: 'info', title: 'CDT próximo a vencer', text: `${item.institution} · ${formatCOP(item.projected_maturity_value)} · ${shortDate(item.maturity_date)}` })
    })
    creditCards.filter((item) => item.active && Number(item.current_balance) > 0 && daysUntilDayOfMonth(item.payment_day) <= 7).forEach((item) => {
      rows.push({ level: 'warning', title: 'Pago de tarjeta cercano', text: `${item.name} · saldo ${formatCOP(item.current_balance)} · día ${item.payment_day}` })
    })
    debts.filter((item) => item.status === 'active' && item.due_day && daysUntilDayOfMonth(item.due_day) <= 7).forEach((item) => {
      rows.push({ level: 'warning', title: 'Pago de deuda cercano', text: `${item.creditor_name} · mínimo ${formatCOP(item.minimum_payment)} · día ${item.due_day}` })
    })
    budgetRows.filter((item) => monthKey(item.month) === currentMonthKey() && item.percentage >= 80).forEach((item) => {
      rows.push({ level: item.percentage >= 100 ? 'danger' : 'warning', title: item.percentage >= 100 ? 'Presupuesto excedido' : 'Presupuesto al límite', text: `${item.category}: ${Math.round(item.percentage)}% utilizado` })
    })
    goals.filter((item) => item.status === 'active' && item.target_date && daysUntil(item.target_date) >= 0 && daysUntil(item.target_date) <= 30 && Number(item.current_amount) < Number(item.target_amount)).forEach((item) => {
      rows.push({ level: 'info', title: 'Meta próxima', text: `${item.name} · ${shortDate(item.target_date)}` })
    })
    return rows.slice(0, 8)
  }, [installments, loans, investments, creditCards, debts, budgetRows, goals])

  const report = useMemo(() => {
    const tx = transactions.filter((item) => monthKey(item.transaction_date) === reportMonth)
    const inflow = tx.filter((item) => externalFlowDirection(item) === 'in').reduce((sum, item) => sum + Number(item.amount), 0)
    const outflow = tx.filter((item) => externalFlowDirection(item) === 'out').reduce((sum, item) => sum + Number(item.amount), 0)
    const income = tx.filter((item) => item.kind === 'income').reduce((sum, item) => sum + Number(item.amount), 0)
    const expense = tx.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
    const categoryMap = new Map<string, number>()
    tx.filter((item) => item.kind === 'expense').forEach((item) => categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + Number(item.amount)))
    const categories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])
    return { tx, inflow, outflow, income, expense, net: inflow - outflow, categories }
  }, [transactions, reportMonth])

  async function saveAccount() {
    const opening = Number(accountForm.openingBalance || 0)
    if (!accountForm.name.trim() || opening < 0) return notify('Completa el nombre de la cuenta y un saldo inicial válido.')
    setSaving(true)
    const { error } = await supabase.from('accounts').insert({
      name: accountForm.name.trim(), account_type: accountForm.type, institution: accountForm.institution.trim() || null, opening_balance: opening,
    })
    setSaving(false)
    if (error) return notify(error.message)
    setAccountForm({ name: '', type: 'savings', institution: '', openingBalance: '' })
    setForm(null)
    notify('Cuenta creada.')
    await onDataChanged()
  }

  async function saveAsset() {
    const cost = Number(assetForm.cost)
    const currentValue = Number(assetForm.currentValue)
    const existingExpense = transactions.find((tx) => tx.id === assetForm.existingTransactionId && tx.kind === 'expense')
    if (!assetForm.name.trim() || !assetForm.date || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(currentValue) || currentValue < 0 || (assetForm.purchaseMode === 'new' && cost <= 0) || (assetForm.purchaseMode === 'existing' && (!existingExpense || Number(existingExpense.amount) !== cost || existingExpense.transaction_date !== assetForm.date))) {
      notify('Completa el bien, fecha y valores válidos.')
      return
    }
    if (assetForm.purchaseMode === 'new' && assetForm.accountId) {
      const source = accountBalances.find((account) => account.id === assetForm.accountId)
      if (!source || source.balance < cost) {
        notify('La cuenta de origen no tiene saldo suficiente.')
        return
      }
    }
    setSaving(true)
    const { error } = await supabase.rpc('register_fixed_asset', {
      p_name: assetForm.name.trim(),
      p_asset_type: assetForm.type,
      p_acquisition_date: assetForm.date,
      p_acquisition_cost: cost,
      p_current_value: currentValue,
      p_account_id: assetForm.purchaseMode === 'new' ? assetForm.accountId || null : null,
      p_record_cash_outflow: assetForm.purchaseMode === 'new',
      p_notes: assetForm.notes.trim() || null,
      p_existing_transaction_id: assetForm.purchaseMode === 'existing' ? assetForm.existingTransactionId : null,
    })
    setSaving(false)
    if (error) return notify(error.message)
    setAssetForm({ name: '', type: 'vehicle', date: todayISO(), cost: '', currentValue: '', notes: '', purchaseMode: 'already', existingTransactionId: '', accountId: '' })
    setForm(null)
    notify('Bien incluido en el patrimonio.')
    await loadExtras()
    await onDataChanged()
  }

  async function saveValuation() {
    if (!valuationTarget) return
    const value = Number(valuationAmount)
    if (!Number.isFinite(value) || value < 0) return notify('Indica un valor estimado válido.')
    setSaving(true)
    const { error } = await supabase.from('fixed_assets').update({ current_value: value }).eq('id', valuationTarget.id).select('id').single()
    setSaving(false)
    if (error) return notify(error.message)
    setValuationTarget(null)
    notify('Valor del bien actualizado.')
    await loadExtras()
  }

  async function saveCard() {
    const limit = Number(cardForm.creditLimit)
    const balance = Number(cardForm.currentBalance || 0)
    if (!cardForm.name.trim() || !cardForm.institution.trim() || limit <= 0 || balance < 0) return notify('Completa los datos de la tarjeta.')
    setSaving(true)
    const { error } = await supabase.from('credit_cards').insert({
      name: cardForm.name.trim(), institution: cardForm.institution.trim(), credit_limit: limit, current_balance: balance,
      cutoff_day: Math.max(1, Math.min(28, Number(cardForm.cutoffDay))), payment_day: Math.max(1, Math.min(28, Number(cardForm.paymentDay))),
    })
    setSaving(false)
    if (error) return notify(error.message)
    setCardForm({ name: '', institution: '', creditLimit: '', currentBalance: '', cutoffDay: '15', paymentDay: '25' })
    setForm(null)
    notify('Tarjeta registrada.')
    await loadExtras()
  }

  async function saveBudget() {
    const limit = Number(budgetForm.limit)
    if (!budgetForm.category.trim() || !budgetForm.month || limit <= 0) return notify('Completa categoría, mes y presupuesto.')
    setSaving(true)
    const { error } = await supabase.from('budgets').upsert({ category: budgetForm.category.trim(), month: monthDate(budgetForm.month), limit_amount: limit }, { onConflict: 'category,month' })
    setSaving(false)
    if (error) return notify(error.message)
    setForm(null)
    notify('Presupuesto guardado.')
    await loadExtras()
  }

  async function saveGoal() {
    const target = Number(goalForm.target)
    const current = Number(goalForm.current || 0)
    if (!goalForm.name.trim() || target <= 0 || current < 0) return notify('Completa el nombre y el valor objetivo de la meta.')
    setSaving(true)
    const { error } = await supabase.from('savings_goals').insert({
      name: goalForm.name.trim(), target_amount: target, current_amount: current, target_date: goalForm.targetDate || null,
      status: current >= target ? 'completed' : 'active',
    })
    setSaving(false)
    if (error) return notify(error.message)
    setGoalForm({ name: '', target: '', current: '', targetDate: '' })
    setForm(null)
    notify('Meta creada.')
    await loadExtras()
  }

  async function saveDebt() {
    const principal = Number(debtForm.principal)
    const outstanding = Number(debtForm.outstanding || debtForm.principal)
    if (!debtForm.creditor.trim() || principal <= 0 || outstanding < 0) return notify('Completa acreedor y valores de la deuda.')
    setSaving(true)
    const { error } = await supabase.from('personal_debts').insert({
      creditor_name: debtForm.creditor.trim(), description: debtForm.description.trim() || null, principal, outstanding_balance: outstanding,
      annual_interest_rate: Number(debtForm.annualRate || 0), minimum_payment: Number(debtForm.minimumPayment || 0), due_day: Math.max(1, Math.min(28, Number(debtForm.dueDay || 15))),
      status: outstanding <= 0 ? 'paid' : 'active',
    })
    setSaving(false)
    if (error) return notify(error.message)
    setDebtForm({ creditor: '', description: '', principal: '', outstanding: '', annualRate: '', minimumPayment: '', dueDay: '15' })
    setForm(null)
    notify('Deuda registrada.')
    await loadExtras()
  }

  async function applyAction() {
    if (!actionTarget) return
    const amount = Number(actionAmount)
    if (!amount || amount <= 0) return notify('Indica un valor mayor que cero.')
    setSaving(true)

    if (actionTarget.kind === 'goal') {
      const goal = goals.find((item) => item.id === actionTarget.id)
      if (!goal) { setSaving(false); return }
      const next = Math.min(Number(goal.target_amount), Number(goal.current_amount) + amount)
      const { error } = await supabase.from('savings_goals').update({ current_amount: next, status: next >= Number(goal.target_amount) ? 'completed' : 'active' }).eq('id', goal.id)
      setSaving(false)
      if (error) return notify(error.message)
      notify('Aporte aplicado a la meta.')
    } else if (actionTarget.kind === 'card') {
      const card = creditCards.find((item) => item.id === actionTarget.id)
      if (!card) { setSaving(false); return }
      const payment = Math.min(amount, Number(card.current_balance))
      const next = Math.max(0, Number(card.current_balance) - payment)
      const { error: updateError } = await supabase.from('credit_cards').update({ current_balance: next }).eq('id', card.id)
      if (updateError) { setSaving(false); return notify(updateError.message) }
      const { error: txError } = await supabase.from('transactions').insert({
        kind: 'debt_payment', description: `Pago tarjeta ${card.name}`, category: 'Deudas', amount: payment,
        transaction_date: todayISO(), account_id: actionAccountId || null, reference_type: 'credit_card', reference_id: card.id,
      })
      if (txError) { await supabase.from('credit_cards').update({ current_balance: card.current_balance }).eq('id', card.id); setSaving(false); return notify(txError.message) }
      setSaving(false)
      notify('Pago de tarjeta registrado.')
    } else {
      const debt = debts.find((item) => item.id === actionTarget.id)
      if (!debt) { setSaving(false); return }
      const payment = Math.min(amount, Number(debt.outstanding_balance))
      const next = Math.max(0, Number(debt.outstanding_balance) - payment)
      const { error: updateError } = await supabase.from('personal_debts').update({ outstanding_balance: next, status: next <= 0 ? 'paid' : 'active' }).eq('id', debt.id)
      if (updateError) { setSaving(false); return notify(updateError.message) }
      const { error: txError } = await supabase.from('transactions').insert({
        kind: 'debt_payment', description: `Abono deuda ${debt.creditor_name}`, category: 'Deudas', amount: payment,
        transaction_date: todayISO(), account_id: actionAccountId || null, reference_type: 'personal_debt', reference_id: debt.id,
      })
      if (txError) { await supabase.from('personal_debts').update({ outstanding_balance: debt.outstanding_balance, status: debt.status }).eq('id', debt.id); setSaving(false); return notify(txError.message) }
      setSaving(false)
      notify('Abono de deuda registrado.')
    }

    setActionTarget(null)
    setActionAmount('')
    await loadExtras()
    await onDataChanged()
  }

  function downloadBlob(content: BlobPart, type: string, filename: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function xmlEscape(value: unknown) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  }

  function excelSheet(name: string, rows: Array<Record<string, string | number>>) {
    const headers = rows.length ? Object.keys(rows[0]) : ['Sin datos']
    const rowXml = [
      `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join('')}</Row>`,
      ...rows.map((row) => `<Row>${headers.map((header) => {
        const value = row[header] ?? ''
        const type = typeof value === 'number' && Number.isFinite(value) ? 'Number' : 'String'
        return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`
      }).join('')}</Row>`),
    ].join('')
    return `<Worksheet ss:Name="${xmlEscape(name).slice(0, 31)}"><Table>${rowXml}</Table></Worksheet>`
  }

  async function exportExcel() {
    const sheets = [
      excelSheet('Resumen', [
        { Indicador: 'Mes', Valor: reportMonth },
        { Indicador: 'Ingresos', Valor: report.income },
        { Indicador: 'Gastos', Valor: report.expense },
        { Indicador: 'Entradas de caja', Valor: report.inflow },
        { Indicador: 'Salidas de caja', Valor: report.outflow },
        { Indicador: 'Flujo neto', Valor: report.net },
        { Indicador: 'Activos', Valor: totalAssets },
        { Indicador: 'Pasivos', Valor: totalLiabilities },
        { Indicador: 'Patrimonio neto', Valor: netWorth },
      ]),
      excelSheet('Movimientos', report.tx.map((tx) => ({ Fecha: tx.transaction_date, Tipo: tx.kind, Descripcion: tx.description, Categoria: tx.category, Valor: Number(tx.amount) }))),
      excelSheet('Cuentas', accountBalances.map((item) => ({ Cuenta: item.name, Tipo: accountTypeLabel(item.account_type), Entidad: item.institution ?? '', Saldo: item.balance }))),
      excelSheet('Bienes', fixedAssets.map((item) => ({ Bien: item.name, Tipo: item.asset_type, FechaCompra: item.acquisition_date, Costo: Number(item.acquisition_cost), ValorActual: Number(item.current_value) }))),
      excelSheet('Tarjetas', creditCards.map((item) => ({ Tarjeta: item.name, Entidad: item.institution, Cupo: Number(item.credit_limit), Saldo: Number(item.current_balance), Disponible: Number(item.credit_limit) - Number(item.current_balance) }))),
      excelSheet('Presupuesto', budgetRows.filter((item) => monthKey(item.month) === reportMonth).map((item) => ({ Categoria: item.category, Presupuesto: Number(item.limit_amount), Ejecutado: item.spent, Disponible: item.available, Porcentaje: Math.round(item.percentage) }))),
      excelSheet('Metas', goals.map((item) => ({ Meta: item.name, Objetivo: Number(item.target_amount), Acumulado: Number(item.current_amount), FechaObjetivo: item.target_date ?? '', Estado: item.status }))),
      excelSheet('Deudas', debts.map((item) => ({ Acreedor: item.creditor_name, Inicial: Number(item.principal), Saldo: Number(item.outstanding_balance), TasaEA: Number(item.annual_interest_rate), PagoMinimo: Number(item.minimum_payment), DiaPago: item.due_day ?? '' }))),
    ].join('')
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets}</Workbook>`
    downloadBlob(workbook, 'application/vnd.ms-excel;charset=utf-8', `reporte-financiero-${reportMonth}.xls`)
  }

  function pdfHex(text: string) {
    let output = ''
    for (const char of text) {
      const code = char.charCodeAt(0)
      output += (code <= 255 ? code : 63).toString(16).padStart(2, '0')
    }
    return output
  }

  function buildSimplePdf(lines: Array<{ text: string; size?: number }>) {
    const visible = lines.slice(0, 38)
    const contentParts = ['BT', '/F1 16 Tf', '50 800 Td']
    visible.forEach((line, index) => {
      const size = line.size ?? 10
      if (index > 0) contentParts.push('0 -19 Td')
      contentParts.push(`/F1 ${size} Tf <${pdfHex(line.text)}> Tj`)
    })
    contentParts.push('ET')
    const stream = contentParts.join('\n')
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ]
    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((object, index) => {
      offsets[index + 1] = new TextEncoder().encode(pdf).length
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    })
    const xref = new TextEncoder().encode(pdf).length
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    return pdf
  }

  async function exportPdf() {
    const lines: Array<{ text: string; size?: number }> = [
      { text: 'Mi Gerencia Financiera', size: 16 },
      { text: `Reporte mensual: ${reportMonth}`, size: 11 },
      { text: '' },
      { text: `Ingresos: ${formatCOP(report.income)}` },
      { text: `Gastos: ${formatCOP(report.expense)}` },
      { text: `Entradas de caja: ${formatCOP(report.inflow)}` },
      { text: `Salidas de caja: ${formatCOP(report.outflow)}` },
      { text: `Flujo neto: ${formatCOP(report.net)}` },
      { text: '' },
      { text: 'Situacion patrimonial', size: 13 },
      { text: `Activos: ${formatCOP(totalAssets)}` },
      { text: `Bienes: ${formatCOP(fixedAssetValue)}` },
      { text: `Pasivos: ${formatCOP(totalLiabilities)}` },
      { text: `Patrimonio neto: ${formatCOP(netWorth)}` },
      { text: '' },
      { text: 'Gastos por categoria', size: 13 },
      ...report.categories.slice(0, 18).map(([category, value]) => ({ text: `${category}: ${formatCOP(value)}` })),
    ]
    downloadBlob(buildSimplePdf(lines), 'application/pdf', `reporte-financiero-${reportMonth}.pdf`)
  }

  const tabs: Array<{ key: Section; label: string }> = [
    ['overview', 'Resumen'], ['accounts', 'Cuentas'], ['assets', 'Bienes'], ['cards', 'Tarjetas'], ['budgets', 'Presupuestos'], ['goals', 'Metas'], ['debts', 'Deudas'], ['reports', 'Reportes'],
  ].map(([key, label]) => ({ key: key as Section, label }))

  return (
    <>
      <div className="management-tabs">{tabs.map((tab) => <button key={tab.key} className={section === tab.key ? 'active' : ''} onClick={() => setSection(tab.key)}>{tab.label}</button>)}</div>

      {section === 'overview' ? (
        <>
          <section className="metrics management-metrics">
            <MetricCard label="Patrimonio neto" value={formatCOP(netWorth)} note="Activos menos obligaciones" highlight />
            <MetricCard label="Activos" value={formatCOP(totalAssets)} note="Dinero + bienes + inversiones + cartera" />
            <MetricCard label="Pasivos" value={formatCOP(totalLiabilities)} note="Tarjetas + deudas propias" />
            <MetricCard label="Caja disponible" value={formatCOP(cashTotal)} note={unassignedCash !== 0 ? `Incluye ${formatCOP(unassignedCash)} sin asignar` : 'Saldos por cuenta'} />
          </section>
          <section className="dashboard-grid">
            <div className="panel">
              <div className="panel-header"><div><h2>Alertas financieras</h2><span>Vencimientos y controles que necesitan atención</span></div></div>
              <div className="alert-list">
                {alerts.length === 0 ? <div className="empty">No hay alertas relevantes por ahora.</div> : alerts.map((alert, index) => <div className={`alert-row ${alert.level}`} key={`${alert.title}-${index}`}><div><strong>{alert.title}</strong><span>{alert.text}</span></div></div>)}
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><div><h2>Distribución</h2><span>Foto financiera actual</span></div></div>
              <div className="stack-list">
                <StackRow label="Cuentas y efectivo" value={cashTotal} total={Math.max(totalAssets, 1)} />
                <StackRow label="Bienes" value={fixedAssetValue} total={Math.max(totalAssets, 1)} />
                <StackRow label="Inversiones" value={investmentAssets} total={Math.max(totalAssets, 1)} />
                <StackRow label="Capital por cobrar" value={receivableAssets} total={Math.max(totalAssets, 1)} />
                <StackRow label="Tarjetas" value={cardLiabilities} total={Math.max(totalLiabilities, 1)} danger />
                <StackRow label="Otras deudas" value={debtLiabilities} total={Math.max(totalLiabilities, 1)} danger />
              </div>
            </div>
          </section>
        </>
      ) : null}

      {section === 'accounts' ? (
        <section className="section">
          <div className="section-title"><div><h2>Cuentas y efectivo</h2><p>El saldo se actualiza con los movimientos asignados a cada cuenta.</p></div><button className="button primary" onClick={() => setForm('account')}>+ Cuenta</button></div>
          <div className="cards-list">
            {accountBalances.map((account) => <article className="entity-card" key={account.id}><div className="entity-top"><div><h3>{account.name}</h3><div className="sub">{account.institution || accountTypeLabel(account.account_type)}</div></div><span className="badge active">{accountTypeLabel(account.account_type)}</span></div><div className="entity-number">{formatCOP(account.balance)}</div><div className="sub">Saldo inicial: {formatCOP(account.opening_balance)}</div></article>)}
            {accounts.length === 0 ? <div className="panel empty">Crea tu primera cuenta para separar efectivo, banco y billeteras digitales.</div> : null}
          </div>
        </section>
      ) : null}

      {section === 'assets' ? (
        <section className="section">
          <div className="section-title"><div><h2>Bienes del patrimonio</h2><p>Carros, inmuebles y otros bienes. Su valor actual se suma al patrimonio.</p></div><button className="button primary" onClick={() => setForm('asset')}>+ Bien</button></div>
          <div className="cards-list">
            {fixedAssets.length === 0 ? <div className="panel empty">Agrega un bien que ya tengas o registra una compra nueva.</div> : fixedAssets.map((asset) => (
              <article className="entity-card" key={asset.id}>
                <div className="entity-top"><div><h3>{asset.name}</h3><div className="sub">{asset.asset_type === 'vehicle' ? 'Vehículo' : asset.asset_type === 'property' ? 'Inmueble' : asset.asset_type === 'equipment' ? 'Equipo' : 'Otro bien'} · {shortDate(asset.acquisition_date)}</div></div><span className="badge active">Activo</span></div>
                <div className="entity-number">{formatCOP(asset.current_value)}</div><div className="sub">Valor actual estimado</div>
                <div className="entity-stats"><div className="entity-stat"><span>Costo de compra</span><strong>{formatCOP(asset.acquisition_cost)}</strong></div><div className="entity-stat"><span>Diferencia de valor</span><strong>{formatCOP(Number(asset.current_value) - Number(asset.acquisition_cost))}</strong></div></div>
                {asset.notes ? <div className="sub" style={{ marginTop: 12 }}>{asset.notes}</div> : null}
                <div className="entity-actions"><button className="button secondary small" onClick={() => { setValuationTarget(asset); setValuationAmount(String(asset.current_value)) }}>Actualizar valor</button></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {section === 'cards' ? (
        <section className="section">
          <div className="section-title"><div><h2>Tarjetas de crédito</h2><p>Controla cupo, saldo utilizado y fecha de pago.</p></div><button className="button primary" onClick={() => setForm('card')}>+ Tarjeta</button></div>
          <div className="cards-list">{creditCards.map((card) => {
            const used = Number(card.current_balance); const limit = Number(card.credit_limit); const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
            return <article className="entity-card" key={card.id}><div className="entity-top"><div><h3>{card.name}</h3><div className="sub">{card.institution}</div></div><span className="badge pending">Paga día {card.payment_day}</span></div><div className="entity-number">{formatCOP(used)}</div><div className="progress"><div style={{ width: `${pct}%` }} /></div><div className="entity-stats"><div className="entity-stat"><span>Cupo</span><strong>{formatCOP(limit)}</strong></div><div className="entity-stat"><span>Disponible</span><strong>{formatCOP(Math.max(0, limit - used))}</strong></div></div>{used > 0 ? <div className="entity-actions"><button className="button teal small" onClick={() => { setActionTarget({ kind: 'card', id: card.id, title: `Pagar ${card.name}` }); setActionAmount('') }}>Registrar pago</button></div> : null}</article>
          })}</div>
        </section>
      ) : null}

      {section === 'budgets' ? (
        <section className="section">
          <div className="section-title"><div><h2>Presupuestos</h2><p>Compara el tope mensual con los gastos reales por categoría.</p></div><button className="button primary" onClick={() => setForm('budget')}>+ Presupuesto</button></div>
          <div className="cards-list">{budgetRows.map((budget) => <article className="entity-card" key={budget.id}><div className="entity-top"><div><h3>{budget.category}</h3><div className="sub">{monthKey(budget.month)}</div></div><span className={`badge ${budget.percentage >= 100 ? 'closed' : budget.percentage >= 80 ? 'pending' : 'active'}`}>{Math.round(budget.percentage)}%</span></div><div className="entity-number">{formatCOP(budget.spent)}</div><div className="progress"><div style={{ width: `${Math.min(100, budget.percentage)}%` }} /></div><div className="entity-stats"><div className="entity-stat"><span>Presupuesto</span><strong>{formatCOP(budget.limit_amount)}</strong></div><div className="entity-stat"><span>Disponible</span><strong>{formatCOP(budget.available)}</strong></div></div></article>)}</div>
        </section>
      ) : null}

      {section === 'goals' ? (
        <section className="section">
          <div className="section-title"><div><h2>Metas de ahorro</h2><p>Separa objetivos sin descontar dos veces el dinero de tus cuentas.</p></div><button className="button primary" onClick={() => setForm('goal')}>+ Meta</button></div>
          <div className="cards-list">{goals.map((goal) => { const pct = Math.min(100, Number(goal.current_amount) / Math.max(1, Number(goal.target_amount)) * 100); return <article className="entity-card" key={goal.id}><div className="entity-top"><div><h3>{goal.name}</h3><div className="sub">Objetivo {goal.target_date ? shortDate(goal.target_date) : 'sin fecha'}</div></div><span className={`badge ${goal.status === 'completed' ? 'paid' : 'active'}`}>{goal.status === 'completed' ? 'Cumplida' : `${Math.round(pct)}%`}</span></div><div className="entity-number">{formatCOP(goal.current_amount)}</div><div className="progress"><div style={{ width: `${pct}%` }} /></div><div className="entity-stats"><div className="entity-stat"><span>Meta</span><strong>{formatCOP(goal.target_amount)}</strong></div><div className="entity-stat"><span>Falta</span><strong>{formatCOP(Math.max(0, Number(goal.target_amount) - Number(goal.current_amount)))}</strong></div></div>{goal.status === 'active' ? <div className="entity-actions"><button className="button teal small" onClick={() => { setActionTarget({ kind: 'goal', id: goal.id, title: `Aportar a ${goal.name}` }); setActionAmount('') }}>Registrar aporte</button></div> : null}</article> })}</div>
        </section>
      ) : null}

      {section === 'debts' ? (
        <section className="section">
          <div className="section-title"><div><h2>Mis deudas</h2><p>Obligaciones personales distintas de los préstamos que tú realizas.</p></div><button className="button primary" onClick={() => setForm('debt')}>+ Deuda</button></div>
          <div className="cards-list">{debts.map((debt) => <article className="entity-card" key={debt.id}><div className="entity-top"><div><h3>{debt.creditor_name}</h3><div className="sub">{debt.description || 'Obligación personal'}</div></div><span className={`badge ${debt.status === 'paid' ? 'paid' : 'pending'}`}>{debt.status === 'paid' ? 'Pagada' : `Día ${debt.due_day ?? '-'}`}</span></div><div className="entity-number">{formatCOP(debt.outstanding_balance)}</div><div className="entity-stats"><div className="entity-stat"><span>Deuda inicial</span><strong>{formatCOP(debt.principal)}</strong></div><div className="entity-stat"><span>Pago mínimo</span><strong>{formatCOP(debt.minimum_payment)}</strong></div><div className="entity-stat"><span>Tasa E.A.</span><strong>{Number(debt.annual_interest_rate).toFixed(2)}%</strong></div></div>{debt.status === 'active' ? <div className="entity-actions"><button className="button teal small" onClick={() => { setActionTarget({ kind: 'debt', id: debt.id, title: `Abonar a ${debt.creditor_name}` }); setActionAmount('') }}>Registrar abono</button></div> : null}</article>)}</div>
        </section>
      ) : null}

      {section === 'reports' ? (
        <section className="section">
          <div className="section-title"><div><h2>Reporte mensual</h2><p>Resumen financiero exportable a Excel o PDF.</p></div><div className="top-actions report-actions"><button className="button secondary" onClick={exportExcel}>Exportar Excel</button><button className="button primary" onClick={exportPdf}>Exportar PDF</button></div></div>
          <div className="report-toolbar"><Field label="Mes"><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></Field></div>
          <section className="metrics management-metrics report-metrics"><MetricCard label="Ingresos" value={formatCOP(report.income)} note="Ingresos del mes" /><MetricCard label="Gastos" value={formatCOP(report.expense)} note="Gastos del mes" /><MetricCard label="Entradas" value={formatCOP(report.inflow)} note="Todo el efectivo recibido" /><MetricCard label="Flujo neto" value={formatCOP(report.net)} note="Entradas menos salidas" highlight /></section>
          <section className="dashboard-grid">
            <div className="panel"><div className="panel-header"><div><h2>Gastos por categoría</h2><span>Ordenados de mayor a menor</span></div></div><div className="stack-list">{report.categories.length === 0 ? <div className="empty">No hay gastos para este mes.</div> : report.categories.map(([category, value]) => <StackRow key={category} label={category} value={value} total={Math.max(report.expense, 1)} />)}</div></div>
            <div className="panel"><div className="panel-header"><div><h2>Balance general</h2><span>Situación actual</span></div></div><div className="stack-list"><SimpleValue label="Activos" value={totalAssets} /><SimpleValue label="Pasivos" value={totalLiabilities} /><SimpleValue label="Patrimonio neto" value={netWorth} strong /></div></div>
          </section>
        </section>
      ) : null}

      {form === 'account' ? <Modal title="Nueva cuenta" onClose={() => setForm(null)}><div className="form-grid"><Field label="Nombre"><input value={accountForm.name} onChange={(e) => setAccountForm((v) => ({ ...v, name: e.target.value }))} placeholder="Ej. Bancolombia ahorros" /></Field><Field label="Tipo"><select value={accountForm.type} onChange={(e) => setAccountForm((v) => ({ ...v, type: e.target.value as Account['account_type'] }))}><option value="savings">Ahorros</option><option value="checking">Corriente</option><option value="cash">Efectivo</option><option value="wallet">Billetera digital</option></select></Field><Field label="Entidad"><input value={accountForm.institution} onChange={(e) => setAccountForm((v) => ({ ...v, institution: e.target.value }))} placeholder="Opcional" /></Field><Field label="Saldo inicial"><input type="number" min="0" value={accountForm.openingBalance} onChange={(e) => setAccountForm((v) => ({ ...v, openingBalance: e.target.value }))} /></Field></div><Footer saving={saving} onCancel={() => setForm(null)} onSave={saveAccount} /></Modal> : null}

      {form === 'asset' ? <Modal title="Agregar bien al patrimonio" onClose={() => setForm(null)}>
        <div className="form-grid">
          <Field label="Nombre del bien"><input autoFocus value={assetForm.name} onChange={(e) => setAssetForm((v) => ({ ...v, name: e.target.value }))} placeholder="Ej. Carro familiar" /></Field>
          <Field label="Tipo"><select value={assetForm.type} onChange={(e) => setAssetForm((v) => ({ ...v, type: e.target.value as FixedAsset['asset_type'] }))}><option value="vehicle">Vehículo</option><option value="property">Inmueble</option><option value="equipment">Equipo</option><option value="other">Otro</option></select></Field>
          <Field label="Cómo registrar la compra"><select value={assetForm.purchaseMode} onChange={(e) => setAssetForm((v) => ({ ...v, purchaseMode: e.target.value as 'already' | 'existing' | 'new', existingTransactionId: '', date: todayISO(), cost: '', currentValue: '' }))}><option value="already">Ya tenía el bien; no registrar otra salida</option><option value="existing">Convertir un gasto ya registrado</option><option value="new">Registrar compra y salida de dinero ahora</option></select></Field>
          {assetForm.purchaseMode === 'existing' ? <Field label="Gasto a convertir"><select value={assetForm.existingTransactionId} onChange={(e) => {
            const transaction = transactions.find((tx) => tx.id === e.target.value && tx.kind === 'expense')
            setAssetForm((v) => ({ ...v, existingTransactionId: e.target.value, date: transaction?.transaction_date || todayISO(), cost: transaction ? String(transaction.amount) : '', currentValue: transaction ? String(transaction.amount) : '' }))
          }}><option value="">Selecciona el gasto</option>{transactions.filter((tx) => tx.kind === 'expense').map((tx) => <option key={tx.id} value={tx.id}>{tx.transaction_date} · {tx.description} · {formatCOP(tx.amount)}</option>)}</select></Field> : null}
          <Field label="Fecha de adquisición"><input type="date" disabled={assetForm.purchaseMode === 'existing'} value={assetForm.date} onChange={(e) => setAssetForm((v) => ({ ...v, date: e.target.value }))} /></Field>
          <Field label="Costo de compra"><input type="number" min="0" step="0.01" disabled={assetForm.purchaseMode === 'existing'} value={assetForm.cost} onChange={(e) => setAssetForm((v) => ({ ...v, cost: e.target.value, currentValue: v.currentValue || e.target.value }))} /></Field>
          <Field label="Valor actual estimado"><input type="number" min="0" step="0.01" value={assetForm.currentValue} onChange={(e) => setAssetForm((v) => ({ ...v, currentValue: e.target.value }))} /></Field>
          {assetForm.purchaseMode === 'new' ? <Field label="Cuenta desde la que se pagó"><select value={assetForm.accountId} onChange={(e) => setAssetForm((v) => ({ ...v, accountId: e.target.value }))}><option value="">Dinero sin cuenta asignada</option>{accountBalances.filter((account) => account.active).map((account) => <option key={account.id} value={account.id}>{account.name} · {formatCOP(account.balance)}</option>)}</select></Field> : null}
          <Field label="Notas"><input value={assetForm.notes} onChange={(e) => setAssetForm((v) => ({ ...v, notes: e.target.value }))} placeholder="Opcional" /></Field>
        </div>
        <p className="sub" style={{ marginTop: 12 }}>Para el carro que ya aparece como gasto, elige “Convertir un gasto ya registrado”. Se conserva la salida de dinero y se retira del total de gastos.</p>
        <Footer saving={saving} onCancel={() => setForm(null)} onSave={saveAsset} />
      </Modal> : null}

      {valuationTarget ? <Modal title={`Actualizar valor de ${valuationTarget.name}`} onClose={() => setValuationTarget(null)}><div className="form-grid"><Field label="Valor actual estimado"><input autoFocus type="number" min="0" step="0.01" value={valuationAmount} onChange={(e) => setValuationAmount(e.target.value)} /></Field></div><Footer saving={saving} onCancel={() => setValuationTarget(null)} onSave={saveValuation} /></Modal> : null}

      {form === 'card' ? <Modal title="Nueva tarjeta" onClose={() => setForm(null)}><div className="form-grid"><Field label="Nombre"><input value={cardForm.name} onChange={(e) => setCardForm((v) => ({ ...v, name: e.target.value }))} placeholder="Ej. Visa Oro" /></Field><Field label="Banco"><input value={cardForm.institution} onChange={(e) => setCardForm((v) => ({ ...v, institution: e.target.value }))} /></Field><Field label="Cupo total"><input type="number" min="0" value={cardForm.creditLimit} onChange={(e) => setCardForm((v) => ({ ...v, creditLimit: e.target.value }))} /></Field><Field label="Saldo utilizado"><input type="number" min="0" value={cardForm.currentBalance} onChange={(e) => setCardForm((v) => ({ ...v, currentBalance: e.target.value }))} /></Field><Field label="Día de corte"><input type="number" min="1" max="28" value={cardForm.cutoffDay} onChange={(e) => setCardForm((v) => ({ ...v, cutoffDay: e.target.value }))} /></Field><Field label="Día de pago"><input type="number" min="1" max="28" value={cardForm.paymentDay} onChange={(e) => setCardForm((v) => ({ ...v, paymentDay: e.target.value }))} /></Field></div><Footer saving={saving} onCancel={() => setForm(null)} onSave={saveCard} /></Modal> : null}

      {form === 'budget' ? <Modal title="Presupuesto mensual" onClose={() => setForm(null)}><div className="form-grid"><Field label="Categoría"><select value={budgetForm.category} onChange={(e) => setBudgetForm((v) => ({ ...v, category: e.target.value }))}><option>Hogar</option><option>Mercado</option><option>Transporte</option><option>Servicios</option><option>Salud</option><option>Ocio</option><option>Educación</option><option>Otros</option></select></Field><Field label="Mes"><input type="month" value={budgetForm.month} onChange={(e) => setBudgetForm((v) => ({ ...v, month: e.target.value }))} /></Field><Field label="Valor máximo"><input type="number" min="0" value={budgetForm.limit} onChange={(e) => setBudgetForm((v) => ({ ...v, limit: e.target.value }))} /></Field></div><Footer saving={saving} onCancel={() => setForm(null)} onSave={saveBudget} /></Modal> : null}

      {form === 'goal' ? <Modal title="Nueva meta de ahorro" onClose={() => setForm(null)}><div className="form-grid"><Field label="Meta"><input value={goalForm.name} onChange={(e) => setGoalForm((v) => ({ ...v, name: e.target.value }))} placeholder="Ej. Viaje" /></Field><Field label="Valor objetivo"><input type="number" min="0" value={goalForm.target} onChange={(e) => setGoalForm((v) => ({ ...v, target: e.target.value }))} /></Field><Field label="Ahorrado actualmente"><input type="number" min="0" value={goalForm.current} onChange={(e) => setGoalForm((v) => ({ ...v, current: e.target.value }))} /></Field><Field label="Fecha objetivo"><input type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm((v) => ({ ...v, targetDate: e.target.value }))} /></Field></div><Footer saving={saving} onCancel={() => setForm(null)} onSave={saveGoal} /></Modal> : null}

      {form === 'debt' ? <Modal title="Registrar deuda" onClose={() => setForm(null)}><div className="form-grid"><Field label="Acreedor"><input value={debtForm.creditor} onChange={(e) => setDebtForm((v) => ({ ...v, creditor: e.target.value }))} placeholder="Banco, persona o entidad" /></Field><Field label="Descripción"><input value={debtForm.description} onChange={(e) => setDebtForm((v) => ({ ...v, description: e.target.value }))} /></Field><Field label="Deuda inicial"><input type="number" min="0" value={debtForm.principal} onChange={(e) => setDebtForm((v) => ({ ...v, principal: e.target.value }))} /></Field><Field label="Saldo actual"><input type="number" min="0" value={debtForm.outstanding} onChange={(e) => setDebtForm((v) => ({ ...v, outstanding: e.target.value }))} placeholder="Si está vacío usa la deuda inicial" /></Field><Field label="Tasa E.A. %"><input type="number" min="0" step="0.01" value={debtForm.annualRate} onChange={(e) => setDebtForm((v) => ({ ...v, annualRate: e.target.value }))} /></Field><Field label="Pago mínimo"><input type="number" min="0" value={debtForm.minimumPayment} onChange={(e) => setDebtForm((v) => ({ ...v, minimumPayment: e.target.value }))} /></Field><Field label="Día de pago"><input type="number" min="1" max="28" value={debtForm.dueDay} onChange={(e) => setDebtForm((v) => ({ ...v, dueDay: e.target.value }))} /></Field></div><Footer saving={saving} onCancel={() => setForm(null)} onSave={saveDebt} /></Modal> : null}

      {actionTarget ? <Modal title={actionTarget.title} onClose={() => setActionTarget(null)}><div className="form-grid"><Field label="Valor"><input autoFocus type="number" min="0" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} /></Field>{actionTarget.kind !== 'goal' ? <Field label="Cuenta de donde sale el dinero"><select value={actionAccountId} onChange={(e) => setActionAccountId(e.target.value)}><option value="">Sin asignar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field> : null}</div><Footer saving={saving} onCancel={() => setActionTarget(null)} onSave={applyAction} /></Modal> : null}
    </>
  )
}

function MetricCard({ label, value, note, highlight = false }: { label: string; value: string; note: string; highlight?: boolean }) {
  return <article className={`metric-card ${highlight ? 'highlight' : ''}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>
}

function StackRow({ label, value, total, danger = false }: { label: string; value: number; total: number; danger?: boolean }) {
  const pct = Math.min(100, Math.max(0, value / Math.max(total, 1) * 100))
  return <div className="stack-row"><div className="stack-head"><strong>{label}</strong><span>{formatCOP(value)}</span></div><div className={`progress ${danger ? 'danger-progress' : ''}`}><div style={{ width: `${pct}%` }} /></div></div>
}

function SimpleValue({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={`simple-value ${strong ? 'strong' : ''}`}><span>{label}</span><strong>{formatCOP(value)}</strong></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="modal"><div className="modal-header"><h2>{title}</h2><button className="close" onClick={onClose}>×</button></div>{children}</div></div>
}

function Footer({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void | Promise<void> }) {
  return <div className="form-footer"><button className="button secondary" onClick={onCancel}>Cancelar</button><button className="button primary" disabled={saving} onClick={onSave}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
}
