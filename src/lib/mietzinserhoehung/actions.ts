'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ============================================================
// ERSTELLEN
// ============================================================
export async function erstelleErhoehung(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const liegenschaft_id = formData.get('liegenschaft_id');
  const grund = formData.get('grund');
  const titel = formData.get('titel');
  const inkrafttreten = formData.get('inkrafttreten');
  const eigentuemer_name = formData.get('eigentuemer_name');
  const eigentuemer_adresse = formData.get('eigentuemer_adresse');
  const eigentuemer_ort = formData.get('eigentuemer_ort');

  if (typeof liegenschaft_id !== 'string' || !liegenschaft_id) {
    throw new Error('Liegenschaft fehlt');
  }

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .insert({
      liegenschaft_id,
      verwalter_id: user.id,
      titel: typeof titel === 'string' && titel ? titel : 'Mietzinserhöhung',
      grund: typeof grund === 'string' && grund ? grund : 'renovation',
      status: 'entwurf',
      investition_total: 0,
      foerderbeitraege: 0,
      sonstige_kosten: 0,
      sonstige_abzuege: 0,
      wertvermehrend_prozent: 70,
      kapitalisierungssatz: 8,
      inkrafttreten: typeof inkrafttreten === 'string' && inkrafttreten ? inkrafttreten : null,
      eigentuemer_name: typeof eigentuemer_name === 'string' && eigentuemer_name ? eigentuemer_name : null,
      eigentuemer_adresse: typeof eigentuemer_adresse === 'string' && eigentuemer_adresse ? eigentuemer_adresse : null,
      eigentuemer_ort: typeof eigentuemer_ort === 'string' && eigentuemer_ort ? eigentuemer_ort : null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { data: wohnungen, error: wohnungenError } = await supabase
    .from('wohnungen')
    .select(
      'id, nettomiete, nebenkosten_akonto, beheizt, verteilschluessel_prozent, flaeche_m2'
    )
    .eq('liegenschaft_id', liegenschaft_id);

  if (wohnungenError) {
    throw new Error(wohnungenError.message);
  }

  if (wohnungen && wohnungen.length > 0) {
    const positionen = wohnungen.map((w) => ({
      mietzins_erhoehung_id: data.id,
      wohnung_id: w.id,
      miete_alt: Number(w.nettomiete || 0),
      nebenkosten_alt: Number(w.nebenkosten_akonto || 0),
      verteilschluessel_prozent: Number(w.verteilschluessel_prozent || 0),
      flaeche_m2: Number(w.flaeche_m2 || 0),
      beheizt: Boolean(w.beheizt),
      erhoehung_betrag: 0,
      erhoehung_monatlich: 0,
      miete_neu: Number(w.nettomiete || 0),
      nebenkosten_neu: Number(w.nebenkosten_akonto || 0),
      investitionsanteil: 0,
      begruendung: '',
      berechnet_am: null,
    }));

    const { error: positionenError } = await supabase
      .from('mietzins_erhoehung_positionen')
      .insert(positionen);

    if (positionenError) {
      throw new Error(positionenError.message);
    }
  }

  redirect(`/dashboard/mietzinserhoehung/${data.id}`);
}

// ============================================================
// AKTUALISIEREN
// ============================================================
export async function aktualisiereErhoehung(
  id: string,
  updates: Record<string, any>
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('mietzins_erhoehungen')
    .update(updates)
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================================
// SPEICHERN UND NEU BERECHNEN
// Verteilschlüssel wird innerhalb dieser Mietzinserhöhung normalisiert.
// Beispiel: Wenn Summe = 200, wird jede Position anteilig durch 200 geteilt.
// Dadurch wird die Investition korrekt auf die ausgewählten Wohnungen verteilt.
// ============================================================
export async function speichereUndBerechneErhoehung(
  id: string,
  formData: FormData
): Promise<void> {
  const investitionTotal = Number(formData.get('investition_total') || 0);
  const foerderbeitraege = Number(formData.get('foerderbeitraege') || 0);
  const sonstigeKosten = Number(formData.get('sonstige_kosten') || 0);
  const sonstigeAbzuege = Number(formData.get('sonstige_abzuege') || 0);
  const wertvermehrendProzent = Number(
    formData.get('wertvermehrend_prozent') || 70
  );
  const kapitalisierungssatz = Number(
    formData.get('kapitalisierungssatz') || 8
  );

  const titel = formData.get('titel');
  const grund = formData.get('grund');
  const status = formData.get('status');

  const anrechenbareInvestition =
    investitionTotal - foerderbeitraege - sonstigeAbzuege + sonstigeKosten;

  const nettoInvestition =
    anrechenbareInvestition * (wertvermehrendProzent / 100);

  const jahressatzTotal =
    nettoInvestition * (kapitalisierungssatz / 100);

  const monatTotal = jahressatzTotal / 12;

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from('mietzins_erhoehungen')
    .update({
      titel: typeof titel === 'string' && titel ? titel : 'Mietzinserhöhung',
      grund: typeof grund === 'string' && grund ? grund : 'renovation',
      status: typeof status === 'string' && status ? status : 'berechnet',
      investition_total: investitionTotal,
      foerderbeitraege,
      sonstige_kosten: sonstigeKosten,
      sonstige_abzuege: sonstigeAbzuege,
      wertvermehrend_prozent: wertvermehrendProzent,
      kapitalisierungssatz,
    })
    .eq('id', id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { data: positionen, error: posError } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('mietzins_erhoehung_id', id);

  if (posError) {
    throw new Error(posError.message);
  }

  const summeVerteilschluessel = (positionen ?? []).reduce(
    (sum: number, p: any) => sum + Number(p.verteilschluessel_prozent || 0),
    0
  );

  for (const p of positionen ?? []) {
    const anteil =
      summeVerteilschluessel > 0
        ? Number(p.verteilschluessel_prozent || 0) / summeVerteilschluessel
        : 0;

    const erhoehungMonatlich = monatTotal * anteil;
    const alteMiete = Number(p.miete_alt || 0);
    const neueMiete = alteMiete + erhoehungMonatlich;
    const investitionsanteil = nettoInvestition * anteil;

    const { error } = await supabase
      .from('mietzins_erhoehung_positionen')
      .update({
        investitionsanteil,
        erhoehung_betrag: erhoehungMonatlich,
        erhoehung_monatlich: erhoehungMonatlich,
        miete_neu: neueMiete,
        begruendung:
          'Berechnung auf Basis der wertvermehrenden Investition und des normalisierten Verteilschlüssels.',
        berechnet_am: new Date().toISOString(),
      })
      .eq('id', p.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

// ============================================================
// NEU BERECHNEN
// ============================================================
export async function neuBerechnen(id: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Berechnung nicht gefunden');
  }

  const formData = new FormData();

  formData.set('titel', data.titel ?? 'Mietzinserhöhung');
  formData.set('grund', data.grund ?? 'renovation');
  formData.set('status', 'berechnet');
  formData.set('investition_total', String(data.investition_total ?? 0));
  formData.set('foerderbeitraege', String(data.foerderbeitraege ?? 0));
  formData.set('sonstige_kosten', String(data.sonstige_kosten ?? 0));
  formData.set('sonstige_abzuege', String(data.sonstige_abzuege ?? 0));
  formData.set(
    'wertvermehrend_prozent',
    String(data.wertvermehrend_prozent ?? 70)
  );
  formData.set(
    'kapitalisierungssatz',
    String(data.kapitalisierungssatz ?? 8)
  );

  await speichereUndBerechneErhoehung(id, formData);
}

// ============================================================
// POSITION: BEHEIZT SETZEN
// ============================================================
export async function setzeBeheizt(
  positionId: string,
  erhoehungId: string,
  beheizt: boolean
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('mietzins_erhoehung_positionen')
    .update({ beheizt })
    .eq('id', positionId)
    .eq('mietzins_erhoehung_id', erhoehungId);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================================
// LÖSCHEN
// ============================================================
export async function loescheErhoehung(id: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('mietzins_erhoehung_positionen')
    .delete()
    .eq('mietzins_erhoehung_id', id);

  const { error } = await supabase
    .from('mietzins_erhoehungen')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  redirect('/dashboard/mietzinserhoehung');
}
