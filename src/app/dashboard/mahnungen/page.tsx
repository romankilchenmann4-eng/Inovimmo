"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import SubNav from "@/components/ui/SubNav";

const FINANZEN_NAV = [
  { href: "/dashboard/buchhaltung",  label: "Buchhaltung" },
  { href: "/dashboard/nebkosten",    label: "Nebenkosten" },
  { href: "/dashboard/mahnungen",    label: "Mahnwesen" },
  { href: "/dashboard/bankkonten",   label: "Bankkonten" },
  { href: "/dashboard/qr-rechnung",  label: "QR-Rechnung" },
];

type OffenerPosten = {
  wohnung_id: string;
  bezeichnung: string;
  liegenschaft: string;
  mieter_name?: string;
  mieter_email?: string;
  saldo: number;
  offene_monate: string[];
  letzte_zahlung?: string;
  mahnstufe: number;
};

const MONATE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

const MAHNSTUFEN = [
  { stufe: 1, label: "1. Mahnung",   tage: 10,  farbe: "badge-amber", icon: "⚠️" },
  { stufe: 2, label: "2. Mahnung",   tage: 20,  farbe: "badge-red",   icon: "🔴" },
  { stufe: 3, label: "Letzte Mahnung", tage: 30, farbe: "badge-red",  icon: "🚨" },
];

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

