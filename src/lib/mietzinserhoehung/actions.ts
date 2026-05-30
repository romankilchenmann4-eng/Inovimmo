'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdminOrVerwalter } from '@/lib/supabase/admin';
import { ALLOWED_ERHOEHUNG_FIELDS } from '@/lib/constants';
import { berechneErhoehung } from './calc';
import { getNeuesterReferenzzinssatz, getNeuesterLikIndex } from './data';
import { redirect } from 'next/navigation';
import type { BerechnungsInput } from './types';

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

  await requireAdminOrVerwalter(supabase, user.id);

  const liegenschaft_id = formData.get('liegenschaft_id');
  const grund = formData.get('grund');
  const titel = formData.get('titel');
  const inkrafttreten = formData.get('inkrafttreten');

  if (typeof liegenschaft_id !== 'string' || !liegenschaft_id) {
    throw new Error('Liegenschaft fehlt');
  }

  // Aktuelle Werte als Default
  const aktuellerReferenzzinssatz = getNeuesterReferenzzinssatz();
  const aktuellerLikIndex = getNeuesterLikIndex();

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .insert({
      liegenschaft_id,
      verwalter_id: user.id,
      titel: typeof titel === 'string' && titel ? titel : 'Mietzinserhöhung',
      grund: typeof grund === 'string' && grund ? grund : 'referenzzinssatz',
      status: 'entwurf',
      // Block 1: Referenzzinssatz
      referenzzinssatz_alt: 0,
      referenzzinssatz_neu: aktuellerReferenzzinssatz,
      // Block 2: Teuerung
      lik_index_alt: 0,
      lik_index_neu: aktuellerLikIndex,
      // Block 3: Kostensteigerung
      kostensteigerung_pauschale: 0,
      kostensteigerung_pro_jahr: 0,
      // Block 4: Investitionen
      investition_total: 0,
      foerderbeitraege: 0,
      wertvermehrend_prozent: 100,
      ersatzbeschaffung_1zu1: 0,
      amortisation_prozent: 0,
      unterhalt_prozent: 0,
      nebenkosten_aenderung_monatlich: 0,
      inkrafttreten: typeof inkrafttreten === 'string' && inkrafttreten ? inkrafttreten : null,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht autorisiert");
  await requireAdminOrVerwalter(supabase, user.id);

  const filtered = Object.fromEntries(
    ALLOWED_ERHOEHUNG_FIELDS.filter(k => k in updates).map(k => [k, updates[k]])
  );
  const { error } = await supabase
    .from('mietzins_erhoehungen')
    .update(filtered)
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================================
// SPEICHERN UND NEU BERECHNEN (HEV-konform, 4 Blöcke)
// ============================================================
export async function speichereUndBerechneErhoehung(
  id: string,
  updates: Record<string, any>
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht autorisiert");
  await requireAdminOrVerwalter(supabase, user.id);

  // Aktuelle Erhöhung laden
  const { data: erhoehung, error: fetchError } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !erhoehung) {
    throw new Error('Berechnung nicht gefunden');
  }

  // Positionen laden
  const { data: positionen, error: posError } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('mietzins_erhoehung_id', id);

  if (posError) {
    throw new Error(posError.message);
  }

  // Werte mergen (Formular-Updates überschreiben gespeicherte Werte)
  const vals = { ...erhoehung, ...updates };

  // Berechnung durchführen (HEV 4-Block)
  const berechnungsInput: BerechnungsInput = {
    nettomiete_aktuell: Number(positionen?.reduce((s: number, p: any) => s + Number(p.miete_alt || 0), 0) || 0),
    nebenkosten_aktuell: Number(positionen?.reduce((s: number, p: any) => s + Number(p.nebenkosten_alt || 0), 0) || 0),
    // Block 1
    referenzzinssatz_alt: Number(vals.referenzzinssatz_alt || 0),
    referenzzinssatz_neu: Number(vals.referenzzinssatz_neu || 0),
    // Block 2
    lik_index_alt: Number(vals.lik_index_alt || 0),
    lik_index_neu: Number(vals.lik_index_neu || 0),
    // Block 3
    kostensteigerung_pauschale: Number(vals.kostensteigerung_pauschale || 0),
    kostensteigerung_jahre: Number(vals.kostensteigerung_pro_jahr || 0),
    // Block 4
    investition_total: Number(vals.investition_total || 0),
    foerderbeitraege: Number(vals.foerderbeitraege || 0),
    wertvermehrend_prozent: Number(vals.wertvermehrend_prozent || 100),
    ersatzbeschaffung_1zu1: Number(vals.ersatzbeschaffung_1zu1 || 0),
    amortisation_prozent: Number(vals.amortisation_prozent || 0),
    unterhalt_prozent: Number(vals.unterhalt_prozent || 0),
    // Positionen
    positionen: (positionen ?? []).map((p: any) => ({
      wohnung_id: p.wohnung_id,
      nettomiete: Number(p.miete_alt || 0),
      beheizt: Boolean(p.beheizt),
    })),
  };

  const ergebnis = berechneErhoehung(berechnungsInput);

  // Hauptdatensatz aktualisieren
  const { error: updateError } = await supabase
    .from('mietzins_erhoehungen')
    .update({
      titel: vals.titel ?? 'Mietzinserhöhung',
      grund: vals.grund ?? 'referenzzinssatz',
      status: 'berechnet',
      // Block 1
      referenzzinssatz_alt: vals.referenzzinssatz_alt,
      referenzzinssatz_neu: vals.referenzzinssatz_neu,
      referenzzinssatz_aenderung: ergebnis.referenzzinssatz_aenderung_pp,
      // Block 2
      lik_index_alt: vals.lik_index_alt,
      lik_index_neu: vals.lik_index_neu,
      teuerung_prozent: ergebnis.teuerung_prozent,
      teuerung_40_prozent: ergebnis.teuerung_40_prozent,
      // Block 3
      kostensteigerung_pauschale: vals.kostensteigerung_pauschale,
      kostensteigerung_pro_jahr: vals.kostensteigerung_pro_jahr,
      // Block 4
      investition_total: vals.investition_total,
      foerderbeitraege: vals.foerderbeitraege,
      wertvermehrend_prozent: vals.wertvermehrend_prozent,
      ersatzbeschaffung_1zu1: vals.ersatzbeschaffung_1zu1,
      amortisation_prozent: vals.amortisation_prozent,
      unterhalt_prozent: vals.unterhalt_prozent,
      nebenkosten_aenderung_monatlich: vals.nebenkosten_aenderung_monatlich ?? 0,
    })
    .eq('id', id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Positionen aktualisieren
  for (const pos of positionen ?? []) {
    const ergPos = ergebnis.positionen.find(p => p.wohnung_id === pos.wohnung_id);
    if (!ergPos) continue;

    const { error } = await supabase
      .from('mietzins_erhoehung_positionen')
      .update({
        erhoehung_betrag: ergPos.monatliche_erhoehung,
        erhoehung_monatlich: ergPos.monatliche_erhoehung,
        miete_neu: ergPos.neuer_nettomietzins,
        investitionsanteil: ergPos.anteil_prozent,
        begruendung: 'HEV-konforme Berechnung: Referenzzinssatz + Teuerung + Kostensteigerung + Investitionen',
        berechnet_am: new Date().toISOString(),
      })
      .eq('id', pos.id);

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht autorisiert");
  await requireAdminOrVerwalter(supabase, user.id);

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Berechnung nicht gefunden');
  }

  await speichereUndBerechneErhoehung(id, data);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht autorisiert");
  await requireAdminOrVerwalter(supabase, user.id);

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht autorisiert");
  await requireAdminOrVerwalter(supabase, user.id);

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