"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Gemeinschaft = {
  id: string;
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  anzahl_einheiten: number;
  grundbuchnummer?: string;
  gruendungsjahr?: number;
  created_at: string;
};

type Abstimmung = {
  id: string;
  gemeinschaft_id: string;
  titel: string;
  beschreibung?: string;
  typ: string;
  status: string;
  datum: string;
  ja_stimmen: number;
  nein_stimmen: number;
  enthaltungen: number;
};

type Fonds = {
  id: string;
  gemeinschaft_id: string;
  name: string;
  saldo_chf: number;
  jahresbeitrag_chf: number;
};

const STATUS_CLS: Record<string, string> = {
  offen:      "bg-blue-100 text-blue-700",
  angenommen: "bg-green-100 text-green-700",
  abgelehnt:  "bg-red-100 text-red-700",
  vertagt:    "bg-amber-100 text-amber-700",
};

const TYP_LABEL: Record<string, string> = {
  beschluss:  "Beschluss",
  budget:     "Budget",
  sonstiges:  "Sonstiges",
};

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[hsl(214,76%,49%)] text-gray-900 placeholder-gray-400";

export default function STWEPage() {
  const supabase = createClient();
  const [gemeinschaften, setGemeinschaften] = useState<Gemeinschaft[]>([]);
  const [selected, setSelected] = useState<Gemeinschaft | null>(null);
  const [abstimmungen, setAbstimmungen] = useState<Abstimmung[]>([]);
  const [fonds, setFonds] = useState<Fonds[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewGem, setShowNewGem] = useState(false);
  const [showNewAb, setShowNewAb] = useState(false);

  const [gemForm, setGemForm] = useState({ name: "", strasse: "", hausnummer: "", plz: "", ort: "", grundbuchnummer: "", gruendungsjahr: "" });
  const [abForm, setAbForm] = useState({ titel: "", beschreibung: "", typ: "beschluss", datum: new Date().toISOString().split("T")[0] });

  async function loadGemeinschaften() {
    const { data } = await supabase.from("stwe_gemeinschaften").select("*").order("name");
    setGemeinschaften(data ?? []);
  }

  async function loadDetails(g: Gemeinschaft) {
    setSelected(g);
    const [{ data: abs }, { data: fo }] = await Promise.all([
      supabase.from("stwe_abstimmungen").select("*").eq("gemeinschaft_id", g.id).order("datum", { ascending: false }),
      supabase.from("stwe_fonds").select("*").eq("gemeinschaft_id", g.id),
    ]);
    setAbstimmungen(abs ?? []);
    setFonds(fo ?? []);
  }

  useEffect(() => { loadGemeinschaften(); }, []);

  async function createGemeinschaft(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("stwe_gemeinschaften").insert({
        verwalter_id: user!.id,
        name: gemForm.name,
        strasse: gemForm.strasse,
        hausnummer: gemForm.hausnummer,
        plz: gemForm.plz,
        ort: gemForm.ort,
        grundbuchnummer: gemForm.grundbuchnummer || null,
        gruendungsjahr: gemForm.gruendungsjahr ? parseInt(gemForm.gruendungsjahr) : null,
      }).select().single();
      if (error) throw error;

      await supabase.from("stwe_fonds").insert([
        { gemeinschaft_id: data.id, name: "Erneuerungsfonds", saldo_chf: 0, jahresbeitrag_chf: 0 },
        { gemeinschaft_id: data.id, name: "Betriebskostenfonds", saldo_chf: 0, jahresbeitrag_chf: 0 },
      ]);

      toast.success("STWE-Gemeinschaft erstellt");
      setShowNewGem(false);
      setGemForm({ name: "", strasse: "", hausnummer: "", plz: "", ort: "", grundbuchnummer: "", gruendungsjahr: "" });
      await loadGemeinschaften();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function createAbstimmung(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("stwe_abstimmungen").insert({
        gemeinschaft_id: selected.id,
        titel: abForm.titel,
        beschreibung: abForm.beschreibung || null,
        typ: abForm.typ,
        datum: abForm.datum,
        status: "offen",
      });
      if (error) throw error;
      toast.success("Abstimmung erstellt");
      setShowNewAb(false);
      setAbForm({ titel: "", beschreibung: "", typ: "beschluss", datum: new Date().toISOString().split("T")[0] });
      await loadDetails(selected);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function updateAbStatus(id: string, status: string) {
    const { error } = await supabase.from("stwe_abstimmungen").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (selected) await loadDetails(selected);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">STWE</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Stockwerkeigentümergemeinschaften verwalten</p>
        </div>
        <button
          onClick={() => setShowNewGem(v => !v)}
          className="btn-primary"
        >
          + Gemeinschaft
        </button>
      </div>

      {showNewGem && (
        <form onSubmit={createGemeinschaft} className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Neue STWE-Gemeinschaft</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Name der Gemeinschaft</label>
              <input type="text" required className={inp} value={gemForm.name} onChange={e => setGemForm(f => ({ ...f, name: e.target.value }))} placeholder="STWE Musterstrasse 5" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Strasse</label>
              <input type="text" required className={inp} value={gemForm.strasse} onChange={e => setGemForm(f => ({ ...f, strasse: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Nr.</label>
              <input type="text" required className={inp} value={gemForm.hausnummer} onChange={e => setGemForm(f => ({ ...f, hausnummer: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">PLZ</label>
              <input type="text" required className={inp} value={gemForm.plz} onChange={e => setGemForm(f => ({ ...f, plz: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Ort</label>
              <input type="text" required className={inp} value={gemForm.ort} onChange={e => setGemForm(f => ({ ...f, ort: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Grundbuchnummer</label>
              <input type="text" className={inp} value={gemForm.grundbuchnummer} onChange={e => setGemForm(f => ({ ...f, grundbuchnummer: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Gründungsjahr</label>
              <input type="number" className={inp} value={gemForm.gruendungsjahr} onChange={e => setGemForm(f => ({ ...f, gruendungsjahr: e.target.value }))} placeholder="2010" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? "…" : "Erstellen"}
            </button>
            <button type="button" onClick={() => setShowNewGem(false)} className="px-4 py-2 border border-border text-gray-600 text-sm rounded-xl hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-gray-900 text-sm">Gemeinschaften ({gemeinschaften.length})</h2>
          </div>
          {gemeinschaften.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Noch keine Gemeinschaften</div>
          ) : (
            <div className="divide-y divide-border">
              {gemeinschaften.map(g => (
                <button
                  key={g.id}
                  onClick={() => loadDetails(g)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected?.id === g.id ? "bg-[hsl(214,76%,49%)]/10 border-r-2 border-[hsl(214,76%,49%)]" : ""}`}
                >
                  <p className="font-medium text-gray-900 text-sm truncate">{g.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{g.strasse} {g.hausnummer}, {g.plz} {g.ort}</p>
                  {g.anzahl_einheiten > 0 && <p className="text-xs text-gray-400">{g.anzahl_einheiten} Einheiten</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <h2 className="font-bold text-gray-900 text-lg">{selected.name}</h2>
              <p className="text-gray-500 text-sm">{selected.strasse} {selected.hausnummer}, {selected.plz} {selected.ort}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                {selected.grundbuchnummer && <span>GBNr. {selected.grundbuchnummer}</span>}
                {selected.gruendungsjahr && <span>Gegr. {selected.gruendungsjahr}</span>}
              </div>
            </div>

            {fonds.length > 0 && (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <h3 className="font-semibold text-gray-700 text-sm border-b border-border pb-2 mb-3">Fonds</h3>
                <div className="grid grid-cols-2 gap-3">
                  {fonds.map(f => (
                    <div key={f.id} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">{f.name}</p>
                      <p className="text-lg font-bold text-gray-900">CHF {Number(f.saldo_chf).toLocaleString("de-CH", { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Jahresbeitrag: CHF {Number(f.jahresbeitrag_chf).toLocaleString("de-CH")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Abstimmungen ({abstimmungen.length})</h3>
                <button
                  onClick={() => setShowNewAb(v => !v)}
                  className="text-xs text-[hsl(214,76%,49%)] hover:underline"
                >
                  + Neu
                </button>
              </div>

              {showNewAb && (
                <form onSubmit={createAbstimmung} className="p-4 border-b border-border space-y-3 bg-gray-50">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Titel</label>
                    <input type="text" required className={inp} value={abForm.titel} onChange={e => setAbForm(f => ({ ...f, titel: e.target.value }))} placeholder="Genehmigung Dachsanierung…" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Beschreibung</label>
                    <textarea className={inp + " min-h-[60px] resize-none"} value={abForm.beschreibung} onChange={e => setAbForm(f => ({ ...f, beschreibung: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Typ</label>
                      <select className={inp} value={abForm.typ} onChange={e => setAbForm(f => ({ ...f, typ: e.target.value }))}>
                        <option value="beschluss">Beschluss</option>
                        <option value="budget">Budget</option>
                        <option value="sonstiges">Sonstiges</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Datum</label>
                      <input type="date" required className={inp} value={abForm.datum} onChange={e => setAbForm(f => ({ ...f, datum: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={loading} className="btn-primary text-xs disabled:opacity-50">Erstellen</button>
                    <button type="button" onClick={() => setShowNewAb(false)} className="px-3 py-1.5 border border-border text-gray-600 text-xs rounded-lg">Abbrechen</button>
                  </div>
                </form>
              )}

              {abstimmungen.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">Keine Abstimmungen</div>
              ) : (
                <div className="divide-y divide-border">
                  {abstimmungen.map(a => (
                    <div key={a.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[a.status] ?? "bg-gray-100 text-gray-500"}`}>
                              {a.status}
                            </span>
                            <span className="text-xs text-gray-400">{TYP_LABEL[a.typ] ?? a.typ}</span>
                            <span className="text-xs text-gray-400">{new Date(a.datum).toLocaleDateString("de-CH")}</span>
                          </div>
                          <p className="font-medium text-gray-900 text-sm">{a.titel}</p>
                          {a.beschreibung && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.beschreibung}</p>}
                          {(a.ja_stimmen > 0 || a.nein_stimmen > 0) && (
                            <p className="text-xs text-gray-400 mt-1">
                              ✓ {a.ja_stimmen} Ja · ✗ {a.nein_stimmen} Nein · — {a.enthaltungen} Enthalt.
                            </p>
                          )}
                        </div>
                        {a.status === "offen" && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => updateAbStatus(a.id, "angenommen")} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                              Angenommen
                            </button>
                            <button onClick={() => updateAbStatus(a.id, "abgelehnt")} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">
                              Abgelehnt
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-border shadow-sm p-10 text-center text-gray-400">
            <p className="text-3xl mb-2">🏛</p>
            <p className="text-sm">Gemeinschaft auswählen</p>
          </div>
        )}
      </div>
    </div>
  );
}
