import type { 
  CalculationResult, 
  AllocationResult,
  RentIncreaseCalculation,
  RentIncreaseAllocation,
} from './types';

export interface CalcInput {
  investment_total: number;
  subsidies: number;
  value_added_pct: number;
  reference_rate: number;
  surcharge: number;
  amortization_pct: number;
  maintenance_pct: number;
  allocations: Array<{
    unit_label: string;
    tenant_name: string | null;
    current_rent: number;
    is_heated: boolean;
  }>;
}

/**
 * Berechnet die Mietzinserhöhung gemäss Art. 269a OR / Art. 14 VMWG.
 * Reine Funktion – keine Seiteneffekte.
 */
export function calculateRentIncrease(input: CalcInput): CalculationResult {
  const netInvestment = Math.max(0, input.investment_total - input.subsidies);
  const valueAddedAmount = netInvestment * (input.value_added_pct / 100);
  const totalRatePct = 
    input.reference_rate + 
    input.surcharge + 
    input.amortization_pct + 
    input.maintenance_pct;
  const yearlyIncrease = valueAddedAmount * (totalRatePct / 100);
  const monthlyIncrease = yearlyIncrease / 12;

  // Verteilschlüssel: nach aktuellem Nettomietzins der beheizten Objekte
  const heatedUnits = input.allocations.filter(a => a.is_heated);
  const totalHeatedRent = heatedUnits.reduce((s, a) => s + a.current_rent, 0);

  const allocations: AllocationResult[] = input.allocations.map(a => {
    const share_pct = a.is_heated && totalHeatedRent > 0
      ? (a.current_rent / totalHeatedRent) * 100
      : 0;
    const increase = (share_pct / 100) * monthlyIncrease;
    return {
      unit_label: a.unit_label,
      tenant_name: a.tenant_name,
      current_rent: a.current_rent,
      is_heated: a.is_heated,
      share_pct: round(share_pct, 4),
      monthly_increase: round(increase, 2),
      new_rent: round(a.current_rent + increase, 2),
    };
  });

  return {
    netInvestment: round(netInvestment, 2),
    valueAddedAmount: round(valueAddedAmount, 2),
    totalRatePct: round(totalRatePct, 2),
    yearlyIncrease: round(yearlyIncrease, 2),
    monthlyIncrease: round(monthlyIncrease, 2),
    allocations,
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Generiert den Begründungstext für das amtliche Formular.
 */
export function generateJustificationText(
  calc: RentIncreaseCalculation,
  result: CalculationResult,
): string {
  const reasonLabel = {
    heating_replacement: 'Ersatz der bestehenden Heizung',
    renovation: 'Renovation',
    other_value_added: 'Wertvermehrende Investition',
  }[calc.reason];

  return [
    'Wertvermehrende Investition gemäss Art. 269a lit. b OR i.V.m. Art. 14 VMWG:',
    '',
    `${reasonLabel} – ${calc.title}`,
    '',
    `- Total Investitionskosten: CHF ${fmt(calc.investment_total)}`,
    `- Abzüglich Förderbeiträge: CHF ${fmt(calc.subsidies)}`,
    `- Nettoinvestition: CHF ${fmt(result.netInvestment)}`,
    `- Wertvermehrender Anteil: ${calc.value_added_pct}% = CHF ${fmt(result.valueAddedAmount)}`,
    `- Jahressatz total (Verzinsung ${calc.reference_rate + calc.surcharge}% + Amortisation ${calc.amortization_pct}% + Unterhalt ${calc.maintenance_pct}%): ${result.totalRatePct}%`,
    `- Jährliche Mehrbelastung total: CHF ${fmt(result.yearlyIncrease)}`,
    `- Monatliche Mehrbelastung total: CHF ${fmt(result.monthlyIncrease)}`,
    '- Verteilung auf Mietobjekte nach Anteil Nettomietzins',
  ].join('\n');
}

function fmt(n: number): string {
  return n.toLocaleString('de-CH', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2,
  });
}
