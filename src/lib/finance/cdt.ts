export function cdtReturn(principal: number, annualRate: number, start: Date, maturity: Date) {
  if (principal <= 0) throw new Error("El capital debe ser mayor que cero");
  if (annualRate < 0) throw new Error("La tasa no puede ser negativa");
  const days = Math.ceil((maturity.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) throw new Error("La fecha de vencimiento no puede ser anterior a la apertura");
  const grossReturn = principal * (Math.pow(1 + annualRate / 100, days / 365) - 1);
  return { days, grossReturn, maturityValue: principal + grossReturn };
}
