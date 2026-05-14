/**
 * Zentrale Admin-Client Factory für Supabase
 *
 * Verwendet den Service Role Key - NUR für Server-seitige Operationen!
 * Nie im Client oder Browser verwenden.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase Admin-Konfiguration fehlt. " +
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein."
    );
  }

  // Cache für bessere Performance bei wiederholten Aufrufen
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

/**
 * Helper: Prüft ob User Admin-Role hat
 */
export async function requireAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile || profile.role !== "admin") {
    throw new Error("Nur Admins können diese Aktion ausführen");
  }
}

/**
 * Helper: Prüft ob User Admin oder Verwalter ist
 */
export async function requireAdminOrVerwalter(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile || !["admin", "verwalter"].includes(profile.role)) {
    throw new Error("Nur Admins und Verwalter können diese Aktion ausführen");
  }
}
