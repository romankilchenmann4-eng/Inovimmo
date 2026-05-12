"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { QRRechnungInput } from "@/app/api/qr-rechnung/route";

type Wohnung = { id: string; bezeichnung: string; nettomiete: number; nebenkosten_akonto: number; liegenschaft: { name: string } | null };
type Bankkonto = { id: string; bezeichnung: string; iban: string };

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";
const MONATE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

export default function QRRechnungPage() {
  const supabase = createClient();
  const now = new Date();

  const [wohnungen, setWohnungen] = useState<Wohnung[]>([]);
  const [bankkonten, setBankkonten] = useState<Bankkonto[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    wohnung_id: "",
    bankkonto_id: "",
    // Empfänger (Verwalter - wird aus Profil geladen)
    empfaenger_name: "",
    empfaenger_strasse: "",
    empfaenger_plz: "",
    empfaenger_ort: "",
    iban: "",
    // Zahlungspflichtiger (Mieter)
    zahler_name: "",
    zahler_strasse: "",
    zahler_plz: "",
    zahler_ort: "",
    // Zahlung
    betrag: "",
    mitteilung: "",
    monat: String(now.getMonth() + 1),
    jahr: String(now.getFullYear()),
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();

    const [{ data: prof }, { data: wohn }, { data: bank }] = await Promise.all([
      supabase.from("profiles").select("full_name,firma,adresse,plz,ort").eq("id", user!.id).single(),
      supabase.from("wohnungen")
        .select("id, bezeichnung, nettomiete, nebenkosten_akonto, liegenschaft:liegenschaften(name)")
        .eq("status", "vermietet"),
      supabase.from("bankkonten").select("id,bezeichnung,iban").eq("verwalter_id", user!.id).eq("aktiv", true),
    ]);

    setProfile(prof);
    setWohnungen(wohn ?? []);
    setBankkonten(bank ?? []);

    if (prof) {
      const adressParts = (prof.adresse ?? "").split(",");
      setForm(f => ({
        ...f,
        empfaenger_name: prof.firma || prof.full_name,
        empfaenger_strasse: adressParts[0]?.trim() ?? "",
        empfaenger_plz: prof.plz ?? "",
        empfaenger_ort: prof.ort ?? "",
      }));
    }
    if (bank?.length) {
      setForm(f => ({ ...f, bankkonto_id: bank[0].id, iban: bank[0].iban }));
    }
  }

  function selectWohnung(id: string) {
    const w = wohnungen.find(x => x.id === id);
    if (!w) return;
    const brutto = Number(w.nettomiete) + Number(w.nebenkosten_akonto);
    const monatLabel = MONATE[Number(form.monat)-1];
    setForm(f => ({
      ...f,
      wohnung_id: id,
      betrag: String(brutto),
      mitteilung: `Miete ${monatLabel} ${form.jahr} — ${w.bezeichnung}`,
    }));
  }

  function selectBank(id: string) {
    const b = bankkonten.find(x => x.id === id);
    if (!b) return;
    setForm(f => ({ ...f, bankkonto_id: id, iban: b.iban }));
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.iban) { toast.error("IBAN eingeben oder Bankkonto wählen"); return; }
    if (!form.betrag || parseFloat(form.betrag) <= 0) { toast.error("Betrag eingeben"); return; }

    setLoading(true);
    try {
      const payload: QRRechnungInput = {
        empfaenger_name: form.empfaenger_name,
        empfaenger_strasse: form.empfaenger_strasse,
        empfaenger_plz: form.empfaenger_plz,
        empfaenger_ort: form.empfaenger_ort,
        iban: form.iban,
        zahler_name: form.zahler_name,
        zahler_strasse: form.zahler_strasse,
        zahler_plz: form.zahler_plz,
        zahler_ort: form.zahler_ort,
        betrag: parseFloat(form.betrag),
        waehrung: "CHF",
        mitteilung: form.mitteilung,
      };

      const res = await fetch("/api/qr-rechnung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("PDF-Generierung fehlgeschlagen");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QR-Rechnung_${form.zahler_name.replace(/\s/g,"_")}_${form.monat}-${form.jahr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("QR-Rechnung PDF heruntergeladen");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">QR-Rechnung Generator</h2>
        <p className="text-sm text-gray-500">Swiss Payment Standard 2.0 — konforme QR-Rechnungen als PDF</p>
      </div>

      <div className="info-box-blue text-sm text-blue-700">
        Die QR-Rechnung entspricht dem <strong>Swiss Payment Standard 2.0</strong> und kann mit allen Schweizer E-Banking-Apps und der Post eingescannt werden. Der IBAN muss ein Schweizer Konto (CH…) sein.
      </div>

      <form onSubmit={generate} className="grid md:grid-cols-2 gap-6">

        {/* Linke Spalte */}
        <div className="space-y-5">
          {/* Wohnung wählen */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">Wohnung</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Vermietete Wohnung</label>
              <select value={form.wohnung_id} onChange={e => selectWohnung(e.target.value)} className={inp}>
                <option value="">— Wohnung wählen oder manuell eingeben —</option>
                {wohnungen.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.bezeichnung} — {(w.liegenschaft as any)?.name} (CHF {(Number(w.nettomiete)+Number(w.nebenkosten_akonto)).toLocaleString("de-CH")}/Mt.)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Monat</label>
                <select value={form.monat} onChange={e => setForm(f => ({ ...f, monat: e.target.value }))} className={inp}>
                  {MONATE.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Jahr</label>
                <input type="number" value={form.jahr} onChange={e => setForm(f => ({ ...f, jahr: e.target.value }))} className={inp} />
              </div>
            </div>
          </div>

          {/* Zahlungspflichtiger (Mieter) */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">Zahlungspflichtiger (Mieter)</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Name *</label>
              <input required value={form.zahler_name} onChange={e => setForm(f => ({ ...f, zahler_name: e.target.value }))} placeholder="Max Mustermann" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Strasse</label>
              <input value={form.zahler_strasse} onChange={e => setForm(f => ({ ...f, zahler_strasse: e.target.value }))} placeholder="Musterstrasse 1" className={inp} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">PLZ</label>
                <input value={form.zahler_plz} onChange={e => setForm(f => ({ ...f, zahler_plz: e.target.value }))} placeholder="8001" className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Ort</label>
                <input value={form.zahler_ort} onChange={e => setForm(f => ({ ...f, zahler_ort: e.target.value }))} placeholder="Zürich" className={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* Rechte Spalte */}
        <div className="space-y-5">
          {/* Empfänger (Verwalter) */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">Zahlungsempfänger (Verwalter)</h3>

            {bankkonten.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Bankkonto</label>
                <select value={form.bankkonto_id} onChange={e => selectBank(e.target.value)} className={inp}>
                  {bankkonten.map(b => <option key={b.id} value={b.id}>{b.bezeichnung} — {b.iban}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">IBAN *</label>
              <input required value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} placeholder="CH56 0483 5012 3456 7800 9" className={`${inp} font-mono`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Name</label>
              <input value={form.empfaenger_name} onChange={e => setForm(f => ({ ...f, empfaenger_name: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Strasse</label>
              <input value={form.empfaenger_strasse} onChange={e => setForm(f => ({ ...f, empfaenger_strasse: e.target.value }))} className={inp} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">PLZ</label>
                <input value={form.empfaenger_plz} onChange={e => setForm(f => ({ ...f, empfaenger_plz: e.target.value }))} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Ort</label>
                <input value={form.empfaenger_ort} onChange={e => setForm(f => ({ ...f, empfaenger_ort: e.target.value }))} className={inp} />
              </div>
            </div>
          </div>

          {/* Betrag & Mitteilung */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">Zahlung</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Betrag CHF *</label>
              <input required type="number" step="0.01" min="0.01"
                value={form.betrag} onChange={e => setForm(f => ({ ...f, betrag: e.target.value }))}
                placeholder="1800.00" className={`${inp} text-lg font-bold`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Mitteilung / Verwendungszweck</label>
              <input value={form.mitteilung} onChange={e => setForm(f => ({ ...f, mitteilung: e.target.value }))}
                placeholder="Miete Januar 2026 — Musterstr. 1, 3.OG links" className={inp} maxLength={140} />
              <p className="text-xs text-gray-400 mt-1">{form.mitteilung.length}/140 Zeichen</p>
            </div>
          </div>

          <button type="submit" disabled={loading || !form.iban || !form.betrag || !form.zahler_name}
            className="w-full py-3 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                PDF wird generiert…
              </span>
            ) : "QR-Rechnung als PDF generieren"}
          </button>
        </div>
      </form>
    </div>
  );
}
