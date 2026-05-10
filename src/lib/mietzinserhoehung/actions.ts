'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ============================================================
// 1. ERSTELLEN
// ============================================================
export async function erstelleErhoehung(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const liegenschaft_id = formData.get('liegenschaft_id');
  const grund = formData.get('grund');
  const titel = formData.get('titel');

  if (typeof liegenschaft_id !== 'string' || !liegenschaft_id) {
    throw new Error('Liegenschaft fehlt');
  }

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .insert({
      liegenschaft_id,
      verwalter_id: user.id,
      titel: typeof titel === 'string' ? titel : 'Mietzinserhöhung',
      grund: typeof grund === 'string' ? grund : 'renovation',
      investition_total: 0,
      foerderbeitraege: 0,
      wertvermehrend_prozent: 0,
      referenzzinssatz: 0,
      zuschlag: 0,
      amortisation_prozent: 0,
      unterhalt_prozent: 0,
      netto_investition: 0,
      jahressatz_total: 0,
      status: 'entwurf',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Kein Datensatz erstellt');
  }

  redirect(`/dashboard/mietzinserhoehung/${data.id}`);
}

// ============================================================
// 2. AKTUALISIEREN
// ============================================================
export async function aktualisiereErhoehung(id: string, updates: any) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('mietzins_erhoehungen')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  return true;
}

// ============================================================
// 3. NEU BERECHNEN (placeholder für Calc Integration)
// ============================================================
export async function neuBerechnen(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new Error('Berechnung nicht gefunden');
  }

  // Platzhalter (deine calc.ts kann hier später rein)
  const neueWerte = {
    netto_investition: data.investition_total || 0,
    jahressatz_total: 0,
    status: 'berechnet',
  };

  const { error: updateError } = await supabase
    .from('mietzins_erhoehungen')
    .update(neueWerte)
    .eq('id', id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return true;
}

// ============================================================
// 4. SETZE BEHEIZT (Position Update Placeholder)
// ============================================================
export async function setzeBeheizt(positionId: string, beheizt: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('mietzins_erhoehung_positionen')
    .update({ beheizt })
    .eq('id', positionId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

// ============================================================
// 5. LÖSCHEN
// ============================================================
export async function loescheErhoehung(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('mietzins_erhoehungen')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  redirect('/dashboard/mietzinserhoehung');
}
