export type RentIncreaseReason = 
  | 'heating_replacement' 
  | 'renovation' 
  | 'other_value_added';

export type RentIncreaseStatus = 
  | 'draft' 
  | 'calculated' 
  | 'sent' 
  | 'challenged' 
  | 'active';

export interface RentIncreaseCalculation {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  property_id: string | null;
  title: string;
  reason: RentIncreaseReason;
  investment_total: number;
  subsidies: number;
  value_added_pct: number;
  reference_rate: number;
  surcharge: number;
  amortization_pct: number;
  maintenance_pct: number;
  status: RentIncreaseStatus;
  effective_date: string | null;
  justification_text: string | null;
}

export interface RentIncreaseAllocation {
  id: string;
  calculation_id: string;
  rental_unit_id: string | null;
  unit_label: string;
  tenant_name: string | null;
  current_rent: number;
  is_heated: boolean;
  share_pct: number | null;
  monthly_increase: number | null;
  new_rent: number | null;
  notification_sent_at: string | null;
  notification_method: string | null;
  acknowledged_at: string | null;
}

export interface CalculationResult {
  netInvestment: number;
  valueAddedAmount: number;
  totalRatePct: number;
  yearlyIncrease: number;
  monthlyIncrease: number;
  allocations: AllocationResult[];
}

export interface AllocationResult {
  unit_label: string;
  tenant_name: string | null;
  current_rent: number;
  is_heated: boolean;
  share_pct: number;
  monthly_increase: number;
  new_rent: number;
}
