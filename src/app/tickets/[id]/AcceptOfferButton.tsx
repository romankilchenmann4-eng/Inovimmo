"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function AcceptOfferButton({ offerteId, ticketId, betrag }: { offerteId: string; ticketId: string; betrag: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function accept() {
    if (!confirm(`Offerte für CHF ${Number(betrag).toLocaleString("de-CH")} akzeptieren?\n\nDer Betrag wird auf das Escrow-Konto überwiesen und erst nach Auftragsabschluss freigegeben.`)) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get offerte details
      const { data: off } = await supabase.from("offerten").select("dienstleister_id").eq("id", offerteId).single();
      if (!off) throw new Error("Offerte nicht gefunden");

      // Accept offerte
      await supabase.from("offerten").update({ status: "akzeptiert" }).eq("id", offerteId);
      await supabase.from("offerten").update({ status: "abgelehnt" }).eq("ticket_id", ticketId).neq("id", offerteId);

      // Update ticket status
      await supabase.from("tickets").update({ status: "vergeben" }).eq("id", ticketId);

      // Create escrow record
      const provision = Math.round(betrag * 0.06 * 100) / 100;
      await supabase.from("escrows").insert({
        ticket_id: ticketId,
        offerte_id: offerteId,
        verwalter_id: user!.id,
        dienstleister_id: off.dienstleister_id,
        betrag,
        provision_prozent: 6,
        provision_betrag: provision,
        status: "ausstehend",
      });

      toast.success("Auftrag vergeben! Escrow-Zahlung ausstehend.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setLoading(false); }
  }

  return (
    <button
      onClick={accept} disabled={loading}
      className="mt-2 w-full py-2 bg-[hsl(214,76%,49%)] text-white text-xs font-semibold rounded-lg hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 transition-colors"
    >
      {loading ? "Wird vergeben…" : "Auftrag vergeben"}
    </button>
  );
}
