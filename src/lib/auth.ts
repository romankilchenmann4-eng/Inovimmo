// ── Centralized Auth Helpers ───────────────────────────────────

import { createClient } from "./supabase/server";
import { requireAdmin, requireAdminOrVerwalter } from "./supabase/admin";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export { requireAdmin, requireAdminOrVerwalter };

/**
 * Get the authenticated user or throw an error.
 * Use this in server actions and API routes to ensure the user is logged in.
 */
export async function getAuthenticatedUser(): Promise<User> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Nicht autorisiert");
  }
  return user;
}

/**
 * Get the authenticated user and verify they are admin or verwalter.
 * Throws if unauthorized.
 */
export async function requireAuthAndRole(
  allowedRoles: ("admin" | "verwalter" | "mieter" | "dienstleister")[]
): Promise<{ user: User; supabase: SupabaseClient }> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Nicht autorisiert");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role as typeof allowedRoles[number])) {
    throw new Error("Keine Berechtigung für diese Aktion");
  }

  return { user, supabase };
}

/**
 * Verify that a user has access to a liegenschaft.
 * Returns true if the user is admin, or if they are the verwalter of the liegenschaft.
 */
export async function verifyLiegenschaftAccess(
  supabase: SupabaseClient,
  userId: string,
  liegenschaftId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return true;

  const { data: liegenschaft } = await supabase
    .from("liegenschaften")
    .select("verwalter_id")
    .eq("id", liegenschaftId)
    .single();

  return liegenschaft?.verwalter_id === userId;
}