export type LoanFrequency = 'monthly' | 'biweekly' | 'weekly'
export type InterestRateType = 'monthly' | 'annual_effective'

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
  const periodsPerYear = frequency === 'monthly' ? 12 : frequency === 'biweekly' ? 24 : 52
  const rate = Math.max(ratePercent, 0) / 100
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
    date.setMonth(date.getMonth() + index)
  } else if (frequency === 'biweekly') {
    date.setDate(date.getDate() + index * 14)
  } else {
    date.setDate(date.getDate() + index * 7)
  }
  return date.toISOString().slice(0, 10)
}

export function buildLoanSchedule(params: {
  principal: number
  interestRate: number
  interestRateType: InterestRateType
  installments: number
  frequency: LoanFrequency
  firstDueDate: string
}) {
  const principal = Math.max(params.principal, 0)
  const installments = Math.max(Math.trunc(params.installments), 1)
  const rate = periodicRate(params.interestRate, params.interestRateType, params.frequency)
  const fixedPayment = rate === 0
    ? principal / installments
    : principal * (rate / (1 - Math.pow(1 + rate, -installments)))

  let balance = principal
  const schedule: ScheduleRow[] = []
  const firstDue = new Date(`${params.firstDueDate}T12:00:00`)

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
