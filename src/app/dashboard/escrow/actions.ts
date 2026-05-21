"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminOrVerwalter } from "@/lib/supabase/admin";

export async function releaseEscrow(escrowId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht autorisiert");
  await requireAdminOrVerwalter(supabase, user.id);

  const { data: escrow, error: escrowError } = await supabase
    .from("escrows")
    .select("id, ticket_id, verwalter_id")
    .eq("id", escrowId)
    .single();

  if (escrowError || !escrow) throw new Error("Escrow nicht gefunden");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && escrow.verwalter_id !== user.id) {
    throw new Error("Keine Berechtigung für diesen Escrow");
  }

  const { error: escrowUpdateError } = await supabase
    .from("escrows")
    .update({ status: "abgeschlossen", freigegeben_at: new Date().toISOString() })
    .eq("id", escrowId);

  if (escrowUpdateError) throw new Error(escrowUpdateError.message);

  await supabase
    .from("tickets")
    .update({ status: "abgeschlossen" })
    .eq("id", escrow.ticket_id);
}