'use server';

import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

function getSupabaseAdmin() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL fehlt');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt – bitte in Vercel unter Settings → Environment Variables eintragen');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function adminCreateUser(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim();
  const full_name = String(formData.get('full_name') || '').trim();
  const role = String(formData.get('role') || 'mieter').trim();
  const password = String(formData.get('password') || '').trim();

  const liegenschaftIds = formData
    .getAll('liegenschaft_ids')
    .map((v) => String(v))
    .filter(Boolean);

  if (!email) redirect('/dashboard/admin/benutzer?error=E-Mail+fehlt');
  if (!password || password.length < 8)
    redirect('/dashboard/admin/benutzer?error=Passwort+muss+mindestens+8+Zeichen+haben');

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Konfigurationsfehler';
    redirect(`/dashboard/admin/benutzer?error=${encodeURIComponent(msg)}`);
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    redirect(`/dashboard/admin/benutzer?error=${encodeURIComponent(error.message)}`);
  }

  const userId = data.user.id;

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email,
    full_name,
    role,
  });

  if (profileError) {
    redirect(`/dashboard/admin/benutzer?error=${encodeURIComponent(profileError.message)}`);
  }

  if (liegenschaftIds.length > 0) {
    const inserts = liegenschaftIds.map((liegenschaft_id) => ({
      user_id: userId,
      liegenschaft_id,
      rolle: role,
    }));

    const { error: berechtigungError } = await supabaseAdmin
      .from('liegenschaft_berechtigungen')
      .upsert(inserts, { onConflict: 'user_id,liegenschaft_id' });

    if (berechtigungError) {
      redirect(`/dashboard/admin/benutzer?error=${encodeURIComponent(berechtigungError.message)}`);
    }
  }

  redirect('/dashboard/admin/benutzer?success=1');
}
