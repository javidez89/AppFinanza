import { describe, expect, it } from 'vitest'
import { buildLoanSchedule, periodicRate, type LoanFrequency } from '../../src/lib/finance'

const example = {
  principal: 50_000_000, interestRate: 20, interestRateType: 'total' as const,
  installments: 48, frequency: 'monthly' as const,
  startDate: '2026-10-09', firstDueDate: '2027-03-15',
}
const cents = (value: number) => Math.round(value * 100)

describe('calculation used by the loan form', () => {
  it('applies 20 percent once to the original principal in the reported case', () => {
    const result = buildLoanSchedule(example)
    expect(result.fixedPayment).toBe(1_250_000)
    expect(result.totalInterest).toBe(10_000_000)
    expect(result.totalToCollect).toBe(60_000_000)
    expect(result.schedule).toHaveLength(48)
    expect(result.schedule.every((row) => row.total_amount === 1_250_000)).toBe(true)
    expect(result.schedule.at(-1)?.remaining_balance).toBe(0)
    expect(result.schedule[0].due_date).toBe('2027-03-15')
    expect(result.schedule.at(-1)?.due_date).toBe('2031-02-15')
  })

  it.each(['monthly', 'biweekly', 'weekly'] as LoanFrequency[])('keeps total interest independent of frequency: %s', (frequency) => {
    const result = buildLoanSchedule({ ...example, frequency })
    expect(result.totalInterest).toBe(10_000_000)
    expect(result.totalToCollect).toBe(60_000_000)
    expect(result.fixedPayment).toBe(1_250_000)
  })

  it('does not charge extra total interest for a later first payment or more installments', () => {
    const result = buildLoanSchedule({ ...example, installments: 60, firstDueDate: '2028-03-15' })
    expect(result.totalInterest).toBe(10_000_000)
    expect(result.fixedPayment).toBe(1_000_000)
  })

  it.each([
    [1_000_000, 20, 3], [100.01, 7.35, 7], [0.04, 25, 3], [0.01, 0, 240],
  ])('conserves capital and interest to the cent for %s, %s percent, %s installments', (principal, interestRate, installments) => {
    const result = buildLoanSchedule({ ...example, principal, interestRate, installments })
    expect(result.schedule.reduce((sum, row) => sum + cents(row.principal_amount), 0)).toBe(cents(principal))
    expect(result.schedule.reduce((sum, row) => sum + cents(row.interest_amount), 0)).toBe(cents(result.totalInterest))
    expect(result.schedule.reduce((sum, row) => sum + cents(row.total_amount), 0)).toBe(cents(result.totalToCollect))
    for (const row of result.schedule) {
      expect(row.principal_amount).toBeGreaterThanOrEqual(0)
      expect(row.interest_amount).toBeGreaterThanOrEqual(0)
      expect(cents(row.total_amount)).toBe(cents(row.principal_amount) + cents(row.interest_amount))
    }
    expect(result.schedule.at(-1)?.remaining_balance).toBe(0)
  })

  it('supports interest-free loans and a single installment', () => {
    const result = buildLoanSchedule({ ...example, interestRate: 0, installments: 1 })
    expect(result.fixedPayment).toBe(50_000_000)
    expect(result.totalInterest).toBe(0)
  })

  it('retains monthly and annual-effective amortization as separate modes', () => {
    const monthly = buildLoanSchedule({ ...example, interestRateType: 'monthly' })
    const annual = buildLoanSchedule({ ...example, interestRateType: 'annual_effective' })
    expect(monthly.fixedPayment).toBe(10_001_582.59)
    expect(annual.fixedPayment).toBe(1_478_470.47)
    expect(monthly.schedule.at(-1)?.remaining_balance).toBe(0)
    expect(annual.schedule.at(-1)?.remaining_balance).toBe(0)
  })

  it.each([
    ['2027-01-31', ['2027-01-31', '2027-02-28', '2027-03-31']],
    ['2028-01-31', ['2028-01-31', '2028-02-29', '2028-03-31']],
  ])('clamps month end without skipping February: %s', (firstDueDate, dates) => {
    expect(buildLoanSchedule({ ...example, installments: 3, firstDueDate }).schedule.map((row) => row.due_date)).toEqual(dates)
  })

  it('aligns fortnightly dates with 26 periods per year for periodic rates', () => {
    expect(buildLoanSchedule({ ...example, installments: 3, frequency: 'biweekly' }).schedule.map((row) => row.due_date)).toEqual(['2027-03-15', '2027-03-29', '2027-04-12'])
    expect((1 + periodicRate(20, 'annual_effective', 'biweekly')) ** 26).toBeCloseTo(1.2, 12)
    expect((1 + periodicRate(2, 'monthly', 'biweekly')) ** 26).toBeCloseTo(1.02 ** 12, 12)
  })

  it.each([
    { principal: 0 }, { principal: -1 }, { principal: NaN }, { principal: Infinity },
    { interestRate: -1 }, { interestRate: NaN }, { interestRate: Infinity },
    { installments: 0 }, { installments: 2.5 }, { installments: 241 },
    { firstDueDate: '2027-02-30' }, { firstDueDate: 'bad-date' }, { firstDueDate: '2026-01-01' },
    { startDate: 'invalid' },
  ])('rejects invalid input instead of silently changing the agreement: %j', (changes) => {
    expect(() => buildLoanSchedule({ ...example, ...changes })).toThrow()
  })
})