export default function MahnungenPage() {
  const supabase = createClient();
  const [offenePosten, setOffenePosten] = useState<OffenerPosten[]>([]);
  const [mahnungen, setMahnungen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [tab, setTab] = useState<"offen" | "history">("offen");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const jahr = new Date().getFullYear();

    const { data: wohnungen } = await supabase
      .from("wohnungen")
      .select("id, bezeichnung, nettomiete, nebenkosten_akonto, liegenschaft:liegenschaften(name)")
      .eq("status", "vermietet");

    if (!wohnungen?.length) { setOffenePosten([]); setLoading(false); return; }

    const ids = wohnungen.map(w => w.id);
    const { data: buchungen } = await supabase
      .from("buchungen")
      .select("wohnung_id, typ, betrag, periode_monat, periode_jahr, valuta")
      .in("wohnung_id", ids)
      .eq("periode_jahr", jahr);

    const { data: mahnHist } = await supabase
      .from("mahnungen")
      .select("*")
      .eq("verwalter_id", user!.id)
      .order("created_at", { ascending: false });

    setMahnungen(mahnHist ?? []);

    // Offene Posten berechnen
    const posten: OffenerPosten[] = [];
    const nowMonth = new Date().getMonth() + 1;

    for (const w of wohnungen) {
      const wBuch = (buchungen ?? []).filter(b => b.wohnung_id === w.id);
      const brutto = Number(w.nettomiete) + Number(w.nebenkosten_akonto);
      const offeneMonate: string[] = [];
      let saldo = 0;

      for (let m = 1; m <= nowMonth; m++) {
        const soll = wBuch.filter(b => b.typ === "miete_soll" && b.periode_monat === m).reduce((s, b) => s + Number(b.betrag), 0);
        const haben = wBuch.filter(b => b.typ === "miete_zahlung" && b.periode_monat === m).reduce((s, b) => s + Number(b.betrag), 0);
        const monatSaldo = (soll > 0 ? soll : brutto) - haben;
        if (monatSaldo > 50) {
          offeneMonate.push(`${MONATE[m-1]} ${jahr}`);
          saldo += monatSaldo;
        }
      }

      if (offeneMonate.length > 0) {
        const letzteMahnung = mahnHist?.find(mh => mh.wohnung_id === w.id && mh.status === "offen");
        posten.push({
          wohnung_id: w.id,
          bezeichnung: w.bezeichnung,
          liegenschaft: (w.liegenschaft as any)?.name ?? "—",
          saldo,
          offene_monate: offeneMonate,
          mahnstufe: letzteMahnung ? letzteMahnung.stufe : 0,
        });
      }
    }

    setOffenePosten(posten);
    setLoading(false);
  }

  async function mahneSchicken(op: OffenerPosten) {
    setSending(op.wohnung_id);
    const naechsteStufe = Math.min(op.mahnstufe + 1, 3);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Mahnung in DB speichern
      await supabase.from("mahnungen").insert({
        verwalter_id: user!.id,
        wohnung_id: op.wohnung_id,
        stufe: naechsteStufe,
        offener_betrag: op.saldo,
        periode: op.offene_monate.join(", "),
        versendet_at: new Date().toISOString(),
        status: "offen",
      });

      // Email versenden
      if (op.mieter_email) {
        await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "mahnung",
            to: op.mieter_email,
            data: {
              mieterName: op.mieter_name ?? "Mieter",
              wohnung: op.bezeichnung,
              liegenschaft: op.liegenschaft,
              offenerBetrag: op.saldo,
              offeneMonate: op.offene_monate,
              mahnstufe: naechsteStufe,
            },
          }),
        });
      }

      toast.success(`${MAHNSTUFEN[naechsteStufe-1].label} ${op.mieter_email ? "versendet" : "gespeichert (keine Email-Adresse)"}`);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSending(null);
    }
  }

  const totalRueckstand = offenePosten.reduce((s, p) => s + p.saldo, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={FINANZEN_NAV} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mahnwesen</h2>
          <p className="text-sm text-gray-500">Offene Mietzahlungen · Automatische Mahnungen</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Totaler Rückstand</p>
          <p className={`text-2xl font-bold ${totalRueckstand > 0 ? "text-red-600" : "text-green-600"}`}>
            CHF {totalRueckstand.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Offene Fälle</p>
          <p className={`text-2xl font-bold ${offenePosten.length > 0 ? "text-amber-600" : "text-green-600"}`}>{offenePosten.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Versendete Mahnungen</p>
          <p className="text-2xl font-bold text-gray-900">{mahnungen.filter(m => m.status === "offen").length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["offen", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "offen" ? `Offene Posten (${offenePosten.length})` : "Mahnungs-Historie"}
          </button>
        ))}
      </div>

      {tab === "offen" && (
        <>
          {loading ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center text-gray-400 text-sm">Laden…</div>
          ) : offenePosten.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-12 text-center">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-semibold text-gray-700">Keine offenen Posten</p>
              <p className="text-sm text-gray-400 mt-1">Alle Mieten sind bezahlt.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Wohnung</th>
                      <th className="table-header">Offene Monate</th>
                      <th className="table-header">Rückstand</th>
                      <th className="table-header">Mahnstufe</th>
                      <th className="table-header">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offenePosten.map(op => {
                      const naechsteStufe = Math.min(op.mahnstufe + 1, 3);
                      const cfg = MAHNSTUFEN[naechsteStufe - 1];
                      const isSending = sending === op.wohnung_id;
                      return (
                        <tr key={op.wohnung_id} className="table-row">
                          <td className="table-cell">
                            <p className="font-medium text-sm text-gray-900">{op.bezeichnung}</p>
                            <p className="text-xs text-gray-400">{op.liegenschaft}</p>
                            {op.mieter_name && <p className="text-xs text-gray-500">{op.mieter_name}</p>}
                          </td>
                          <td className="table-cell">
                            <div className="flex flex-wrap gap-1">
                              {op.offene_monate.map(m => (
                                <span key={m} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">{m}</span>
                              ))}
                            </div>
                          </td>
                          <td className="table-cell font-bold text-red-600">
                            CHF {op.saldo.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="table-cell">
                            {op.mahnstufe > 0 ? (
                              <span className={MAHNSTUFEN[op.mahnstufe-1].farbe}>
                                {MAHNSTUFEN[op.mahnstufe-1].icon} {MAHNSTUFEN[op.mahnstufe-1].label} versendet
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Noch keine</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <button
                              onClick={() => mahneSchicken(op)}
                              disabled={isSending || op.mahnstufe >= 3}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                                op.mahnstufe >= 3
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-red-50 text-red-700 hover:bg-red-100"
                              }`}
                            >
                              {isSending ? "…" : op.mahnstufe >= 3 ? "Max. Stufe" : `${cfg.icon} ${cfg.label} senden`}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          {mahnungen.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-3xl mb-2">📬</p>
              <p className="text-sm">Noch keine Mahnungen versendet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Wohnung</th>
                    <th className="table-header">Stufe</th>
                    <th className="table-header">Offener Betrag</th>
                    <th className="table-header">Periode</th>
                    <th className="table-header">Versendet</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mahnungen.map(m => {
                    const cfg = MAHNSTUFEN[m.stufe - 1];
                    return (
                      <tr key={m.id} className="table-row">
                        <td className="table-cell text-sm font-medium">{m.wohnung_id?.slice(0, 8)}…</td>
                        <td className="table-cell">
                          <span className={cfg?.farbe ?? "badge-gray"}>{cfg?.icon} {cfg?.label}</span>
                        </td>
                        <td className="table-cell font-semibold text-sm">CHF {Number(m.offener_betrag).toLocaleString("de-CH", { minimumFractionDigits: 2 })}</td>
                        <td className="table-cell text-sm text-gray-600">{m.periode}</td>
                        <td className="table-cell text-xs text-gray-400">
                          {m.versendet_at ? new Date(m.versendet_at).toLocaleDateString("de-CH") : "—"}
                        </td>
                        <td className="table-cell">
                          <span className={m.status === "bezahlt" ? "badge-green" : m.status === "storniert" ? "badge-gray" : "badge-amber"}>
                            {m.status === "bezahlt" ? "✓ Bezahlt" : m.status === "storniert" ? "Storniert" : "Offen"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
