"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Abo = {
  plan: string;
  status: string;
  current_period_end?: string;
  wohnungen_limit: number;
};

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: "CHF 29",
    period: "/Monat",
    limit: "Bis 10 Wohnungen",
    features: [
      "Alle Kern-Module",
      "Mietvertrag PDF",
      "QR-Rechnung",
      "Mahnwesen",
      "E-Mail-Benachrichtigungen",
    ],
    highlight: false,
  },
  {
    key: "professional",
    name: "Professional",
    price: "CHF 79",
    period: "/Monat",
    limit: "Bis 50 Wohnungen",
    features: [
      "Alles aus Starter",
      "KI-Mietpreisanalyse",
      "Jahresbericht PDF",
      "Mieter-Screening",
      "Escrow & Stripe",
      "Prioritäts-Support",
    ],
    highlight: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "CHF 199",
    period: "/Monat",
    limit: "Unbegrenzte Wohnungen",
    features: [
      "Alles aus Professional",
      "STWE-Modul",
      "Eigentümer-Portal",
      "API-Zugang",
      "Dedizierter Support",
      "SLA 99.9%",
    ],
    highlight: false,
  },
];

function AboContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [abo, setAbo] = useState<Abo | null>(null);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [wohnungenCount, setWohnungenCount] = useState(0);

  useEffect(() => {
    if (searchParams.get("success") === "1") toast.success("Abo erfolgreich aktiviert!");
    if (searchParams.get("cancelled") === "1") toast.info("Checkout abgebrochen");
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: aboData }, { count }] = await Promise.all([
        supabase.from("abonnements").select("plan,status,current_period_end,wohnungen_limit").eq("verwalter_id", user.id).single(),
        supabase.from("wohnungen").select("id", { count: "exact", head: true }),
      ]);
      setAbo(aboData ?? { plan: "kostenlos", status: "aktiv", wohnungen_limit: 5 });
      setWohnungenCount(count ?? 0);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkout(plan: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      if (json.url) window.location.href = json.url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      if (json.url) window.location.href = json.url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setPortalLoading(false);
    }
  }

  const currentPlan = abo?.plan ?? "kostenlos";
  const isActive = abo?.status === "aktiv" || abo?.status === "trialing";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Abo & Pläne</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Skalieren Sie Inovimmo mit Ihrem Portfolio</p>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Aktueller Plan</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-gray-900 capitalize">{currentPlan}</p>
              {abo && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {abo.status === "aktiv" ? "Aktiv" : abo.status === "past_due" ? "Zahlung ausstehend" : abo.status === "trialing" ? "Testphase" : "Inaktiv"}
                </span>
              )}
            </div>
            {abo?.current_period_end && (
              <p className="text-xs text-muted-foreground mt-1">
                Nächste Verlängerung: {new Date(abo.current_period_end).toLocaleDateString("de-CH")}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">Wohnungen</p>
            <p className="text-lg font-bold text-gray-900">
              {wohnungenCount} / {abo?.wohnungen_limit === 9999 ? "∞" : (abo?.wohnungen_limit ?? 5)}
            </p>
            <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${wohnungenCount >= (abo?.wohnungen_limit ?? 5) ? "bg-red-500" : "bg-green-500"}`}
                style={{ width: `${Math.min(100, (wohnungenCount / (abo?.wohnungen_limit === 9999 ? 100 : (abo?.wohnungen_limit ?? 5))) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {currentPlan !== "kostenlos" && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="mt-4 text-xs text-[hsl(214,76%,49%)] hover:underline disabled:opacity-50"
          >
            {portalLoading ? "Lädt…" : "Abo verwalten / kündigen →"}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.key;
          return (
            <div
              key={plan.key}
              className={`bg-white rounded-2xl border shadow-sm p-5 relative ${plan.highlight ? "border-[hsl(214,76%,49%)]" : "border-border"}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(214,76%,49%)] text-white text-xs font-bold px-3 py-1 rounded-full">
                  Empfohlen
                </div>
              )}
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{plan.limit}</p>
              </div>

              <ul className="space-y-2 mb-5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500 flex-shrink-0 text-xs">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className={`w-full py-2 text-center text-sm font-semibold rounded-lg ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  {isActive ? "Aktueller Plan" : "Inaktiv"}
                </div>
              ) : (
                <button
                  onClick={() => checkout(plan.key)}
                  disabled={loading}
                  className={`w-full py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                    plan.highlight
                      ? "bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,42%)] text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {loading ? "Lädt…" : currentPlan === "kostenlos" ? "Jetzt abonnieren" : "Wechseln"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {currentPlan === "kostenlos" && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-lg">ℹ️</span>
          <div className="text-sm">
            <p className="font-semibold text-blue-900">Kostenloser Plan — 5 Wohnungen inklusive</p>
            <p className="text-blue-600 mt-0.5">
              Keine Kreditkarte erforderlich. Upgraden Sie jederzeit für mehr Wohnungen und Premium-Features.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border shadow-sm p-4 text-xs text-muted-foreground space-y-1">
        <p>Alle Preise in CHF inkl. MwSt. · Monatliche Kündigung jederzeit möglich.</p>
        <p>Zahlungsabwicklung sicher über Stripe · Keine Daten werden gespeichert.</p>
      </div>
    </div>
  );
}

export default function AboPage() {
  return (
    <Suspense>
      <AboContent />
    </Suspense>
  );
}
