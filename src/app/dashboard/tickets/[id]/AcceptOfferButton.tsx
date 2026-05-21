"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptOffer } from "./actions";
export default function AcceptOfferButton({ offerteId, ticketId, betrag, dienstleisterId }: { offerteId:string;ticketId:string;betrag:number;dienstleisterId:string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function accept() {
    if (!confirm(`Offerte für CHF ${Number(betrag).toLocaleString("de-CH")} akzeptieren?`)) return;
    setLoading(true);
    try {
      await acceptOffer(offerteId, ticketId, betrag, dienstleisterId);
      toast.success("Auftrag vergeben!");
      router.refresh();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Fehler"); } finally { setLoading(false); }
  }
  return <button onClick={accept} disabled={loading} className="mt-2 w-full py-2 bg-[hsl(214,76%,49%)] text-white text-xs font-semibold rounded-lg disabled:opacity-50">{loading ? "…" : "Auftrag vergeben"}</button>;
}