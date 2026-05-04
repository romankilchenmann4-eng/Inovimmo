"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Inner form
function CheckoutForm({ betrag, onSuccess }: { betrag: number; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/dashboard/escrow?success=1` },
        redirect: "if_required",
      });
      if (error) throw error;
      toast.success(`CHF ${betrag.toLocaleString("de-CH")} erfolgreich einbezahlt!`);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Zahlung fehlgeschlagen");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="info-box-green text-xs text-green-700 mt-2">
        🔒 Ihr Geld wird auf einem gesicherten Treuhandkonto hinterlegt und erst nach Auftragsabschluss freigegeben.
      </div>
      <button
        type="submit" disabled={!stripe || loading}
        className="w-full py-3 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl disabled:opacity-50 text-sm"
      >
        {loading ? "Wird verarbeitet…" : `CHF ${betrag.toLocaleString("de-CH")} sicher einzahlen`}
      </button>
    </form>
  );
}

// TWINT Option
function TWINTPayment({ betrag, escrowId, onSuccess }: { betrag: number; escrowId: string; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleTWINT() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrow_id: escrowId, payment_method: "twint" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("TWINT-Zahlung initiiert. Bitte TWINT-App öffnen.");
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setLoading(false); }
  }

  return (
    <button
      onClick={handleTWINT} disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-200 rounded-xl hover:border-[hsl(214,76%,49%)] transition-colors"
    >
      <span className="text-lg">💳</span>
      <div className="text-left">
        <p className="font-semibold text-sm text-gray-900">Mit TWINT bezahlen</p>
        <p className="text-xs text-gray-400">CHF {betrag.toLocaleString("de-CH")}</p>
      </div>
    </button>
  );
}

// Main export
export default function StripeCheckout({
  escrowId, betrag, onClose, onSuccess,
}: {
  escrowId: string; betrag: number; onClose: () => void; onSuccess: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"card" | "twint">("card");

  async function initPayment() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrow_id: escrowId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClientSecret(data.clientSecret);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Initiieren");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900">Escrow-Zahlung</h3>
            <p className="text-sm text-gray-400">CHF {betrag.toLocaleString("de-CH")} einzahlen</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[{ id:"card", label:"💳 Karte" }, { id:"twint", label:"📱 TWINT" }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as "card" | "twint")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.id ? "bg-[hsl(214,76%,49%)] text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "twint" ? (
          <TWINTPayment betrag={betrag} escrowId={escrowId} onSuccess={onSuccess} />
        ) : !clientSecret ? (
          <button
            onClick={initPayment} disabled={loading}
            className="w-full py-3 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm"
          >
            {loading ? "Wird geladen…" : "Zahlung starten"}
          </button>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, locale: "de" }}>
            <CheckoutForm betrag={betrag} onSuccess={onSuccess} />
          </Elements>
        )}
      </div>
    </div>
  );
}
