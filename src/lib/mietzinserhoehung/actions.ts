'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ============================================================
// Mietzinserhöhung erstellen
// ============================================================
export async function erstelleErhoehung(formData: FormData) {
  const supabase = await createClient();

  // ------------------------------------------------------------
  // Auth check
  // ------------------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // ------------------------------------------------------------
  // Form Daten lesen
  // ------------------------------------------------------------
  const liegenschaft_id = formData.get('liegenschaft_id') as string;
  const grund = formData.get('grund') as string;
  const titel = formData.get('titel') as string;

  // ------------------------------------------------------------
  // Validierung (minimal aber wichtig)
  // ------------------------------------------------------------
  if (!liegenschaft_id) {
    throw new Error('Liegenschaft ist erforderlich');
  }

  if (!titel) {
    throw new Error('Titel ist erforderlich');
  }

  // ------------------------------------------------------------
  // Insert in DB
  // ------------------------------------------------------------
  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .insert({
      liegenschaft_id,
      verwalter_id: user.id,
      titel,
      grund: grund || 'renovation',
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
      inkrafttreten: null,
      begruendung_text: null,
    })
    .select()
    .single();

  // ------------------------------------------------------------
  // Error handling
  // ------------------------------------------------------------
  if (error) {
    console.error('Fehler beim Erstellen der Mietzinserhöhung:', error);
    throw new Error(error.message);
  }

  // ------------------------------------------------------------
  // Optional: Redirect zur Detailseite
  // ------------------------------------------------------------
  redirect(`/dashboard/mietzinserhoehung/${data.id}`);
}
