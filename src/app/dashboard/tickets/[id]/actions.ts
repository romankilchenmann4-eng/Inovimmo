"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminOrVerwalter } from "@/lib/supabase/admin";
import { PROVISION_PROZENT } from "@/lib/constants";

export async function acceptOffer(offerteId: string, ticketId: string, betrag: number, dienstleisterId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht autorisiert");
  await requireAdminOrVerwalter(supabase, user.id);

  const { error: offerError } = await supabase
    .from("offerten")
    .update({ status: "akzeptiert" })
    .eq("id", offerteId);

  if (offerError) throw new Error(offerError.message);

  await supabase
    .from("offerten")
    .update({ status: "abgelehnt" })
    .eq("ticket_id", ticketId)
    .neq("id", offerteId);

  await supabase
    .from("tickets")
    .update({ status: "vergeben" })
    .eq("id", ticketId);

  const provisionBetrag = Math.round(betrag * PROVISION_PROZENT * 100) / 100;
  await supabase
    .from("escrows")
    .insert({
      ticket_id: ticketId,
      dienstleister_id: dienstleisterId,
      verwalter_id: user.id,
      betrag,
      provision_prozent: PROVISION_PROZENT * 100,
      provision_betrag: provisionBetrag,
      status: "ausstehend",
    });
}