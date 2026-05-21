import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

type RouteProps = {
  params: Promise<{
    id: string;
    positionId: string;
  }>;
};

// Backward-compatible redirect: finds first vertragspartner mieter for this position
export async function GET(_request: Request, { params }: RouteProps) {
  const { id, positionId } = await params;
  const supabase = await createClient();

  const { data: position } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('wohnung_id')
    .eq('id', positionId)
    .maybeSingle();

  if (!position) {
    return new NextResponse('Position nicht gefunden', { status: 404 });
  }

  const { data: firstMv } = await supabase
    .from('mietverhaeltnisse')
    .select('mieter:mieter_id(id)')
    .eq('wohnung_id', position.wohnung_id)
    .is('mietende', null)
    .eq('ist_vertragspartner', true)
    .limit(1)
    .maybeSingle();

  const mieterId = (firstMv as any)?.mieter?.id ?? (firstMv as any)?.mieter_id;

  if (mieterId) {
    redirect(`/dashboard/mietzinserhoehung/${id}/export/formular/${positionId}/${mieterId}`);
  }

  return new NextResponse('Kein Mieter gefunden', { status: 404 });
}