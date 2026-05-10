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
    console.error(error);
    throw new Error(error.message);
  }

  return;
}

// ============================================================
// NEU BERECHNEN (Placeholder / Calc Hook)
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

  const { error: updateError } = await supabase
    .from('mietzins_erhoehungen')
    .update({
      netto_investition: data.investition_total || 0,
      jahressatz_total: 0,
      status: 'berechnet',
    })
    .eq('id', id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return;
}

// ============================================================
// POSITION: BEHEIZT SETZEN (FIXED TYPE ISSUE)
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
    console.error(error);
    throw new Error(error.message);
  }

  return;
}

// ============================================================
// LÖSCHEN
// ============================================================
export async function loescheErhoehung(id: string): Promise<void> {
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
