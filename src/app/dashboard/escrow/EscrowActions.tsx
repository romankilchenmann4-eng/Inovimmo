"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import StripeCheckout from "@/components/escrow/StripeCheckout";

type Escrow = { id: string; status: string; betrag: number; ticket_id: string };

export default function EscrowActions({ escrow }: { escrow: Escrow }) {
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function release() {
    if (!confirm("Auftrag bestätigen und Zahlung freigeben?")) return;
    setLoading(true);
    try {
      await supabase.from("escrows").update({ status: "abgeschlossen", freigegeben_at: new Date().toISOString() }).eq("id", escrow.id);
      await supabase.from("tickets").update({ status: "abgeschlossen" }).eq("id", escrow.ticket_id);
      toast.success("Zahlung freigegeben!");
      router.refresh();
    } catch { toast.error("Fehler"); } finally { setLoading(false); }
  }

  if (escrow.status === "ausstehend") {
    return (
      <>
        <button
          onClick={() => setCheckoutOpen(true)}
          disabled={loading}
          className="px-3 py-1.5 bg-[hsl(214,76%,49%)] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
        >
          💳 Einzahlen
        </button>

        {checkoutOpen && (
          <StripeCheckout
            escrowId={escrow.id}
            betrag={Number(escrow.betrag)}
            onClose={() => setCheckoutOpen(false)}
            onSuccess={() => {
              setCheckoutOpen(false);
              router.refresh();
            }}
          />
        )}
      </>
    );
  }
  if (escrow.status === "in_ausfuehrung") return <button onClick={release} disabled={loading} className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">{loading ? "…" : "✓ Freigeben"}</button>;
  if (escrow.status === "abgeschlossen") return <span className="text-xs text-gray-400">Abgeschlossen</span>;
  return <span className="text-xs text-gray-400">—</span>;
}
