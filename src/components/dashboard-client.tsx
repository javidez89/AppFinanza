'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildLoanSchedule, calculateCdtReturn, formatCOP, type InterestRateType, type LoanFrequency } from '@/lib/finance'
import { ManagementPanel } from '@/components/management-panel'
import { appPath } from '@/lib/app-path'

type View = 'dashboard' | 'movements' | 'loans' | 'investments' | 'management'
type Modal = null | 'income' | 'expense' | 'edit-expense' | 'loan' | 'investment'

type TransactionKind = 'income' | 'expense' | 'loan_out' | 'loan_payment' | 'investment_out' | 'investment_return' | 'debt_payment'

type Transaction = {
  id: string
  kind: TransactionKind
  description: string
  category: string
  amount: number
  transaction_date: string
  notes: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
  account_id: string | null
}

type Account = {
  id: string
  name: string
  account_type: 'cash' | 'checking' | 'savings' | 'wallet'
  institution: string | null
  opening_balance: number
  active: boolean
}

type Loan = {
  id: string
  borrower_name: string
  borrower_contact: string | null
  description: string | null
  principal: number
  interest_rate: number
  interest_rate_type: InterestRateType
  installment_frequency: LoanFrequency
  installments_count: number
  fixed_payment: number
  total_to_collect: number
  total_interest: number
  start_date: string
  first_due_date: string
  status: 'active' | 'paid' | 'cancelled'
  created_at: string
}

type Installment = {
  id: string
  loan_id: string
  installment_number: number
  due_date: string
  principal_amount: number
  interest_amount: number
  total_amount: number
  remaining_balance: number
  status: 'pending' | 'paid' | 'overdue'
  paid_at: string | null
}

type Investment = {
  id: string
  investment_type: 'cdt' | 'fund' | 'other'
  institution: string
  description: string | null
  principal: number
  annual_effective_rate: number
  start_date: string
  maturity_date: string
  term_days: number
  projected_return: number
  projected_maturity_value: number
  status: 'active' | 'matured' | 'redeemed' | 'cancelled'
  redeemed_at: string | null
  created_at: string
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const nextMonthISO = () => {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 10)
}

const kindMeta: Record<TransactionKind, { label: string; direction: 'in' | 'out' }> = {
  income: { label: 'Ingreso', direction: 'in' },
  expense: { label: 'Gasto', direction: 'out' },
  loan_out: { label: 'Préstamo entregado', direction: 'out' },
  loan_payment: { label: 'Cuota cobrada', direction: 'in' },
  investment_out: { label: 'Inversión', direction: 'out' },
  investment_return: { label: 'Redención inversión', direction: 'in' },
  debt_payment: { label: 'Pago de deuda', direction: 'out' },
}

