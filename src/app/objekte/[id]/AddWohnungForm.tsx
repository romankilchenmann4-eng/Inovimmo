"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function AddWohnungForm({ liegenschaftId }: { liegenschaftId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ bezeichnung:"", etage:"0", zimmer:"3.5", flaeche_m2:"", nettomiete:"", nebenkosten_akonto:"200" });
  const up = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

  async function save() {
    setLoading(true);
    try {
      const { error } = await supabase.from("wohnungen").insert({
        liegenschaft_id: liegenschaftId,
        bezeichnung: form.bezeichnung,
        etage: parseInt(form.etage),
        zimmer: parseFloat(form.zimmer),
        flaeche_m2: form.flaeche_m2 ? parseFloat(form.flaeche_m2) : null,
        nettomiete: parseFloat(form.nettomiete || "0"),
        nebenkosten_akonto: parseFloat(form.nebenkosten_akonto),
        status: "leer",
      });
      if (error) throw error;
      toast.success("Wohnung hinzugefügt!");
      setOpen(false);
      setForm({ bezeichnung:"", etage:"0", zimmer:"3.5", flaeche_m2:"", nettomiete:"", nebenkosten_akonto:"200" });
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setLoading(false); }
  }

  if (!open) return (
    <button onClick={()=>setOpen(true)} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[hsl(214,76%,49%)] hover:text-[hsl(214,76%,49%)] transition-colors">
      + Wohnung hinzufügen
    </button>
  );

  return (
    <div className="bg-white rounded-xl border-2 border-[hsl(214,76%,49%)] p-4 shadow-sm">
      <h4 className="font-semibold text-sm text-gray-900 mb-4">Neue Wohnung</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Bezeichnung *</label>
          <input required value={form.bezeichnung} onChange={e=>up("bezeichnung",e.target.value)} placeholder="z.B. EG links" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Etage</label>
          <input type="number" value={form.etage} onChange={e=>up("etage",e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Zimmer</label>
          <input type="number" step="0.5" value={form.zimmer} onChange={e=>up("zimmer",e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Fläche m²</label>
          <input type="number" value={form.flaeche_m2} onChange={e=>up("flaeche_m2",e.target.value)} placeholder="82" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Nettomiete CHF</label>
          <input type="number" value={form.nettomiete} onChange={e=>up("nettomiete",e.target.value)} placeholder="1800" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">NK à-conto CHF</label>
          <input type="number" value={form.nebenkosten_akonto} onChange={e=>up("nebenkosten_akonto",e.target.value)} className={inp} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={()=>setOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Abbrechen</button>
        <button onClick={save} disabled={loading||!form.bezeichnung} className="flex-1 py-2 bg-[hsl(214,76%,49%)] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
