import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { BerechnungForm } from '@/components/mietzinserhoehung/BerechnungForm';

export default async function ErhoehungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Erhöhung laden mit Liegenschaft
  const { data: erhoehung } = await supabase
    .from('mietzins_erhoehungen')
    .select(`
      *,
      liegenschaft:liegenschaft_id (
        id, name, strasse, hausnummer, plz, ort
      )
    `)
    .eq('id', id)
    .eq('verwalter_id', user.id)
    .single();

  if (!erhoehung) notFound();

  // Positionen mit Wohnungs-Daten und Mieter-Namen laden
  const { data: positionenRaw } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select(`
      *,
      wohnung:wohnung_id (
        id, bezeichnung, whg_nr, wohnungstyp,
        nettomiete, nebenkosten_akonto, flaeche_m2
      )
    `)
    .eq('mietzins_erhoehung_id', id);

  // Mieter pro Wohnung holen (für Anzeige in der Tabelle)
  const wohnung_ids = (positionenRaw ?? [])
    .map(p => p.wohnung_id);
  
  const { data: mietverhaeltnisse } = wohnung_ids.length > 0
    ? await supabase
        .from('mietverhaeltnisse')
        .select(`
          wohnung_id,
          ist_hauptperson,
          mieter:mieter_id ( vorname, nachname )
        `)
        .in('wohnung_id', wohnung_ids)
    : { data: [] };

  // Mieter pro Wohnung gruppieren
  const mieterMap: Record<string, string[]> = {};
  (mietverhaeltnisse ?? []).forEach((mv: any) => {
    if (!mv.mieter) return;
    const name = [mv.mieter.vorname, mv.mieter.nachname].filter(Boolean).join(' ');
    if (!mieterMap[mv.wohnung_id]) mieterMap[mv.wohnung_id] = [];
    if (mv.ist_hauptperson) {
      mieterMap[mv.wohnung_id].unshift(name);
    } else {
      mieterMap[mv.wohnung_id].push(name);
    }
  });

  // Positionen mit Mieter-Namen anreichern
  const positionen = (positionenRaw ?? []).map(p => ({
    ...p,
    mieter_namen: mieterMap[p.wohnung_id] ?? [],
  }));

  return (
    <div className="max-w-7xl mx-auto">
      <BerechnungForm
        erhoehung={erhoehung}
        positionen={positionen as any}
      />
    </div>
  );
}