function monthKey(date: string) {
  return date.slice(0, 7)
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`))
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { month: 'short' })
    .format(new Date(year, month - 1, 1))
    .replace('.', '')
}

function isCashIn(kind: TransactionKind) {
  return kind === 'income' || kind === 'loan_payment' || kind === 'investment_return'
}

function isCashOut(kind: TransactionKind) {
  return kind === 'expense' || kind === 'loan_out' || kind === 'investment_out' || kind === 'debt_payment'
}

export function DashboardClient({ email, name }: { email: string; name: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [view, setView] = useState<View>('dashboard')
  const [modal, setModal] = useState<Modal>(null)
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  const [movementForm, setMovementForm] = useState({
    description: '', amount: '', category: 'General', date: todayISO(), notes: '', accountId: '',
  })
  const [loanForm, setLoanForm] = useState({
    borrower: '', contact: '', description: '', principal: '', rate: '', rateType: 'monthly' as InterestRateType,
    frequency: 'monthly' as LoanFrequency, installments: '6', startDate: todayISO(), firstDueDate: nextMonthISO(), accountId: '',
  })
  const [investmentForm, setInvestmentForm] = useState({
    institution: '', description: '', principal: '', annualRate: '', startDate: todayISO(), maturityDate: nextMonthISO(), accountId: '',
  })

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [txResult, loanResult, installmentResult, investmentResult, accountResult] = await Promise.all([
      supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('loan_installments').select('*').order('due_date', { ascending: true }),
      supabase.from('investments').select('*').order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    ])

    const firstError = txResult.error || loanResult.error || installmentResult.error || investmentResult.error || accountResult.error
    if (firstError) {
      notify(`No se pudo cargar la información: ${firstError.message}`)
      setLoading(false)
      return
    }

    setTransactions((txResult.data ?? []) as Transaction[])
    setAccounts((accountResult.data ?? []) as Account[])
    setLoans((loanResult.data ?? []) as Loan[])
    setInstallments((installmentResult.data ?? []) as Installment[])
    setInvestments((investmentResult.data ?? []) as Investment[])
    setLoading(false)
  }, [notify, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const installedHandler = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const currentMonth = todayISO().slice(0, 7)
  const metrics = useMemo(() => {
    const openingBalances = accounts.reduce((sum, account) => sum + Number(account.opening_balance), 0)
    const cash = transactions.reduce((sum, tx) => {
      if (isCashIn(tx.kind)) return sum + Number(tx.amount)
      if (isCashOut(tx.kind)) return sum - Number(tx.amount)
      return sum
    }, openingBalances)

    const income = transactions
      .filter((tx) => tx.kind === 'income' && monthKey(tx.transaction_date) === currentMonth)
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
    const expense = transactions
      .filter((tx) => tx.kind === 'expense' && monthKey(tx.transaction_date) === currentMonth)
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
    const receivable = installments
      .filter((item) => item.status !== 'paid')
      .reduce((sum, item) => sum + Number(item.total_amount), 0)
    const invested = investments
      .filter((investment) => investment.status === 'active' || investment.status === 'matured')
      .reduce((sum, investment) => sum + Number(investment.principal), 0)

    return { cash, income, expense, receivable, invested }
  }, [transactions, installments, investments, accounts, currentMonth])

  const monthlyChart = useMemo(() => {
    const keys: string[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
    const rows = keys.map((key) => {
      const monthTx = transactions.filter((tx) => monthKey(tx.transaction_date) === key)
      return {
        key,
        label: monthLabel(key),
        inflow: monthTx.filter((tx) => isCashIn(tx.kind)).reduce((sum, tx) => sum + Number(tx.amount), 0),
        outflow: monthTx.filter((tx) => isCashOut(tx.kind)).reduce((sum, tx) => sum + Number(tx.amount), 0),
      }
    })
    const max = Math.max(1, ...rows.flatMap((row) => [row.inflow, row.outflow]))
    return rows.map((row) => ({ ...row, inHeight: Math.max(3, (row.inflow / max) * 155), outHeight: Math.max(3, (row.outflow / max) * 155) }))
  }, [transactions])

  const upcomingInstallments = useMemo(() => {
    return installments.filter((item) => item.status !== 'paid').slice(0, 5)
  }, [installments])

  const loanPreview = useMemo(() => {
    const principal = Number(loanForm.principal)
    const rate = Number(loanForm.rate)
    const count = Number(loanForm.installments)
    if (!principal || principal <= 0 || Number.isNaN(rate) || !count || count <= 0 || !loanForm.firstDueDate) return null
    return buildLoanSchedule({
      principal,
      interestRate: rate,
      interestRateType: loanForm.rateType,
      installments: count,
      frequency: loanForm.frequency,
      firstDueDate: loanForm.firstDueDate,
    })
  }, [loanForm])

  const investmentPreview = useMemo(() => {
    const principal = Number(investmentForm.principal)
    const rate = Number(investmentForm.annualRate)
    if (!principal || principal <= 0 || Number.isNaN(rate) || !investmentForm.startDate || !investmentForm.maturityDate) return null
    return calculateCdtReturn(principal, rate, investmentForm.startDate, investmentForm.maturityDate)
  }, [investmentForm])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = appPath('/login/')
  }

  async function installApp() {
    if (!installPrompt) {
      notify('En Android abre el menú de Chrome y usa “Instalar aplicación” o “Añadir a pantalla principal”.')
      return
    }
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstalled(true)
      notify('Aplicación instalada correctamente.')
    }
    setInstallPrompt(null)
  }

  async function saveMovement(kind: 'income' | 'expense') {
    const expenseToEdit = modal === 'edit-expense' ? editingExpense : null
    if (modal === 'edit-expense' && !expenseToEdit) return
    const amount = Number(movementForm.amount)
    if (!movementForm.description.trim() || !Number.isFinite(amount) || amount <= 0 || !movementForm.date) {
      notify('Escribe una descripción, una fecha y un valor mayor que cero.')
      return
    }
    setSaving(true)
    const values = {
      description: movementForm.description.trim(),
      category: movementForm.category,
      amount,
      transaction_date: movementForm.date,
      notes: movementForm.notes.trim() || null,
      account_id: movementForm.accountId || (expenseToEdit ? null : accounts[0]?.id || null),
    }
    const { error } = expenseToEdit
      ? await supabase.from('transactions').update(values).eq('id', expenseToEdit.id).eq('kind', 'expense').select('id').single()
      : await supabase.from('transactions').insert({ ...values, kind })
    setSaving(false)
    if (error) {
      notify(error.message)
      return
    }
    setMovementForm({ description: '', amount: '', category: 'General', date: todayISO(), notes: '', accountId: '' })
    setEditingExpense(null)
    setModal(null)
    notify(expenseToEdit ? 'Gasto actualizado.' : kind === 'income' ? 'Ingreso registrado.' : 'Gasto registrado.')
    await loadData()
  }

  function openNewMovement(kind: 'income' | 'expense') {
    setEditingExpense(null)
    setMovementForm({ description: '', amount: '', category: 'General', date: todayISO(), notes: '', accountId: '' })
    setModal(kind)
  }

  function openEditExpense(transaction: Transaction) {
    if (transaction.kind !== 'expense') return
    setEditingExpense(transaction)
    setMovementForm({
      description: transaction.description,
      amount: String(transaction.amount),
      category: transaction.category,
      date: transaction.transaction_date,
      notes: transaction.notes || '',
      accountId: transaction.account_id || '',
    })
    setModal('edit-expense')
  }

  async function saveLoan() {
    if (!loanPreview || !loanForm.borrower.trim()) {
      notify('Completa el nombre, capital, interés y número de cuotas.')
      return
    }
    const principal = Number(loanForm.principal)
    setSaving(true)
    const { data: loan, error: loanError } = await supabase.from('loans').insert({
      borrower_name: loanForm.borrower.trim(),
      borrower_contact: loanForm.contact.trim() || null,
      description: loanForm.description.trim() || null,
      principal,
      interest_rate: Number(loanForm.rate),
      interest_rate_type: loanForm.rateType,
      installment_frequency: loanForm.frequency,
      installments_count: Number(loanForm.installments),
      fixed_payment: loanPreview.fixedPayment,
      total_to_collect: loanPreview.totalToCollect,
      total_interest: loanPreview.totalInterest,
      start_date: loanForm.startDate,
      first_due_date: loanForm.firstDueDate,
    }).select('*').single()

    if (loanError || !loan) {
      setSaving(false)
      notify(loanError?.message ?? 'No fue posible crear el préstamo.')
      return
    }

    const scheduleRows = loanPreview.schedule.map((row) => ({
      loan_id: loan.id,
      ...row,
    }))
    const { error: scheduleError } = await supabase.from('loan_installments').insert(scheduleRows)
    if (scheduleError) {
      await supabase.from('loans').delete().eq('id', loan.id)
      setSaving(false)
      notify(`No fue posible crear las cuotas: ${scheduleError.message}`)
      return
    }

    const { error: movementError } = await supabase.from('transactions').insert({
      kind: 'loan_out',
      description: `Préstamo entregado a ${loanForm.borrower.trim()}`,
      category: 'Préstamos',
      amount: principal,
      transaction_date: loanForm.startDate,
      reference_type: 'loan',
      reference_id: loan.id,
      account_id: loanForm.accountId || accounts[0]?.id || null,
    })

    if (movementError) {
      await supabase.from('loans').delete().eq('id', loan.id)
      setSaving(false)
      notify(`El préstamo no se guardó completo: ${movementError.message}`)
      return
    }

    setSaving(false)
    setLoanForm({ borrower: '', contact: '', description: '', principal: '', rate: '', rateType: 'monthly', frequency: 'monthly', installments: '6', startDate: todayISO(), firstDueDate: nextMonthISO(), accountId: '' })
    setModal(null)
    notify('Préstamo creado con su plan de cuotas.')
    await loadData()
  }

  async function payInstallment(installment: Installment) {
    if (installment.status === 'paid') return
    const loan = loans.find((item) => item.id === installment.loan_id)
    if (!loan) return
    setSaving(true)
    const paidAt = new Date().toISOString()
    const { error: updateError } = await supabase.from('loan_installments').update({ status: 'paid', paid_at: paidAt }).eq('id', installment.id)
    if (updateError) {
      setSaving(false)
      notify(updateError.message)
      return
    }
    const { error: movementError } = await supabase.from('transactions').insert({
      kind: 'loan_payment',
      description: `Cuota ${installment.installment_number} - ${loan.borrower_name}`,
      category: 'Préstamos',
      amount: installment.total_amount,
      transaction_date: todayISO(),
      reference_type: 'loan_installment',
      reference_id: installment.id,
      account_id: accounts[0]?.id || null,
    })
    if (movementError) {
      await supabase.from('loan_installments').update({ status: 'pending', paid_at: null }).eq('id', installment.id)
      setSaving(false)
      notify(`No se pudo registrar el cobro: ${movementError.message}`)
      return
    }

    const remaining = installments.filter((item) => item.loan_id === installment.loan_id && item.status !== 'paid' && item.id !== installment.id)
    if (remaining.length === 0) {
      await supabase.from('loans').update({ status: 'paid' }).eq('id', installment.loan_id)
    }
    setSaving(false)
    notify('Cuota marcada como pagada y sumada al flujo de caja.')
    await loadData()
  }

  async function saveInvestment() {
    if (!investmentPreview || !investmentForm.institution.trim()) {
      notify('Completa entidad, capital, tasa y fechas del CDT.')
      return
    }
    if (investmentPreview.days <= 0) {
      notify('La fecha de vencimiento debe ser posterior al inicio.')
      return
    }
    const principal = Number(investmentForm.principal)
    setSaving(true)
    const { data: investment, error: investmentError } = await supabase.from('investments').insert({
      investment_type: 'cdt',
      institution: investmentForm.institution.trim(),
      description: investmentForm.description.trim() || null,
      principal,
      annual_effective_rate: Number(investmentForm.annualRate),
      start_date: investmentForm.startDate,
      maturity_date: investmentForm.maturityDate,
      term_days: investmentPreview.days,
      projected_return: investmentPreview.grossReturn,
      projected_maturity_value: investmentPreview.projectedMaturityValue,
    }).select('*').single()

    if (investmentError || !investment) {
      setSaving(false)
      notify(investmentError?.message ?? 'No fue posible registrar la inversión.')
      return
    }

    const { error: movementError } = await supabase.from('transactions').insert({
      kind: 'investment_out',
      description: `Apertura CDT - ${investmentForm.institution.trim()}`,
      category: 'Inversiones',
      amount: principal,
      transaction_date: investmentForm.startDate,
      reference_type: 'investment',
      reference_id: investment.id,
      account_id: investmentForm.accountId || accounts[0]?.id || null,
    })
    if (movementError) {
      await supabase.from('investments').delete().eq('id', investment.id)
      setSaving(false)
      notify(`La inversión no se guardó completa: ${movementError.message}`)
      return
    }

    setSaving(false)
    setInvestmentForm({ institution: '', description: '', principal: '', annualRate: '', startDate: todayISO(), maturityDate: nextMonthISO(), accountId: '' })
    setModal(null)
    notify('CDT registrado y descontado del saldo de caja.')
    await loadData()
  }

  async function redeemInvestment(investment: Investment) {
    if (investment.status === 'redeemed') return
    setSaving(true)
    const { error: updateError } = await supabase.from('investments').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', investment.id)
    if (updateError) {
      setSaving(false)
      notify(updateError.message)
      return
    }
    const { error: movementError } = await supabase.from('transactions').insert({
      kind: 'investment_return',
      description: `Redención CDT - ${investment.institution}`,
      category: 'Inversiones',
      amount: investment.projected_maturity_value,
      transaction_date: todayISO(),
      reference_type: 'investment',
      reference_id: investment.id,
      account_id: accounts[0]?.id || null,
    })
    if (movementError) {
      await supabase.from('investments').update({ status: 'active', redeemed_at: null }).eq('id', investment.id)
      setSaving(false)
      notify(`No se pudo registrar la redención: ${movementError.message}`)
      return
    }
    setSaving(false)
    notify('Redención registrada en el flujo de caja.')
    await loadData()
  }

  function NavButtons({ mobile = false }: { mobile?: boolean }) {
    const items: Array<{ key: View; label: string }> = [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'movements', label: 'Movimientos' },
      { key: 'loans', label: 'Préstamos' },
      { key: 'investments', label: 'Inversiones' },
      { key: 'management', label: 'Gerencia' },
    ]
    if (mobile) {
      return <>{items.map((item) => <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>{item.label}</button>)}</>
    }
    return <>{items.map((item) => <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}><span className="nav-dot" />{item.label}</button>)}</>
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">MG</div>
          <div><strong>Mi Gerencia</strong><span>Control financiero</span></div>
        </div>
        <nav className="nav"><NavButtons /></nav>
        <div className="sidebar-bottom">
          <div className="account-chip"><strong>{name}</strong><span>{email}</span></div>
          <button className="logout" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{view === 'dashboard' ? `Hola, ${name.split(' ')[0]}` : view === 'movements' ? 'Movimientos' : view === 'loans' ? 'Préstamos' : view === 'investments' ? 'Inversiones' : 'Gerencia financiera'}</h1>
            <p>{view === 'dashboard' ? 'Una vista clara de tu dinero, cartera e inversiones.' : 'Información compartida entre los dos usuarios autorizados.'}</p>
          </div>
          <div className="top-actions">
            <button className="button secondary" onClick={() => openNewMovement('expense')}>+ Gasto</button>
            <button className="button primary" onClick={() => openNewMovement('income')}>+ Ingreso</button>
          </div>
        </header>

        {!installed && view === 'dashboard' ? (
          <div className="install-banner">
            <div><strong>Instala Mi Gerencia en tu Android</strong><span>Se abrirá como una aplicación independiente desde tu pantalla principal.</span></div>
            <button className="button teal small" onClick={installApp}>Instalar app</button>
          </div>
        ) : null}

        {loading ? <div className="panel empty">Cargando información financiera…</div> : null}

        {!loading && view === 'dashboard' ? (
          <>
            <section className="metrics">
              <MetricCard label="Saldo de caja" value={formatCOP(metrics.cash)} note="Cuentas + flujo acumulado" highlight />
              <MetricCard label="Ingresos del mes" value={formatCOP(metrics.income)} note="Ingresos normales" />
              <MetricCard label="Gastos del mes" value={formatCOP(metrics.expense)} note="Gastos registrados" />
              <MetricCard label="Por cobrar" value={formatCOP(metrics.receivable)} note="Cuotas pendientes" />
              <MetricCard label="Capital invertido" value={formatCOP(metrics.invested)} note="CDT activos" />
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <div className="panel-header"><div><h2>Flujo de caja</h2><span>Últimos 6 meses</span></div></div>
                <div className="chart">
                  {monthlyChart.map((row) => (
                    <div className="chart-group" key={row.key} title={`Entradas ${formatCOP(row.inflow)} · Salidas ${formatCOP(row.outflow)}`}>
                      <div className="bars">
                        <div className="bar in" style={{ height: `${row.inHeight}px` }} />
                        <div className="bar out" style={{ height: `${row.outHeight}px` }} />
                      </div>
                      <div className="chart-label">{row.label}</div>
                    </div>
                  ))}
                </div>
                <div className="chart-legend"><span><i className="legend-dot in" />Entradas</span><span><i className="legend-dot out" />Salidas</span></div>
              </div>

              <div className="panel">
                <div className="panel-header"><div><h2>Próximas cuotas</h2><span>Por cobrar</span></div><button className="button secondary small" onClick={() => setView('loans')}>Ver todo</button></div>
                <div className="quick-list">
                  {upcomingInstallments.length === 0 ? <div className="empty">No hay cuotas pendientes.</div> : upcomingInstallments.map((item) => {
                    const loan = loans.find((row) => row.id === item.loan_id)
                    const overdue = item.due_date < todayISO()
                    return (
                      <div className="quick-item" key={item.id}>
                        <div className="quick-icon">{item.installment_number}</div>
                        <div><strong>{loan?.borrower_name ?? 'Préstamo'}</strong><span>{overdue ? 'Vencida · ' : ''}{shortDate(item.due_date)}</span></div>
                        <div className="quick-amount in">{formatCOP(item.total_amount)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            <section className="dashboard-grid">
              <RecentTransactions transactions={transactions.slice(0, 7)} onViewAll={() => setView('movements')} />
              <div className="panel">
                <div className="panel-header"><div><h2>Acciones rápidas</h2><span>Registrar en segundos</span></div></div>
                <div className="quick-list">
                  <QuickAction initials="IN" title="Nuevo ingreso" text="Salario, venta, devolución…" onClick={() => openNewMovement('income')} />
                  <QuickAction initials="GA" title="Nuevo gasto" text="Compra, servicio, pago…" onClick={() => openNewMovement('expense')} />
                  <QuickAction initials="PR" title="Prestar dinero" text="Cuotas e interés automático" onClick={() => setModal('loan')} />
                  <QuickAction initials="CD" title="Registrar CDT" text="Tasa E.A. y rendimiento" onClick={() => setModal('investment')} />
                </div>
              </div>
            </section>
          </>
        ) : null}

        {!loading && view === 'movements' ? (
          <section className="section">
            <div className="section-title">
              <div><h2>Todos los movimientos</h2><p>Incluye operaciones normales y movimientos automáticos de préstamos e inversiones.</p></div>
              <div style={{ display: 'flex', gap: 8 }}><button className="button secondary" onClick={() => openNewMovement('expense')}>+ Gasto</button><button className="button primary" onClick={() => openNewMovement('income')}>+ Ingreso</button></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Categoría</th><th>Valor</th><th>Acciones</th></tr></thead>
                <tbody>
                  {transactions.length === 0 ? <tr><td colSpan={6} className="empty">Aún no hay movimientos.</td></tr> : transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{shortDate(tx.transaction_date)}</td>
                      <td><span className={`badge ${isCashIn(tx.kind) ? 'paid' : 'pending'}`}>{kindMeta[tx.kind].label}</span></td>
                      <td><strong>{tx.description}</strong>{tx.notes ? <div className="sub">{tx.notes}</div> : null}</td>
                      <td>{tx.category}</td>
                      <td className={isCashIn(tx.kind) ? 'amount-positive' : 'amount-negative'}>{isCashIn(tx.kind) ? '+' : '-'} {formatCOP(tx.amount)}</td>
                      <td>{tx.kind === 'expense' ? <button className="button secondary small" onClick={() => openEditExpense(tx)} aria-label={`Editar gasto: ${tx.description}`}>Editar</button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!loading && view === 'loans' ? (
          <section className="section">
            <div className="section-title"><div><h2>Cartera de préstamos</h2><p>Controla capital, interés, cuotas, vencimientos y cobros.</p></div><button className="button primary" onClick={() => setModal('loan')}>+ Nuevo préstamo</button></div>
            <div className="cards-list">
              {loans.length === 0 ? <div className="panel empty">Aún no hay préstamos registrados.</div> : loans.map((loan) => {
                const rows = installments.filter((item) => item.loan_id === loan.id)
                const paid = rows.filter((item) => item.status === 'paid')
                const paidTotal = paid.reduce((sum, item) => sum + Number(item.total_amount), 0)
                const pending = rows.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + Number(item.total_amount), 0)
                const progress = rows.length ? (paid.length / rows.length) * 100 : 0
                return (
                  <article className="entity-card" key={loan.id}>
                    <div className="entity-top"><div><h3>{loan.borrower_name}</h3><div className="sub">{loan.description || 'Préstamo personal'} · {loan.installments_count} cuotas</div></div><span className={`badge ${loan.status === 'active' ? 'active' : 'paid'}`}>{loan.status === 'active' ? 'Activo' : 'Pagado'}</span></div>
                    <div className="entity-number">{formatCOP(pending)}</div><div className="sub">Pendiente por cobrar</div>
                    <div className="progress"><div style={{ width: `${progress}%` }} /></div>
                    <div className="entity-stats">
                      <div className="entity-stat"><span>Prestado</span><strong>{formatCOP(loan.principal)}</strong></div>
                      <div className="entity-stat"><span>Interés total</span><strong>{formatCOP(loan.total_interest)}</strong></div>
                      <div className="entity-stat"><span>Cuota</span><strong>{formatCOP(loan.fixed_payment)}</strong></div>
                      <div className="entity-stat"><span>Cobrado</span><strong>{formatCOP(paidTotal)}</strong></div>
                    </div>
                    <div className="entity-actions">
                      {rows.filter((item) => item.status !== 'paid').slice(0, 1).map((item) => <button disabled={saving} className="button teal small" key={item.id} onClick={() => payInstallment(item)}>Cobrar cuota {item.installment_number} · {formatCOP(item.total_amount)}</button>)}
                    </div>
                    {rows.length ? <details style={{ marginTop: 13 }}><summary style={{ fontSize: 11, color: '#61727e', cursor: 'pointer' }}>Ver plan de cuotas</summary><div style={{ marginTop: 8, overflowX: 'auto' }}><table style={{ minWidth: 520 }}><thead><tr><th>#</th><th>Vence</th><th>Capital</th><th>Interés</th><th>Total</th><th>Estado</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td>{item.installment_number}</td><td>{shortDate(item.due_date)}</td><td>{formatCOP(item.principal_amount)}</td><td>{formatCOP(item.interest_amount)}</td><td><strong>{formatCOP(item.total_amount)}</strong></td><td>{item.status === 'paid' ? <span className="badge paid">Pagada</span> : <button className="button secondary small" disabled={saving} onClick={() => payInstallment(item)}>Marcar pagada</button>}</td></tr>)}</tbody></table></div></details> : null}
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        {!loading && view === 'investments' ? (
          <section className="section">
            <div className="section-title"><div><h2>Inversiones</h2><p>Empieza con CDT y conserva el modelo listo para otros tipos de inversión.</p></div><button className="button primary" onClick={() => setModal('investment')}>+ Nuevo CDT</button></div>
            <div className="cards-list">
              {investments.length === 0 ? <div className="panel empty">Aún no hay inversiones registradas.</div> : investments.map((investment) => (
                <article className="entity-card" key={investment.id}>
                  <div className="entity-top"><div><h3>{investment.institution}</h3><div className="sub">CDT · {investment.term_days} días</div></div><span className={`badge ${investment.status === 'redeemed' ? 'paid' : 'active'}`}>{investment.status === 'redeemed' ? 'Redimido' : 'Activo'}</span></div>
                  <div className="entity-number">{formatCOP(investment.projected_maturity_value)}</div><div className="sub">Valor bruto proyectado al vencimiento</div>
                  <div className="entity-stats">
                    <div className="entity-stat"><span>Capital</span><strong>{formatCOP(investment.principal)}</strong></div>
                    <div className="entity-stat"><span>Tasa E.A.</span><strong>{Number(investment.annual_effective_rate).toFixed(2)}%</strong></div>
                    <div className="entity-stat"><span>Rendimiento</span><strong>{formatCOP(investment.projected_return)}</strong></div>
                    <div className="entity-stat"><span>Vence</span><strong>{shortDate(investment.maturity_date)}</strong></div>
                  </div>
                  {investment.description ? <div className="sub" style={{ marginTop: 12 }}>{investment.description}</div> : null}
                  {investment.status !== 'redeemed' ? <div className="entity-actions"><button className="button teal small" disabled={saving} onClick={() => redeemInvestment(investment)}>Marcar como recibido</button></div> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && view === 'management' ? (
          <ManagementPanel
            accounts={accounts}
            transactions={transactions}
            loans={loans}
            installments={installments}
            investments={investments}
            notify={notify}
            onDataChanged={loadData}
          />
        ) : null}
      </main>

      <nav className="mobile-nav"><NavButtons mobile /></nav>

      {modal === 'income' || modal === 'expense' || modal === 'edit-expense' ? (
        <ModalShell title={modal === 'income' ? 'Registrar ingreso' : modal === 'edit-expense' ? 'Editar gasto' : 'Registrar gasto'} onClose={() => setModal(null)}>
          <div className="form-grid">
            <Field label="Descripción" full><input autoFocus value={movementForm.description} onChange={(e) => setMovementForm((form) => ({ ...form, description: e.target.value }))} placeholder={modal === 'income' ? 'Ej. Pago de salario' : 'Ej. Mercado del mes'} /></Field>
            <Field label="Valor"><input type="number" min="0" inputMode="decimal" value={movementForm.amount} onChange={(e) => setMovementForm((form) => ({ ...form, amount: e.target.value }))} placeholder="0" /></Field>
            <Field label="Fecha"><input type="date" value={movementForm.date} onChange={(e) => setMovementForm((form) => ({ ...form, date: e.target.value }))} /></Field>
            <Field label="Categoría"><select value={movementForm.category} onChange={(e) => setMovementForm((form) => ({ ...form, category: e.target.value }))}><option>General</option><option>Salario</option><option>Ventas</option><option>Hogar</option><option>Mercado</option><option>Transporte</option><option>Servicios</option><option>Salud</option><option>Ocio</option><option>Educación</option><option>Otros</option></select></Field>
            <Field label="Cuenta"><select value={movementForm.accountId} onChange={(e) => setMovementForm((form) => ({ ...form, accountId: e.target.value }))}><option value="">{modal === 'edit-expense' || !accounts.length ? 'Sin asignar' : 'Cuenta principal'}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
            <Field label="Notas"><input value={movementForm.notes} onChange={(e) => setMovementForm((form) => ({ ...form, notes: e.target.value }))} placeholder="Opcional" /></Field>
          </div>
          <div className="form-footer"><button className="button secondary" disabled={saving} onClick={() => setModal(null)}>Cancelar</button><button className="button primary" disabled={saving} onClick={() => saveMovement(modal === 'income' ? 'income' : 'expense')}>{saving ? 'Guardando…' : modal === 'edit-expense' ? 'Guardar cambios' : 'Guardar'}</button></div>
        </ModalShell>
      ) : null}

      {modal === 'loan' ? (
        <ModalShell title="Nuevo préstamo" onClose={() => setModal(null)}>
          <div className="form-grid">
            <Field label="A quién prestas"><input autoFocus value={loanForm.borrower} onChange={(e) => setLoanForm((form) => ({ ...form, borrower: e.target.value }))} placeholder="Nombre de la persona" /></Field>
            <Field label="Contacto"><input value={loanForm.contact} onChange={(e) => setLoanForm((form) => ({ ...form, contact: e.target.value }))} placeholder="Teléfono o referencia" /></Field>
            <Field label="Capital prestado"><input type="number" min="0" inputMode="decimal" value={loanForm.principal} onChange={(e) => setLoanForm((form) => ({ ...form, principal: e.target.value }))} placeholder="0" /></Field>
            <Field label="Tasa de interés %"><input type="number" min="0" step="0.01" inputMode="decimal" value={loanForm.rate} onChange={(e) => setLoanForm((form) => ({ ...form, rate: e.target.value }))} placeholder="Ej. 2" /></Field>
            <Field label="Cómo expresas la tasa"><select value={loanForm.rateType} onChange={(e) => setLoanForm((form) => ({ ...form, rateType: e.target.value as InterestRateType }))}><option value="monthly">Mensual</option><option value="annual_effective">Efectiva anual (E.A.)</option></select></Field>
            <Field label="Periodicidad"><select value={loanForm.frequency} onChange={(e) => setLoanForm((form) => ({ ...form, frequency: e.target.value as LoanFrequency }))}><option value="monthly">Mensual</option><option value="biweekly">Quincenal</option><option value="weekly">Semanal</option></select></Field>
            <Field label="Número de cuotas"><input type="number" min="1" max="240" value={loanForm.installments} onChange={(e) => setLoanForm((form) => ({ ...form, installments: e.target.value }))} /></Field>
            <Field label="Fecha de entrega"><input type="date" value={loanForm.startDate} onChange={(e) => setLoanForm((form) => ({ ...form, startDate: e.target.value }))} /></Field>
            <Field label="Cuenta de origen"><select value={loanForm.accountId} onChange={(e) => setLoanForm((form) => ({ ...form, accountId: e.target.value }))}><option value="">{accounts.length ? 'Cuenta principal' : 'Sin asignar'}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
            <Field label="Primera cuota"><input type="date" value={loanForm.firstDueDate} onChange={(e) => setLoanForm((form) => ({ ...form, firstDueDate: e.target.value }))} /></Field>
            <Field label="Descripción" full><input value={loanForm.description} onChange={(e) => setLoanForm((form) => ({ ...form, description: e.target.value }))} placeholder="Opcional" /></Field>
            {loanPreview ? <div className="preview-box"><div><span>Cuota aproximada</span><strong>{formatCOP(loanPreview.fixedPayment)}</strong></div><div><span>Interés total</span><strong>{formatCOP(loanPreview.totalInterest)}</strong></div><div><span>Total a cobrar</span><strong>{formatCOP(loanPreview.totalToCollect)}</strong></div></div> : null}
          </div>
          <div className="form-footer"><button className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" disabled={saving} onClick={saveLoan}>{saving ? 'Creando…' : 'Crear préstamo'}</button></div>
        </ModalShell>
      ) : null}

      {modal === 'investment' ? (
        <ModalShell title="Registrar CDT" onClose={() => setModal(null)}>
          <div className="form-grid">
            <Field label="Banco o entidad"><input autoFocus value={investmentForm.institution} onChange={(e) => setInvestmentForm((form) => ({ ...form, institution: e.target.value }))} placeholder="Ej. Banco XYZ" /></Field>
            <Field label="Capital invertido"><input type="number" min="0" inputMode="decimal" value={investmentForm.principal} onChange={(e) => setInvestmentForm((form) => ({ ...form, principal: e.target.value }))} placeholder="0" /></Field>
            <Field label="Cuenta de origen"><select value={investmentForm.accountId} onChange={(e) => setInvestmentForm((form) => ({ ...form, accountId: e.target.value }))}><option value="">{accounts.length ? 'Cuenta principal' : 'Sin asignar'}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
            <Field label="Tasa E.A. %"><input type="number" min="0" step="0.01" inputMode="decimal" value={investmentForm.annualRate} onChange={(e) => setInvestmentForm((form) => ({ ...form, annualRate: e.target.value }))} placeholder="Ej. 10.5" /></Field>
            <Field label="Fecha de apertura"><input type="date" value={investmentForm.startDate} onChange={(e) => setInvestmentForm((form) => ({ ...form, startDate: e.target.value }))} /></Field>
            <Field label="Fecha de vencimiento"><input type="date" value={investmentForm.maturityDate} onChange={(e) => setInvestmentForm((form) => ({ ...form, maturityDate: e.target.value }))} /></Field>
            <Field label="Descripción"><input value={investmentForm.description} onChange={(e) => setInvestmentForm((form) => ({ ...form, description: e.target.value }))} placeholder="Opcional" /></Field>
            {investmentPreview ? <div className="preview-box"><div><span>Plazo</span><strong>{investmentPreview.days} días</strong></div><div><span>Rendimiento bruto</span><strong>{formatCOP(investmentPreview.grossReturn)}</strong></div><div><span>Valor esperado</span><strong>{formatCOP(investmentPreview.projectedMaturityValue)}</strong></div></div> : null}
          </div>
          <div className="form-footer"><button className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" disabled={saving} onClick={saveInvestment}>{saving ? 'Guardando…' : 'Guardar CDT'}</button></div>
        </ModalShell>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}

function MetricCard({ label, value, note, highlight = false }: { label: string; value: string; note: string; highlight?: boolean }) {
  return <article className={`metric-card ${highlight ? 'highlight' : ''}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>
}

