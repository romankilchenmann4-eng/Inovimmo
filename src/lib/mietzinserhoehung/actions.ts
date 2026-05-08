'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { 
  RentIncreaseCalculation, 
  RentIncreaseAllocation,
} from './types';
import { calculateRentIncrease, generateJustificationText } from './calc';

export async function createCalculation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase
    .from('rent_increase_calculations')
    .insert({
      title: formData.get('title') as string,
      reason: formData.get('reason') as string,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/mietzinserhoehung');
  redirect(`/dashboard/mietzinserhoehung/${data.id}`);
}

export async function updateCalculation(
  id: string, 
  patch: Partial<RentIncreaseCalculation>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('rent_increase_calculations')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/mietzinserhoehung/${id}`);
}

export async function recalculateAndSave(id: string) {
  const supabase = await createClient();
  
  const { data: calc } = await supabase
    .from('rent_increase_calculations')
    .select('*')
    .eq('id', id)
    .single();
  if (!calc) throw new Error('Berechnung nicht gefunden');

  const { data: allocs } = await supabase
    .from('rent_increase_allocations')
    .select('*')
    .eq('calculation_id', id);

  const result = calculateRentIncrease({
    investment_total: calc.investment_total,
    subsidies: calc.subsidies,
    value_added_pct: calc.value_added_pct,
    reference_rate: calc.reference_rate,
    surcharge: calc.surcharge,
    amortization_pct: calc.amortization_pct,
    maintenance_pct: calc.maintenance_pct,
    allocations: (allocs ?? []).map(a => ({
      unit_label: a.unit_label,
      tenant_name: a.tenant_name,
      current_rent: a.current_rent,
      is_heated: a.is_heated,
    })),
  });

  // Allocations updaten
  for (let i = 0; i < (allocs ?? []).length; i++) {
    const a = allocs![i];
    const r = result.allocations[i];
    await supabase
      .from('rent_increase_allocations')
      .update({
        share_pct: r.share_pct,
        monthly_increase: r.monthly_increase,
        new_rent: r.new_rent,
      })
      .eq('id', a.id);
  }

  // Begründungstext speichern
  await supabase
    .from('rent_increase_calculations')
    .update({
      justification_text: generateJustificationText(calc, result),
      status: 'calculated',
    })
    .eq('id', id);

  revalidatePath(`/dashboard/mietzinserhoehung/${id}`);
  return result;
}

export async function addAllocation(
  calculation_id: string,
  data: Omit<RentIncreaseAllocation, 'id' | 'calculation_id' 
    | 'share_pct' | 'monthly_increase' | 'new_rent' 
    | 'notification_sent_at' | 'notification_method' | 'acknowledged_at'>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('rent_increase_allocations')
    .insert({ calculation_id, ...data });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/mietzinserhoehung/${calculation_id}`);
}

export async function deleteAllocation(id: string, calculation_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('rent_increase_allocations')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/mietzinserhoehung/${calculation_id}`);
}
