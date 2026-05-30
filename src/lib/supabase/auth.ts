/**
 * Zentrale Auth-Helpers
 *
 * Vermeidet wiederholtes createClient() + getUser() + Rollen-Check
 * in Server Actions und API Routes.
 */
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrVerwalter, requireAdmin } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthResult = {
  supabase: SupabaseClient;
  user: User;
};

/**
 * Erfordert einen angemeldeten User.
 * Wirft einen Error, wenn nicht eingeloggt.
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Nicht eingeloggt");
  }
  return { supabase, user };
}

/**
 * Erfordert einen User mit Admin- oder Verwalter-Rolle.
 */
export async function requireAuthAsVerwalter(): Promise<AuthResult> {
  const { supabase, user } = await requireAuth();
  await requireAdminOrVerwalter(supabase, user.id);
  return { supabase, user };
}

/**
 * Erfordert einen User mit Admin-Rolle.
 */
export async function requireAuthAsAdmin(): Promise<AuthResult> {
  const { supabase, user } = await requireAuth();
  await requireAdmin(supabase, user.id);
  return { supabase, user };
}