"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const POSITIONEN = ["Heizkosten","Warmwasser","Kaltwasser","Allgemeinstrom","Hauswartung","Versicherungen","Gartenunterhalt","Lift","Kehrichtgebühren","Sonstiges"];

export default function NKForm({ liegenschaften, jahr }: { liegenschaften: {id:string,name:string}[]; jahr: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ liegenschaft_id:"", bezeichnung:"Heizkosten", betrag:"", verteilschluessel:"flaeche" });
  const up = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.liegenschaft_id) { toast.error("Liegenschaft wählen"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("nebenkostenpositionen").insert({
        liegenschaft_id: form.liegenschaft_id,
        jahr,
        bezeichnung: form.bezeichnung,
        betrag_total: parseFloat(form.betrag),
        verteilschluessel: form.verteilschluessel,
      });
      if (error) throw error;
      toast.success("Position gespeichert");
      setForm(f => ({ ...f, betrag: "" }));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-xl border border-border shadow-sm p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Position hinzufügen</h4>
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Liegenschaft</label>
        <select required value={form.liegenschaft_id} onChange={e=>up("liegenschaft_id",e.target.value)} className={inp}>
          <option value="">Bitte wählen…</option>
          {liegenschaften.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Bezeichnung</label>
          <select value={form.bezeichnung} onChange={e=>up("bezeichnung",e.target.value)} className={inp}>
            {POSITIONEN.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Betrag CHF</label>
          <input type="number" required min="0" step="0.01" value={form.betrag} onChange={e=>up("betrag",e.target.value)} placeholder="1200.00" className={inp} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Verteilschlüssel</label>
        <select value={form.verteilschluessel} onChange={e=>up("verteilschluessel",e.target.value)} className={inp}>
          <option value="flaeche">Nach Fläche (m²)</option>
          <option value="kopf">Nach Anzahl Personen</option>
          <option value="gleich">Gleichmässig</option>
        </select>
      </div>
      <button type="submit" disabled={loading} className="w-full py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-lg disabled:opacity-50">
        {loading ? "Speichern…" : "+ Position hinzufügen"}
      </button>
    </form>
  );
}
