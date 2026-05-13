"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import SubNav from "@/components/ui/SubNav";

const FINANZEN_NAV = [
  { href: "/dashboard/buchhaltung",  label: "Buchhaltung" },
  { href: "/dashboard/nebkosten",    label: "Nebenkosten" },
  { href: "/dashboard/mahnungen",    label: "Mahnwesen" },
  { href: "/dashboard/qr-rechnung",  label: "QR-Rechnung" },
];

type Wohnung = {
  id: string;
  bezeichnung: string;
  nettomiete: number;
  nebenkosten_akonto: number;
  status: string;
  liegenschaft: { id: string; name: string } | null;
};

type Buchung = {
  id: string;
  wohnung_id: string;
  typ: string;
  buchungstext: string;
  betrag: number;
  valuta: string;
  periode_monat?: number;
  periode_jahr?: number;
  referenz?: string;
  notiz?: string;
};

type Mietkonto = {
  wohnung: Wohnung;
  soll: number;
  haben: number;
  saldo: number;
  buchungen: Buchung[];
};

type Monatsstatus = {
  monat: number;
  soll: number;
  zahlung: number;
  offen: number;
  bezahlt: boolean;
};

const MONATE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

const TYP_CONFIG: Record<string, { label: string; seite: "soll" | "haben"; color: string }> = {
  miete_soll:           { label: "Miete Soll",          seite: "soll",  color: "text-red-600" },
  miete_zahlung:        { label: "Mieteingang",          seite: "haben", color: "text-green-600" },
  nk_soll:              { label: "NK-Nachzahlung Soll",  seite: "soll",  color: "text-red-600" },
  nk_rueckerstattung:   { label: "NK-Rückerstattung",    seite: "haben", color: "text-green-600" },
  kaution_eingang:      { label: "Kautionszahlung",      seite: "haben", color: "text-blue-600" },
  sonstiges_soll:       { label: "Sonstige Belastung",   seite: "soll",  color: "text-red-600" },
  sonstiges_haben:      { label: "Sonstige Gutschrift",  seite: "haben", color: "text-green-600" },
};

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

