'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function adminCreateUser(formData: FormData): Promise<void> {
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

  return;
}
