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

  if (typeof liegenschaft_id !== 'string' || !liegenschaft_id) {
    throw new Error('Liegenschaft fehlt');
  }

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .insert({
      liegenschaft_id,
      verwalter_id: user.id,
      titel:
        typeof titel === 'string' && titel
          ? titel
          : 'Mietzinserhöhung',
      grund:
        typeof grund === 'string' && grund
          ? grund
          : 'renovation',
      status: 'entwurf',
    })
    .select('id')
    .single();

  if (error) {
    console.error('ERSTELLE MIETZINSERHOEHUNG ERROR:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    throw new Error(error.message);
  }

  const { data: wohnungen, error: wohnungenError } = await supabase
    .from('wohnungen')
    .select(
      'id, nettomiete, nebenkosten_akonto, beheizt, verteilschluessel_prozent, flaeche_m2'
    )
    .eq('liegenschaft_id', liegenschaft_id);

  if (wohnungenError) {
    console.error('LADE WOHNUNGEN ERROR:', {
      message: wohnungenError.message,
      details: wohnungenError.details,
      hint: wohnungenError.hint,
      code: wohnungenError.code,
    });

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
      miete_neu: Number(w.nettomiete || 0),
    }));

    const { error: positionenError } = await supabase
      .from('mietzins_erhoehung_positionen')
      .insert(positionen);

    if (positionenError) {
      console.error('ERSTELLE POSITIONEN ERROR:', {
        message: positionenError.message,
        details: positionenError.details,
        hint: positionenError.hint,
        code: positionenError.code,
      });

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
    console.error(error);
    throw new Error(error.message);
  }

  return;
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

  const { error: updateError } = await supabase
    .from('mietzins_erhoehungen')
    .update({
      status: 'berechnet',
    })
    .eq('id', id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return;
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
