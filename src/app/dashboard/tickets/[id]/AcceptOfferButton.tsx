"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
export default function AcceptOfferButton({ offerteId, ticketId, betrag, dienstleisterId }: { offerteId:string;ticketId:string;betrag:number;dienstleisterId:string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  async function accept() {
    if (!confirm(`Offerte für CHF ${Number(betrag).toLocaleString("de-CH")} akzeptieren?`)) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("offerten").update({ status:"akzeptiert" }).eq("id",offerteId);
      await supabase.from("offerten").update({ status:"abgelehnt" }).eq("ticket_id",ticketId).neq("id",offerteId);
      await supabase.from("tickets").update({ status:"vergeben" }).eq("id",ticketId);
      const provision = Math.round(betrag*0.06*100)/100;
      await supabase.from("escrows").insert({ ticket_id:ticketId,offerte_id:offerteId,verwalter_id:user!.id,dienstleister_id:dienstleisterId,betrag,provision_prozent:6,provision_betrag:provision,status:"ausstehend" });
      toast.success("Auftrag vergeben!");
      router.refresh();
    } catch (err:unknown) { toast.error(err instanceof Error?err.message:"Fehler"); } finally { setLoading(false); }
  }
  return <button onClick={accept} disabled={loading} className="mt-2 w-full py-2 bg-[hsl(214,76%,49%)] text-white text-xs font-semibold rounded-lg disabled:opacity-50">{loading?"…":"Auftrag vergeben"}</button>;
}
