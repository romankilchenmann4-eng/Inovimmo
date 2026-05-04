"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const KANTONE = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"];

export default function NeueLiegenschaftPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name:"", strasse:"", hausnummer:"", plz:"", ort:"", kanton:"ZH",
    baujahr:"", anzahl_wohnungen:"1", objekttyp:"MFH", notizen:""
  });

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error, data } = await supabase.from("liegenschaften").insert({
        verwalter_id: user!.id,
        name: form.name,
        strasse: form.strasse,
        hausnummer: form.hausnummer,
        plz: form.plz,
        ort: form.ort,
        kanton: form.kanton,
        baujahr: form.baujahr ? parseInt(form.baujahr) : null,
        anzahl_wohnungen: parseInt(form.anzahl_wohnungen),
        objekttyp: form.objekttyp,
        notizen: form.notizen || null,
      }).select().single();
      if (error) throw error;
      toast.success("Liegenschaft erfolgreich erstellt!");
      router.push(`/dashboard/objekte/${data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setLoading(false); }
  }

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Neue Liegenschaft</h2>
        <p className="text-sm text-gray-500">Erfassen Sie Ihre Liegenschaft — Wohnungen können danach hinzugefügt werden.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="form-section space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Bezeichnung</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Name / Bezeichnung *</label>
            <input required value={form.name} onChange={e=>up("name",e.target.value)} placeholder="z.B. Parkstrasse 12" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {k:"objekttyp",lbl:"Objekttyp",opts:["MFH","EFH","Gewerbe","Gemischt"],sel:true},
            ].map(f=>(
              <div key={f.k}>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{f.lbl}</label>
                <select value={form[f.k as keyof typeof form]} onChange={e=>up(f.k,e.target.value)} className={inp}>
                  {f.opts.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Anz. Wohnungen *</label>
              <input type="number" min="1" required value={form.anzahl_wohnungen} onChange={e=>up("anzahl_wohnungen",e.target.value)} className={inp} />
            </div>
          </div>
        </div>

        <div className="form-section space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Adresse</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Strasse *</label>
              <input required value={form.strasse} onChange={e=>up("strasse",e.target.value)} placeholder="Musterstrasse" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Nr. *</label>
              <input required value={form.hausnummer} onChange={e=>up("hausnummer",e.target.value)} placeholder="12" className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">PLZ *</label>
              <input required value={form.plz} onChange={e=>up("plz",e.target.value)} placeholder="8001" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Ort *</label>
              <input required value={form.ort} onChange={e=>up("ort",e.target.value)} placeholder="Zürich" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Kanton</label>
              <select value={form.kanton} onChange={e=>up("kanton",e.target.value)} className={inp}>
                {KANTONE.map(k=><option key={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Baujahr</label>
              <input type="number" min="1800" max="2026" value={form.baujahr} onChange={e=>up("baujahr",e.target.value)} placeholder="1985" className={inp} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notizen (intern)</label>
          <textarea rows={3} value={form.notizen} onChange={e=>up("notizen",e.target.value)} placeholder="Interne Notizen…" className={`${inp} resize-none`} />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={()=>router.back()} className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm">Abbrechen</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 text-sm">
            {loading ? "Wird gespeichert…" : "Liegenschaft speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