export default function BuchhaltungPage() {
  const supabase = createClient();
  const now = new Date();
  const [konten, setKonten] = useState<Mietkonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showBuchung, setShowBuchung] = useState(false);
  const [showSollBuchen, setShowSollBuchen] = useState(false);
  const [filterJahr, setFilterJahr] = useState(now.getFullYear());

  const [form, setForm] = useState({
    typ: "miete_zahlung",
    buchungstext: "",
    betrag: "",
    valuta: now.toISOString().split("T")[0],
    periode_monat: String(now.getMonth() + 1),
    periode_jahr: String(now.getFullYear()),
    referenz: "",
    notiz: "",
  });

  useEffect(() => { loadKonten(); }, [filterJahr]);

  async function loadKonten() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .single();

    let wohnungenQuery = supabase
      .from("wohnungen")
      .select("id, bezeichnung, nettomiete, nebenkosten_akonto, status, liegenschaft:liegenschaften(id,name)")
      .eq("status", "vermietet");
    if (profile?.role !== "admin") wohnungenQuery = wohnungenQuery.eq("verwalter_id", user!.id);
    const { data: wohnungen } = await wohnungenQuery;

    if (!wohnungen?.length) { setKonten([]); setLoading(false); return; }

    const wohnungIds = wohnungen.map(w => w.id);
    const { data: buchungen } = await supabase
      .from("buchungen")
      .select("*")
      .eq("verwalter_id", user!.id)
      .in("wohnung_id", wohnungIds)
      .eq("periode_jahr", filterJahr)
      .order("valuta", { ascending: false });

    const result: Mietkonto[] = wohnungen.map(w => {
      const wBuchungen = (buchungen ?? []).filter(b => b.wohnung_id === w.id);
      const soll = wBuchungen.filter(b => TYP_CONFIG[b.typ]?.seite === "soll").reduce((s, b) => s + Number(b.betrag), 0);
      const haben = wBuchungen.filter(b => TYP_CONFIG[b.typ]?.seite === "haben").reduce((s, b) => s + Number(b.betrag), 0);
      return { wohnung: w as unknown as Wohnung, soll, haben, saldo: haben - soll, buchungen: wBuchungen };
    });

    setKonten(result);
    setLoading(false);
  }

  async function buchen(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const { data: { user } } = await supabase.auth.getUser();

    const wohnung = konten.find(k => k.wohnung.id === selected)?.wohnung;
    const text = form.buchungstext || (TYP_CONFIG[form.typ]?.label ?? form.typ) + (form.periode_monat ? ` ${MONATE[Number(form.periode_monat)-1]} ${form.periode_jahr}` : "");

    const { error } = await supabase.from("buchungen").insert({
      verwalter_id: user!.id,
      wohnung_id: selected,
      liegenschaft_id: wohnung?.liegenschaft?.id,
      typ: form.typ,
      buchungstext: text,
      betrag: parseFloat(form.betrag),
      valuta: form.valuta,
      periode_monat: form.periode_monat ? parseInt(form.periode_monat) : null,
      periode_jahr: form.periode_jahr ? parseInt(form.periode_jahr) : null,
      referenz: form.referenz || null,
      notiz: form.notiz || null,
    });

    if (error) { toast.error(error.message); return; }
    toast.success("Buchung erfasst");
    setShowBuchung(false);
    setForm(f => ({ ...f, buchungstext: "", betrag: "", referenz: "", notiz: "" }));
    loadKonten();
  }

  async function sollBuchenAlle() {
    const { data: { user } } = await supabase.auth.getUser();
    const monat = now.getMonth() + 1;
    const jahr = now.getFullYear();

    let count = 0;
    for (const konto of konten) {
      const exists = konto.buchungen.some(
        b => b.typ === "miete_soll" && b.periode_monat === monat && b.periode_jahr === jahr
      );
      if (!exists) {
        const brutto = Number(konto.wohnung.nettomiete) + Number(konto.wohnung.nebenkosten_akonto);
        await supabase.from("buchungen").insert({
          verwalter_id: user!.id,
          wohnung_id: konto.wohnung.id,
          liegenschaft_id: konto.wohnung.liegenschaft?.id,
          typ: "miete_soll",
          buchungstext: `Miete ${MONATE[monat-1]} ${jahr}`,
          betrag: brutto,
          valuta: `${jahr}-${String(monat).padStart(2,"0")}-01`,
          periode_monat: monat,
          periode_jahr: jahr,
        });
        count++;
      }
    }
    toast.success(`${count} Soll-Buchungen für ${MONATE[monat-1]} ${jahr} erstellt`);
    setShowSollBuchen(false);
    loadKonten();
  }

  async function mietzinsErhalten(konto: Mietkonto, monat: number) {
    const { data: { user } } = await supabase.auth.getUser();
    const brutto = Number(konto.wohnung.nettomiete) + Number(konto.wohnung.nebenkosten_akonto);
    const valuta = `${filterJahr}-${String(monat).padStart(2,"0")}-01`;
    const sollExists = konto.buchungen.some(
      b => b.typ === "miete_soll" && b.periode_monat === monat && b.periode_jahr === filterJahr
    );
    const zahlungExists = konto.buchungen.some(
      b => b.typ === "miete_zahlung" && b.periode_monat === monat && b.periode_jahr === filterJahr
    );

    const rows: Record<string, unknown>[] = [];
    if (!sollExists) {
      rows.push({
        verwalter_id: user!.id,
        wohnung_id: konto.wohnung.id,
        liegenschaft_id: konto.wohnung.liegenschaft?.id,
        typ: "miete_soll",
        buchungstext: `Miete ${MONATE[monat-1]} ${filterJahr}`,
        betrag: brutto,
        valuta,
        periode_monat: monat,
        periode_jahr: filterJahr,
        manuell: true,
      });
    }
    if (!zahlungExists) {
      rows.push({
        verwalter_id: user!.id,
        wohnung_id: konto.wohnung.id,
        liegenschaft_id: konto.wohnung.liegenschaft?.id,
        typ: "miete_zahlung",
        buchungstext: `Mietzins erhalten ${MONATE[monat-1]} ${filterJahr}`,
        betrag: brutto,
        valuta: new Date().toISOString().split("T")[0],
        periode_monat: monat,
        periode_jahr: filterJahr,
        manuell: true,
      });
    }

    if (rows.length === 0) {
      toast.info("Dieser Monat ist bereits verbucht");
      return;
    }

    const { error } = await supabase.from("buchungen").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${konto.wohnung.bezeichnung}: ${MONATE[monat-1]} ${filterJahr} verbucht`);
    loadKonten();
  }

  function monatsstatus(konto: Mietkonto, monat: number): Monatsstatus {
    const soll = konto.buchungen
      .filter(b => TYP_CONFIG[b.typ]?.seite === "soll" && b.periode_monat === monat)
      .reduce((sum, b) => sum + Number(b.betrag), 0);
    const zahlung = konto.buchungen
      .filter(b => TYP_CONFIG[b.typ]?.seite === "haben" && b.periode_monat === monat)
      .reduce((sum, b) => sum + Number(b.betrag), 0);
    const offen = Math.max(0, soll - zahlung);
    return { monat, soll, zahlung, offen, bezahlt: soll > 0 && zahlung >= soll };
  }

  const selectedKonto = konten.find(k => k.wohnung.id === selected);
  const totalSaldo = konten.reduce((s, k) => s + k.saldo, 0);
  const offene = konten.filter(k => k.saldo < 0).length;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthTotals = MONATE.map((_, i) => {
    const monat = i + 1;
    const soll = konten.reduce((sum, konto) => sum + monatsstatus(konto, monat).soll, 0);
    const zahlung = konten.reduce((sum, konto) => sum + monatsstatus(konto, monat).zahlung, 0);
    return { monat, soll, zahlung, offen: Math.max(0, soll - zahlung), bezahlt: soll > 0 && zahlung >= soll };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={FINANZEN_NAV} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Buchhaltung</h2>
          <p className="text-sm text-gray-500">Mietkonten, Zahlungseingänge, Salden</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select value={filterJahr} onChange={e => setFilterJahr(Number(e.target.value))} className={inp + " w-28"}>
            {[0,1,2].map(o => { const y = now.getFullYear()-o; return <option key={y} value={y}>{y}</option>; })}
          </select>
          <button onClick={() => setShowSollBuchen(true)}
            className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">
            Monatssoll buchen
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Gesamtsaldo {filterJahr}</p>
          <p className={`text-2xl font-bold ${totalSaldo >= 0 ? "text-green-600" : "text-red-600"}`}>
            {totalSaldo >= 0 ? "+" : ""}CHF {Math.abs(totalSaldo).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Offene Salden</p>
          <p className={`text-2xl font-bold ${offene > 0 ? "text-red-600" : "text-green-600"}`}>{offene}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Vermietete Wohnungen</p>
          <p className="text-2xl font-bold text-gray-900">{konten.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Monatliche Übersicht {filterJahr}</h3>
            <p className="text-xs text-gray-400">Soll, Zahlungseingang und offene Differenz über alle Mietobjekte</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Monat</th>
                <th className="table-header text-right">Soll</th>
                <th className="table-header text-right">Erhalten</th>
                <th className="table-header text-right">Offen</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {monthTotals.map(m => (
                <tr key={m.monat} className="table-row">
                  <td className="table-cell text-sm font-medium">{MONATE[m.monat-1]}</td>
                  <td className="table-cell text-sm text-right">CHF {m.soll.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</td>
                  <td className="table-cell text-sm text-right text-green-700">CHF {m.zahlung.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</td>
                  <td className={`table-cell text-sm text-right font-medium ${m.offen > 0 ? "text-red-600" : "text-gray-500"}`}>
                    CHF {m.offen.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="table-cell">
                    {m.bezahlt ? (
                      <span className="badge-green">Bezahlt</span>
                    ) : m.soll > 0 ? (
                      <span className="badge-amber">Teilweise / offen</span>
                    ) : (
                      <span className="badge-gray">Noch nicht gebucht</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Konten-Liste */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 px-1">Mietkonten</h3>
          {loading ? (
            <div className="bg-white rounded-xl border border-border p-6 text-center text-gray-400 text-sm">Laden…</div>
          ) : konten.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-6 text-center text-gray-400 text-sm">
              Keine vermieteten Wohnungen
            </div>
          ) : konten.map(k => {
            const isSelected = selected === k.wohnung.id;
            const istRueckstand = k.saldo < 0;
            return (
              <button key={k.wohnung.id} onClick={() => setSelected(k.wohnung.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${isSelected ? "border-[hsl(214,76%,49%)] bg-blue-50 shadow-sm" : "border-border bg-white hover:border-gray-300"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{k.wohnung.bezeichnung}</p>
                    <p className="text-xs text-gray-400 truncate">{k.wohnung.liegenschaft?.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${istRueckstand ? "text-red-600" : k.saldo > 0 ? "text-green-600" : "text-gray-500"}`}>
                      {k.saldo >= 0 ? "+" : ""}CHF {k.saldo.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </p>
                    {istRueckstand && <p className="text-xs text-red-500">Rückstand</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Konto-Detail */}
        <div className="lg:col-span-2">
          {!selectedKonto ? (
            <div className="bg-white rounded-xl border border-border p-12 text-center text-gray-400">
              <p className="text-3xl mb-3">💼</p>
              <p className="font-medium text-gray-600">Konto auswählen</p>
              <p className="text-sm mt-1">Wählen Sie links ein Mietkonto aus</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Konto-Header */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedKonto.wohnung.bezeichnung}</h3>
                    <p className="text-sm text-gray-400">{selectedKonto.wohnung.liegenschaft?.name}</p>
                  </div>
                  <button onClick={() => setShowBuchung(true)}
                    className="px-3 py-1.5 bg-[hsl(214,76%,49%)] text-white text-xs font-semibold rounded-lg">
                    + Buchung
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400">Soll {filterJahr}</p>
                    <p className="text-lg font-bold text-red-600">CHF {selectedKonto.soll.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Haben {filterJahr}</p>
                    <p className="text-lg font-bold text-green-600">CHF {selectedKonto.haben.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Saldo</p>
                    <p className={`text-lg font-bold ${selectedKonto.saldo < 0 ? "text-red-600" : "text-green-600"}`}>
                      {selectedKonto.saldo >= 0 ? "+" : ""}CHF {selectedKonto.saldo.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Buchungen */}
              <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h4 className="font-semibold text-sm text-gray-900">Monatskontrolle {filterJahr}</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="table-header">Monat</th>
                        <th className="table-header text-right">Soll</th>
                        <th className="table-header text-right">Erhalten</th>
                        <th className="table-header">Status</th>
                        <th className="table-header text-right">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONATE.map((label, index) => {
                        const status = monatsstatus(selectedKonto, index + 1);
                        const isFuture = filterJahr > currentYear || (filterJahr === currentYear && status.monat > currentMonth);
                        return (
                          <tr key={label} className="table-row">
                            <td className="table-cell text-sm font-medium">{label}</td>
                            <td className="table-cell text-sm text-right">CHF {status.soll.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</td>
                            <td className="table-cell text-sm text-right text-green-700">CHF {status.zahlung.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</td>
                            <td className="table-cell">
                              {status.bezahlt ? (
                                <span className="badge-green">Mietzins erhalten</span>
                              ) : status.soll > 0 ? (
                                <span className="badge-amber">Offen CHF {status.offen.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</span>
                              ) : (
                                <span className="badge-gray">Nicht verbucht</span>
                              )}
                            </td>
                            <td className="table-cell text-right">
                              <button
                                type="button"
                                onClick={() => mietzinsErhalten(selectedKonto, status.monat)}
                                disabled={status.bezahlt || isFuture}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Mietzins erhalten
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h4 className="font-semibold text-sm text-gray-900">Buchungen {filterJahr}</h4>
                </div>
                {selectedKonto.buchungen.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <p className="text-sm">Noch keine Buchungen</p>
                    <button onClick={() => setShowBuchung(true)} className="mt-2 text-xs text-[hsl(214,76%,49%)] font-medium hover:underline">
                      Erste Buchung erfassen
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {selectedKonto.buchungen.map(b => {
                      const cfg = TYP_CONFIG[b.typ];
                      const istHaben = cfg?.seite === "haben";
                      return (
                        <div key={b.id} className="flex items-center gap-4 px-5 py-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${istHaben ? "bg-green-400" : "bg-red-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{b.buchungstext}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(b.valuta).toLocaleDateString("de-CH")}
                              {b.referenz && ` · Ref: ${b.referenz}`}
                            </p>
                          </div>
                          <p className={`font-semibold text-sm flex-shrink-0 ${cfg?.color ?? "text-gray-600"}`}>
                            {istHaben ? "+" : "−"}CHF {Number(b.betrag).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buchungs-Modal */}
      {showBuchung && selectedKonto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Buchung erfassen</h3>
              <button onClick={() => setShowBuchung(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <form onSubmit={buchen} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Typ</label>
                <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))} className={inp}>
                  {Object.entries(TYP_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Betrag CHF *</label>
                  <input required type="number" step="0.01" min="0.01"
                    value={form.betrag} onChange={e => setForm(f => ({ ...f, betrag: e.target.value }))}
                    placeholder={String(Number(selectedKonto.wohnung.nettomiete) + Number(selectedKonto.wohnung.nebenkosten_akonto))}
                    className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Valuta *</label>
                  <input required type="date" value={form.valuta} onChange={e => setForm(f => ({ ...f, valuta: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Monat</label>
                  <select value={form.periode_monat} onChange={e => setForm(f => ({ ...f, periode_monat: e.target.value }))} className={inp}>
                    {MONATE.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Jahr</label>
                  <input type="number" value={form.periode_jahr} onChange={e => setForm(f => ({ ...f, periode_jahr: e.target.value }))} className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Buchungstext</label>
                <input value={form.buchungstext} onChange={e => setForm(f => ({ ...f, buchungstext: e.target.value }))}
                  placeholder="Wird automatisch generiert wenn leer" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Referenz</label>
                <input value={form.referenz} onChange={e => setForm(f => ({ ...f, referenz: e.target.value }))} placeholder="QR-Referenz, IBAN, etc." className={inp} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowBuchung(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Abbrechen</button>
                <button type="submit" disabled={!form.betrag} className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm disabled:opacity-50">Buchen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monatssoll-Modal */}
      {showSollBuchen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-3">Monatssoll buchen</h3>
            <p className="text-sm text-gray-600 mb-4">
              Für <strong>{MONATE[now.getMonth()]} {now.getFullYear()}</strong> wird bei allen vermieteten Wohnungen eine Soll-Buchung über die Bruttomonatsmiete erstellt (falls noch nicht vorhanden).
            </p>
            <p className="text-sm text-gray-500 mb-5">
              {konten.length} Wohnungen · Total CHF {konten.reduce((s,k) => s + Number(k.wohnung.nettomiete) + Number(k.wohnung.nebenkosten_akonto), 0).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowSollBuchen(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Abbrechen</button>
              <button onClick={sollBuchenAlle} className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm">Jetzt buchen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
