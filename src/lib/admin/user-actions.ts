'use server';

import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

function getSupabaseAdmin() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const supabaseUrl =
    rawUrl.match(/https:\/\/[A-Za-z0-9.-]+\.supabase\.co/)?.[0] ??
    rawUrl.trim();

  const serviceRoleKey =
    rawKey.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0] ??
    rawKey.trim();

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL fehlt');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function adminCreateUser(formData: FormData): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();

  const email = String(formData.get('email') || '').trim();
  const full_name = String(formData.get('full_name') || '').trim();
  const role = String(formData.get('role') || 'mieter').trim();

  const liegenschaftIds = formData
    .getAll('liegenschaft_ids')
    .map((v) => String(v))
    .filter(Boolean);

  if (!email) {
    throw new Error('E-Mail fehlt');
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  const userId = data.user.id;

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      email,
      full_name,
      role,
    });

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (liegenschaftIds.length > 0) {
    const inserts = liegenschaftIds.map((liegenschaft_id) => ({
      user_id: userId,
      liegenschaft_id,
      rolle: role,
    }));

    const { error: berechtigungError } = await supabaseAdmin
      .from('liegenschaft_berechtigungen')
      .upsert(inserts, {
        onConflict: 'user_id,liegenschaft_id',
      });

    if (berechtigungError) {
      throw new Error(berechtigungError.message);
    }
  }

  redirect('/dashboard/admin/benutzer');
}
