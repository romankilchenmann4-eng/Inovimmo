'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  MietzinsErhoehung,
} from './types';
import { berechneErhoehung, generiereBegruendungstext } from './calc';

// ============================================================
// Berechnung erstellen (mit Liegenschafts-Auswahl)
// ============================================================
export async function erstelleErhoehung(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const liegenschaft_id = formData.get('liegenschaft_id') as string;
  const titel = (formData.get('titel') as string) || 'Neue Berechnung';
  const grund = (formData.get('grund') as string) || 'heizungsersatz';

  if (!liegenschaft_id) {
    throw new Error('Liegenschaft muss ausgewählt werden');
  }

  // 1. Erhöhung anlegen
  const { data: erhoehung, error: errInsert } = await supabase
    .from('mietzins_erhoehungen')
    .insert({
      liegenschaft_id,
      verwalter_id: user.id,
      titel,
      grund,
    })
    .select()
    .single();

  if (errInsert) throw new Error(errInsert.message);

  // 2. Alle Wohnungen der Liegenschaft als Positionen anlegen
  const { data: wohnungen } = await supabase
    .from('wohnungen')
    .select('id, beheizt')
    .eq('liegenschaft_id', liegenschaft_id);

  if (wohnungen && wohnungen.length > 0) {
    const positionen = wohnungen.map(w => ({
      mietzins_erhoehung_id: erhoehung.id,
      wohnung_id: w.id,
      beheizt: w.beheizt,
    }));

    const { error: errPos } = await supabase
      .from('mietzins_erhoehung_positionen')
      .insert(positionen);

    if (errPos) {
      console.error('Fehler beim Anlegen der Positionen:', errPos);
    }
  }

  revalidatePath('/dashboard/mietzinserhoehung');
  redirect(`/dashboard/mietzinserhoehung/${erhoehung.id}`);
}

// ============================================================
// Berechnung aktualisieren
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
// Berechnen + speichern (alle Positionen aktualisieren)
// ============================================================
export async function neuBerechnen(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht eingeloggt');

  // Erhöhung laden
  const { data: erhoehung, error: errE } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .eq('verwalter_id', user.id)
    .single();

  if (errE || !erhoehung) throw new Error('Berechnung nicht gefunden');

  // Positionen mit aktueller Wohnungsmiete laden
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

  // Berechnung
  const ergebnis = berechneErhoehung({
    investition_total: erhoehung.investition_total,
    foerderbeitraege: erhoehung.foerderbeitraege,
    wertvermehrend_prozent: erhoehung.wertvermehrend_prozent,
    referenzzinssatz: erhoehung.referenzzinssatz,
    zuschlag: erhoehung.zuschlag,
    amortisation_prozent: erhoehung.amortisation_prozent,
    unterhalt_prozent: erhoehung.unterhalt_prozent,
    positionen: positionen.map(p => ({
      wohnung_id: p.wohnung_id,
      // @ts-expect-error - Supabase JOIN returns nested object
      nettomiete: Number(p.wohnung?.nettomiete ?? 0),
      beheizt: p.beheizt,
    })),
  });

  // Positionen aktualisieren
  for (let i = 0; i < positionen.length; i++) {
    const pos = positionen[i];
    const erg = ergebnis.positionen[i];
    await supabase
      .from('mietzins_erhoehung_positionen')
      .update({
        anteil_prozent: erg.anteil_prozent,
        monatliche_erhoehung: erg.monatliche_erhoehung,
        neuer_nettomietzins: erg.neuer_nettomietzins,
      })
      .eq('id', pos.id);
  }

  // Status + Begründungstext
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
// Beheizt-Flag pro Position umschalten
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
// Erhöhung löschen
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
