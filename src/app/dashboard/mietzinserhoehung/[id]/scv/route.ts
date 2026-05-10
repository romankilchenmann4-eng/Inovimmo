import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: positionen, error } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('mietzins_erhoehung_id', id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  const wohnungIds = (positionen ?? [])
    .map((p) => p.wohnung_id)
    .filter(Boolean);

  const { data: wohnungen } = wohnungIds.length
    ? await supabase
        .from('wohnungen')
        .select('*')
        .in('id', wohnungIds)
    : { data: [] };

  const wohnungMap = new Map(
    (wohnungen ?? []).map((w: any) => [w.id, w])
  );

  const header = [
    'Wohnung',
    'Alte Nettomiete',
    'Erhoehung monatlich',
    'Neue Nettomiete',
    'Nebenkosten',
    'Neue Bruttomiete',
    'Verteilschluessel Prozent',
    'Investitionsanteil',
  ];

  const rows = (positionen ?? []).map((p: any) => {
    const w: any = wohnungMap.get(p.wohnung_id);
    const wohnung = [w?.whg_nr, w?.bezeichnung].filter(Boolean).join(' - ') || p.wohnung_id;

    const alteMiete = Number(p.miete_alt || 0);
    const erh = Number(p.erhoehung_monatlich || p.erhoehung_betrag || 0);
    const neueMiete = Number(p.miete_neu || 0);
    const nk = Number(p.nebenkosten_neu || p.nebenkosten_alt || 0);
    const bruttoNeu = neueMiete + nk;

    return [
      wohnung,
      alteMiete,
      erh,
      neueMiete,
      nk,
      bruttoNeu,
      Number(p.verteilschluessel_prozent || 0),
      Number(p.investitionsanteil || 0),
    ];
  });

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(';')
    )
    .join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mietzinserhoehung-${id}.csv"`,
    },
  });
}
