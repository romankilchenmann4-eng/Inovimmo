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

type Bankkonto = {
  id: string;
  bezeichnung: string;
  iban: string;
  bic?: string;
  bank_name?: string;
  aktiv: boolean;
  created_at: string;
};

const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] text-gray-900 placeholder-gray-400";

function formatIban(raw: string) {
  return raw.replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") ?? raw;
}

export default function BankkontenPage() {
  const supabase = createClient();
  const [konten, setKonten] = useState<Bankkonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bezeichnung: "", iban: "", bic: "", bank_name: "" });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("bankkonten")
      .select("*")
      .order("created_at", { ascending: false });
    setKonten(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ibanClean = form.iban.replace(/\s/g, "").toUpperCase();
    if (!form.bezeichnung || !ibanClean) { toast.error("Bezeichnung und IBAN erforderlich"); return; }
    if (!/^CH\d{2}\d{5}[A-Z0-9]{12}$/.test(ibanClean) && !/^[A-Z]{2}\d{2}/.test(ibanClean)) {
      toast.error("Ungültiges IBAN-Format");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("bankkonten").insert({
      verwalter_id: user!.id,
      bezeichnung: form.bezeichnung,
      iban: ibanClean,
      bic: form.bic || null,
      bank_name: form.bank_name || null,
      aktiv: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bankkonto hinzugefügt");
    setShowForm(false);
    setForm({ bezeichnung: "", iban: "", bic: "", bank_name: "" });
    await load();
  }

  async function toggleAktiv(konto: Bankkonto) {
    const { error } = await supabase.from("bankkonten").update({ aktiv: !konto.aktiv }).eq("id", konto.id);
    if (error) { toast.error(error.message); return; }
    setKonten(prev => prev.map(k => k.id === konto.id ? { ...k, aktiv: !k.aktiv } : k));
    toast.success(konto.aktiv ? "Konto deaktiviert" : "Konto aktiviert");
  }

  async function remove(id: string) {
    if (!confirm("Bankkonto wirklich löschen?")) return;
    const { error } = await supabase.from("bankkonten").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setKonten(prev => prev.filter(k => k.id !== id));
    toast.success("Gelöscht");
  }

  const aktive = konten.filter(k => k.aktiv);
  const inaktive = konten.filter(k => !k.aktiv);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SubNav items={FINANZEN_NAV} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Bankkonten</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {aktive.length} aktives Konto{aktive.length !== 1 ? "n" : ""}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          + Konto hinzufügen
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Neues Bankkonto</h3>
          <form onSubmit={save} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Bezeichnung *</label>
                <input className={inp} value={form.bezeichnung} onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))} placeholder="Mietkonto Hauptstrasse 4" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Bank</label>
                <input className={inp} value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="UBS, PostFinance…" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">IBAN *</label>
                <input
                  className={inp + " font-mono tracking-wider"}
                  value={form.iban}
                  onChange={e => setForm(f => ({ ...f, iban: e.target.value }))}
                  placeholder="CH93 0076 2011 6238 5295 7"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">BIC / SWIFT</label>
                <input className={inp + " font-mono"} value={form.bic} onChange={e => setForm(f => ({ ...f, bic: e.target.value }))} placeholder="UBSWCHZH80A" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Speichern…" : "Speichern"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-border text-gray-600 text-sm rounded-xl hover:bg-gray-50">Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Lade…</div>
      ) : konten.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">🏦</p>
          <p className="text-sm">Noch kein Bankkonto erfasst</p>
          <p className="text-xs text-gray-400 mt-1">Bankkonten werden für QR-Rechnungen und Zahlungsabgleich verwendet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[{ label: "Aktive Konten", list: aktive }, { label: "Inaktive Konten", list: inaktive }].map(({ label, list }) =>
            list.length > 0 && (
              <div key={label} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="font-semibold text-gray-700 text-sm">{label} ({list.length})</h3>
                </div>
                <div className="divide-y divide-border">
                  {list.map(k => (
                    <div key={k.id} className="px-5 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[hsl(214,76%,49%)]/10 flex items-center justify-center text-xl flex-shrink-0">
                        🏦
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-gray-900 text-sm">{k.bezeichnung}</p>
                          {k.bank_name && <span className="text-xs text-gray-400">{k.bank_name}</span>}
                          {!k.aktiv && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inaktiv</span>}
                        </div>
                        <p className="text-sm font-mono text-gray-600 tracking-wider">{formatIban(k.iban)}</p>
                        {k.bic && <p className="text-xs text-gray-400 mt-0.5">BIC: {k.bic}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleAktiv(k)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            k.aktiv
                              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {k.aktiv ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        <button
                          onClick={() => remove(k.id)}
                          className="text-xs px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm text-blue-800 font-semibold mb-1">Automatischer Zahlungsabgleich</p>
        <p className="text-xs text-blue-600">
          Laden Sie Ihren Kontoauszug (ISO camt.053) hoch, um Mieteingänge automatisch den richtigen Wohnungen zuzuordnen.
          Diese Funktion ist für Professional- und Enterprise-Abonnenten verfügbar.
        </p>
      </div>
    </div>
  );
}
