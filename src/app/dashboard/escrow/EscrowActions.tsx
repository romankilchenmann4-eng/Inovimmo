"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import StripeCheckout from "@/components/escrow/StripeCheckout";
import { releaseEscrow } from "./actions";

type Escrow = { id: string; status: string; betrag: number; ticket_id: string };

export default function EscrowActions({ escrow }: { escrow: Escrow }) {
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const router = useRouter();

  async function release() {
    if (!confirm("Auftrag bestätigen und Zahlung freigeben?")) return;
    setLoading(true);
    try {
      await releaseEscrow(escrow.id);
      toast.success("Zahlung freigegeben!");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Fehler");
    } finally {
      setLoading(false);
    }
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