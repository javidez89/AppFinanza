export type LoanFrequency = 'monthly' | 'biweekly' | 'weekly'
export type InterestRateType = 'total' | 'monthly' | 'annual_effective'

export type ScheduleRow = {
  installment_number: number
  due_date: string
  principal_amount: number
  interest_amount: number
  total_amount: number
  remaining_balance: number
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

export function periodicRate(
  ratePercent: number,
  rateType: InterestRateType,
  frequency: LoanFrequency,
) {
  if (!Number.isFinite(ratePercent) || ratePercent < 0) throw new Error('La tasa debe ser un número mayor o igual que cero.')
  if (rateType === 'total') throw new Error('El interés total no es una tasa periódica.')
  const periodsPerYear = frequency === 'monthly' ? 12 : frequency === 'biweekly' ? 26 : 52
  const rate = ratePercent / 100
  if (rateType === 'monthly') {
    if (frequency === 'monthly') return rate
    const annualFromMonthly = Math.pow(1 + rate, 12) - 1
    return Math.pow(1 + annualFromMonthly, 1 / periodsPerYear) - 1
  }
  return Math.pow(1 + rate, 1 / periodsPerYear) - 1
}

function addDueDate(baseDate: Date, index: number, frequency: LoanFrequency) {
  const date = new Date(baseDate)
  if (frequency === 'monthly') {
    const day = date.getUTCDate()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() + index)
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
    date.setUTCDate(Math.min(day, lastDay))
  } else if (frequency === 'biweekly') {
    date.setUTCDate(date.getUTCDate() + index * 14)
  } else {
    date.setUTCDate(date.getUTCDate() + index * 7)
  }
  return date.toISOString().slice(0, 10)
}

function parseLoanDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Ingresa una fecha válida para el préstamo.')
  }
  return date
}

export function buildLoanSchedule(params: {
  principal: number
  interestRate: number
  interestRateType: InterestRateType
  installments: number
  frequency: LoanFrequency
  firstDueDate: string
  startDate?: string
}) {
  const principal = roundMoney(params.principal)
  const installments = params.installments
  if (!Number.isFinite(principal) || principal <= 0) throw new Error('El capital debe ser mayor que cero.')
  if (!Number.isFinite(params.interestRate) || params.interestRate < 0) throw new Error('La tasa debe ser un número mayor o igual que cero.')
  if (!Number.isInteger(installments) || installments < 1 || installments > 240) throw new Error('Ingresa entre 1 y 240 cuotas enteras.')
  if (!['total', 'monthly', 'annual_effective'].includes(params.interestRateType)) throw new Error('Selecciona una modalidad de interés válida.')
  if (!['monthly', 'biweekly', 'weekly'].includes(params.frequency)) throw new Error('Selecciona una periodicidad válida.')
  const firstDue = parseLoanDate(params.firstDueDate)
  if (params.startDate && firstDue < parseLoanDate(params.startDate)) throw new Error('La primera cuota no puede ser anterior a la entrega.')

  if (params.interestRateType === 'total') {
    const principalCents = Math.round(principal * 100)
    const interestCents = Math.round(principalCents * params.interestRate / 100)
    if (!Number.isSafeInteger(principalCents + interestCents)) throw new Error('El importe supera el límite de cálculo permitido.')
    // Allocate each component in cents; cumulative rounding preserves both totals.
    const schedule: ScheduleRow[] = Array.from({ length: installments }, (_, index) => {
      const number = index + 1
      const principalPaid = Math.round(principalCents * (number / installments))
      const principalBefore = Math.round(principalCents * (index / installments))
      const interestPaid = Math.round(interestCents * (number / installments))
      const interestBefore = Math.round(interestCents * (index / installments))
      return {
        installment_number: number,
        due_date: addDueDate(firstDue, index, params.frequency),
        principal_amount: (principalPaid - principalBefore) / 100,
        interest_amount: (interestPaid - interestBefore) / 100,
        total_amount: (principalPaid - principalBefore + interestPaid - interestBefore) / 100,
        remaining_balance: (principalCents - principalPaid) / 100,
      }
    })
    return {
      fixedPayment: schedule[0].total_amount,
      totalToCollect: (principalCents + interestCents) / 100,
      totalInterest: interestCents / 100,
      schedule,
    }
  }
  const rate = periodicRate(params.interestRate, params.interestRateType, params.frequency)
  const fixedPayment = rate === 0
    ? principal / installments
    : principal * (rate / (1 - Math.pow(1 + rate, -installments)))

  let balance = principal
  const schedule: ScheduleRow[] = []

  for (let i = 1; i <= installments; i += 1) {
    const interest = rate === 0 ? 0 : balance * rate
    let principalPart = fixedPayment - interest
    let payment = fixedPayment

    if (i === installments || principalPart > balance) {
      principalPart = balance
      payment = principalPart + interest
    }

    balance = Math.max(0, balance - principalPart)
    schedule.push({
      installment_number: i,
      due_date: addDueDate(firstDue, i - 1, params.frequency),
      principal_amount: roundMoney(principalPart),
      interest_amount: roundMoney(interest),
      total_amount: roundMoney(payment),
      remaining_balance: roundMoney(balance),
    })
  }

  return {
    fixedPayment: roundMoney(schedule[0]?.total_amount ?? 0),
    totalToCollect: roundMoney(schedule.reduce((sum, row) => sum + row.total_amount, 0)),
    totalInterest: roundMoney(schedule.reduce((sum, row) => sum + row.interest_amount, 0)),
    schedule,
  }
}

export function calculateCdtReturn(principal: number, annualEffectiveRate: number, startDate: string, maturityDate: string) {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${maturityDate}T12:00:00`)
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  const rate = Math.max(annualEffectiveRate, 0) / 100
  const grossReturn = principal * (Math.pow(1 + rate, days / 365) - 1)
  return {
    days,
    grossReturn: roundMoney(grossReturn),
    projectedMaturityValue: roundMoney(principal + grossReturn),
  }
}