function QuickAction({ initials, title, text, onClick }: { initials: string; title: string; text: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left' }} className="quick-item"><div className="quick-icon">{initials}</div><div><strong>{title}</strong><span>{text}</span></div><span style={{ color: '#8da0ad' }}>›</span></button>
}

function RecentTransactions({ transactions, onViewAll }: { transactions: Transaction[]; onViewAll: () => void }) {
  return (
    <div className="panel">
      <div className="panel-header"><div><h2>Movimientos recientes</h2><span>Entradas y salidas de caja</span></div><button className="button secondary small" onClick={onViewAll}>Ver todos</button></div>
      <div className="quick-list">
        {transactions.length === 0 ? <div className="empty">Registra tu primer ingreso o gasto.</div> : transactions.map((tx) => (
          <div className="quick-item" key={tx.id}>
            <div className="quick-icon">{kindMeta[tx.kind].label.slice(0, 2).toUpperCase()}</div>
            <div><strong>{tx.description}</strong><span>{shortDate(tx.transaction_date)} · {tx.category}</span></div>
            <div className={`quick-amount ${isCashIn(tx.kind) ? 'in' : 'out'}`}>{isCashIn(tx.kind) ? '+' : '-'} {formatCOP(tx.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="modal"><div className="modal-header"><h2>{title}</h2><button aria-label="Cerrar" className="close" onClick={onClose}>×</button></div>{children}</div></div>
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label>
}
