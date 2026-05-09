'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { MietzinsErhoehung } from './types';
import { berechneErhoehung, generiereBegruendungstext } from './calc';

// ============================================================
// Erhöhung erstellen
// ============================================================
export async function erstelleErhoehung(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const liegenschaft_id = formData.get('liegenschaft_id') as string;
  const titel = (formData.get('titel') as string) || 'Neue Berechnung';
  const grund = (formData.get('grund') as string) || 'heizung_ersatz';

  if (!liegenschaft_id) {
    throw new Error('Liegenschaft muss ausgewählt werden');
  }

  // 1. Erhöhung anlegen
  const { data: erhoehung, error } = await supabase
    .from('mietzins_erhoehungen')
    .insert({
      liegenschaft_id,
      verwalter_id: user.id,
      titel,
      grund,
      status: 'entwurf',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 2. Wohnungen holen
  const { data: wohnungen } = await supabase
    .from('wohnungen')
    .select('id, beheizt')
    .eq('liegenschaft_id', liegenschaft_id);

  // 3. Positionen erstellen
  if (wohnungen && wohnungen.length > 0) {
    const positionen = wohnungen.map(w => ({
      mietzins_erhoehung_id: erhoehung.id,
      wohnung_id: w.id,
      beheizt: w.beheizt,
    }));

    const { error: posError } = await supabase
      .from('mietzins_erhoehung_positionen')
      .insert(positionen);

    if (posError) {
      console.error('Fehler Positionen:', posError);
    }
  }

  revalidatePath('/dashboard/mietzinserhoehung');
  redirect(`/dashboard/mietzinserhoehung/${erhoehung.id}`);
}

// ============================================================
// Erhöhung aktualisieren
// ============================================================
export async function aktualisiereErhoehung(
  id: string,
  patch: Partial<MietzinsErhoehung>,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht eingeloggt');

  const { error } = await supabase
    .from('mietzins_erhoehungen')
    .update(patch)
    .eq('id', id)
    .eq('verwalter_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/mietzinserhoehung/${id}`);
}

// ============================================================
// Neu berechnen
// ============================================================
export async function neuBerechnen(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht eingeloggt');

  // Erhöhung laden
  const { data: erhoehung, error } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .eq('verwalter_id', user.id)
    .single();

  if (error || !erhoehung) {
    throw new Error('Berechnung nicht gefunden');
  }

  // Positionen + Nettomieten laden
  const { data: positionen } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select(`
      id,
      wohnung_id,
      beheizt,
      wohnung:wohnung_id ( nettomiete )
    `)
    .eq('mietzins_erhoehung_id', id);

  if (!positionen || positionen.length === 0) {
    throw new Error('Keine Positionen vorhanden');
  }

  // 👉 WICHTIG: Mapping auf calc.ts Struktur
  const ergebnis = berechneErhoehung({
    investition_total: erhoehung.investition_total ?? 0,
    foerderbeitraege: erhoehung.foerderbeitraege ?? 0,
    wertvermehrend_prozent: erhoehung.wertvermehrend_prozent ?? 0,
    referenzzinssatz: erhoehung.referenzzinssatz ?? 0,
    zuschlag: erhoehung.zuschlag ?? 0,
    amortisation_prozent: erhoehung.amortisation_prozent ?? 0,
    unterhalt_prozent: erhoehung.unterhalt_prozent ?? 0,
    positionen: positionen.map(p => ({
  wohnung_id: p.wohnung_id,
 nettomiete: Number(p.wohnung?.[0]?.nettomiete ?? 0),
beheizt: Boolean(p.beheizt ?? false),
    })),
  });

  // Positionen speichern
  for (let i = 0; i < positionen.length; i++) {
    const pos = positionen[i];
    const erg = ergebnis.positionen[i];

    await supabase
      .from('mietzins_erhoehung_positionen')
      .update({
        anteil_prozent: erg.anteil_prozent,
        monatliche_erhoehung: erg.monatliche_erhoehung,
        neuer_nettomietzins: erg.neuer_mietzins, // 👈 wichtig
      })
      .eq('id', pos.id);
  }

  // Begründung speichern
  await supabase
    .from('mietzins_erhoehungen')
    .update({
      begruendung_text: generiereBegruendungstext(erhoehung, ergebnis),
      status: 'berechnet',
    })
    .eq('id', id);

  revalidatePath(`/dashboard/mietzinserhoehung/${id}`);

  return ergebnis;
}

// ============================================================
// Beheizt setzen
// ============================================================
export async function setzeBeheizt(
  position_id: string,
  erhoehung_id: string,
  beheizt: boolean,
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('mietzins_erhoehung_positionen')
    .update({ beheizt })
    .eq('id', position_id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/mietzinserhoehung/${erhoehung_id}`);
}

// ============================================================
// Löschen
// ============================================================
export async function loescheErhoehung(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht eingeloggt');

  const { error } = await supabase
    .from('mietzins_erhoehungen')
    .delete()
    .eq('id', id)
    .eq('verwalter_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/mietzinserhoehung');
  redirect('/dashboard/mietzinserhoehung');
}
