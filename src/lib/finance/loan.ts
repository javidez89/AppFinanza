export type RateType = "monthly" | "effective_annual";
export type Installment = {
  number: number;
  principal: number;
  interest: number;
  payment: number;
  balance: number;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function monthlyRate(rate: number, type: RateType): number {
  if (rate < 0) throw new Error("La tasa no puede ser negativa");
  return type === "monthly" ? rate / 100 : Math.pow(1 + rate / 100, 1 / 12) - 1;
}

export function amortizationSchedule(
  principal: number,
  rate: number,
  rateType: RateType,
  installments: number,
): Installment[] {
  if (principal <= 0) throw new Error("El capital debe ser mayor que cero");
  if (!Number.isInteger(installments) || installments <= 0) throw new Error("Las cuotas deben ser un entero positivo");
  const monthly = monthlyRate(rate, rateType);
  const payment = monthly === 0 ? principal / installments : principal * (monthly * Math.pow(1 + monthly, installments)) / (Math.pow(1 + monthly, installments) - 1);
  let balance = principal;
  return Array.from({ length: installments }, (_, index) => {
    const interest = roundMoney(balance * monthly);
    const principalPart = index === installments - 1 ? balance : roundMoney(payment - interest);
    const actualPayment = roundMoney(principalPart + interest);
    balance = roundMoney(Math.max(0, balance - principalPart));
    return { number: index + 1, principal: principalPart, interest, payment: actualPayment, balance };
  });
}
