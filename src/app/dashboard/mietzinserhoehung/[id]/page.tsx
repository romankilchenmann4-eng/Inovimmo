import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { BerechnungForm } from '@/components/mietzinserhoehung/BerechnungForm';
import { loescheErhoehung } from '@/lib/mietzinserhoehung/actions';
import type { MietzinsErhoehung, PositionMitWohnung } from '@/lib/mietzinserhoehung/types';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MietzinsErhoehungDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: erhoehung, error: erhoehungError } = await supabase
    .from('mietzins_erhoehungen')
    .select('*, liegenschaften(id, name, strasse, hausnummer, plz, ort)')
    .eq('id', id)
    .maybeSingle();

  if (erhoehungError) {
    return <ErrorBox title="Fehler" error={erhoehungError} />;
  }

  if (!erhoehung) {
    return <div className="p-6">Mietzinserhöhung nicht gefunden.</div>;
  }

  const { data: positionen, error: positionenError } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('mietzins_erhoehung_id', id);

  if (positionenError) {
    return <ErrorBox title="Fehler Positionen" error={positionenError} />;
  }

  const wohnungIds = (positionen ?? []).map((p: any) => p.wohnung_id).filter(Boolean);

  const { data: wohnungen } = wohnungIds.length
    ? await supabase.from('wohnungen').select('*').in('id', wohnungIds)
    : { data: [] };

  const { data: mietverhaeltnisse } = wohnungIds.length
    ? await supabase
        .from('mietverhaeltnisse')
        .select('wohnung_id, ist_vertragspartner, mieter:mieter_id(id, vorname, nachname)')
        .in('wohnung_id', wohnungIds)
        .is('mietende', null)
    : { data: [] };

  // Baue erweiterte Positionen mit Wohnungs- und Mieter-Daten
  const wohnungMap = new Map<string, any>(
    (wohnungen ?? []).map((w: any) => [w.id, w])
  );

  const mieterByWohnung = new Map<string, any[]>();
  for (const mv of (mietverhaeltnisse ?? []) as any[]) {
    const list = mieterByWohnung.get(mv.wohnung_id) ?? [];
    list.push(mv);
    mieterByWohnung.set(mv.wohnung_id, list);
  }

  const positionenMitWohnung: PositionMitWohnung[] = (positionen ?? []).map((p: any) => {
    const w = wohnungMap.get(p.wohnung_id);
    const mieter = (mieterByWohnung.get(p.wohnung_id) ?? []) as any[];
    return {
      ...p,
      wohnung: {
        id: w?.id ?? p.wohnung_id,
        bezeichnung: w?.bezeichnung ?? '',
        whg_nr: w?.whg_nr ?? null,
        wohnungstyp: w?.wohnungstyp ?? '',
        nettomiete: Number(w?.nettomiete ?? 0),
        nebenkosten_akonto: Number(w?.nebenkosten_akonto ?? 0),
        flaeche_m2: w?.flaeche_m2 ?? null,
      },
      mieter_namen: mieter.map((mv: any) => `${mv.mieter?.vorname ?? ''} ${mv.mieter?.nachname ?? ''}`.trim()).filter(Boolean),
    };
  });

  const erhoehungWithLiegenschaft = {
    ...erhoehung,
    liegenschaft: erhoehung.liegenschaften,
  };

  return (
    <div className="space-y-6">
      <BerechnungForm
        erhoehung={erhoehungWithLiegenschaft as any}
        positionen={positionenMitWohnung}
      />

      {/* Export & Delete */}
      <div className="flex gap-3">
        {positionenMitWohnung.length > 0 && mieterByWohnung.size > 0 && (
          <>
            <Link
              href={`/dashboard/mietzinserhoehung/${id}/export/csv`}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              CSV exportieren
            </Link>
          </>
        )}
      </div>

      <form action={async () => { 'use server'; await loescheErhoehung(id); }} className="pt-4">
        <button
          type="submit"
          className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
        >
          Mietzinserhöhung löschen
        </button>
      </form>
    </div>
  );
}

function ErrorBox({ title, error }: { title: string; error: any }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-6 text-sm text-red-700">
      <div className="font-semibold">{title}</div>
      <div>Message: {error.message}</div>
      <div>Code: {error.code}</div>
    </div>
  );
}