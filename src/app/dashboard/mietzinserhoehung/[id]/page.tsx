import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { BerechnungForm } from '@/components/mietzinserhoehung/BerechnungForm';

export default async function CalculationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: calculation } = await supabase
    .from('rent_increase_calculations')
    .select('*')
    .eq('id', id)
    .single();
  
  if (!calculation) notFound();

  const { data: allocations } = await supabase
    .from('rent_increase_allocations')
    .select('*')
    .eq('calculation_id', id)
    .order('unit_label');

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <BerechnungForm 
        calculation={calculation} 
        allocations={allocations ?? []} 
      />
    </div>
  );
}
