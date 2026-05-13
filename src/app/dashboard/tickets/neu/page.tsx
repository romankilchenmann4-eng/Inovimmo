"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Liegenschaft, Wohnung } from "@/types";

const KATEGORIEN = [
  { value: "heizung_sanitaer", label: "🔥 Heizung / Sanitär" },
  { value: "elektro",          label: "⚡ Elektro" },
  { value: "fenster_tueren",   label: "🚪 Fenster / Türen" },
  { value: "maler_boeden",     label: "🎨 Maler / Böden" },
  { value: "garten",           label: "🌿 Garten" },
  { value: "reinigung",        label: "🧹 Reinigung" },
  { value: "sonstiges",        label: "🔧 Sonstiges" },
];

const PRIORITAETEN = [
  { value: "normal",   label: "Normal",     desc: "Innerhalb 5 Werktage",  color: "border-gray-200" },
  { value: "dringend", label: "Dringend",   desc: "Innerhalb 24 Stunden", color: "border-amber-300" },
  { value: "notfall",  label: "🔥 Notfall", desc: "Sofort",               color: "border-red-300" },
];

export default function NeuesTicketPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [liegenschaften, setLiegenschaften] = useState<Liegenschaft[]>([]);
  const [wohnungen, setWohnungen] = useState<Wohnung[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);
  const [form, setForm] = useState({
    titel: "",
    beschreibung: "",
    liegenschaft_id: "",
    wohnung_id: "",
    kategorie: "sonstiges",
    prioritaet: "normal",
    budget_max: "",
  });

  useEffect(() => {
    supabase.from("liegenschaften").select("*").then(({ data }) => {
      setLiegenschaften(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!form.liegenschaft_id) { setWohnungen([]); return; }
    supabase.from("wohnungen").select("*").eq("liegenschaft_id", form.liegenschaft_id).then(({ data }) => {
      setWohnungen(data ?? []);
    });
  }, [form.liegenschaft_id]);

  function update(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const total = fotos.length + files.length;
    if (total > 5) { toast.error("Maximal 5 Fotos erlaubt"); return; }
    setFotos(prev => [...prev, ...files]);
    const previews = files.map(f => URL.createObjectURL(f));
    setFotoPreviews(prev => [...prev, ...previews]);
  }

  function removeFoto(idx: number) {
    URL.revokeObjectURL(fotoPreviews[idx]);
    setFotos(prev => prev.filter((_, i) => i !== idx));
    setFotoPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function uploadFotos(ticketId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of fotos) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${ticketId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("ticket-fotos").upload(path, file, { upsert: false });
      if (error) { console.error("Foto upload error:", error.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from("ticket-fotos").getPublicUrl(path);
      urls.push(publicUrl);
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.liegenschaft_id) { toast.error("Bitte Liegenschaft wählen"); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error, data } = await supabase.from("tickets").insert({
        titel: form.titel,
        beschreibung: form.beschreibung,
        liegenschaft_id: form.liegenschaft_id,
        wohnung_id: form.wohnung_id || null,
        kategorie: form.kategorie,
        prioritaet: form.prioritaet,
        budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
        erstellt_von: user!.id,
        status: "neu",
      }).select().single();
      if (error) throw error;

      // Upload fotos
      if (fotos.length > 0) {
        const fotoUrls = await uploadFotos(data.id);
        if (fotoUrls.length > 0) {
          await supabase.from("tickets").update({ fotos: fotoUrls }).eq("id", data.id);
        }
      }

      toast.success("Ticket erstellt! Dienstleister werden automatisch angefragt.");
      router.push(`/dashboard/tickets/${data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Erstellen");
    } finally {
      setLoading(false);
    }
  }

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Neues Ticket erstellen</h2>
        <p className="text-sm text-gray-500">Nach dem Erstellen werden qualifizierte Dienstleister automatisch angefragt.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Liegenschaft */}
        <div className="form-section">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Objekt</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Liegenschaft *</label>
              <select required value={form.liegenschaft_id} onChange={e => update("liegenschaft_id", e.target.value)} className={inp}>
                <option value="">Bitte wählen…</option>
                {liegenschaften.map(l => <option key={l.id} value={l.id}>{l.name} — {l.ort}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Wohnung (opt.)</label>
              <select value={form.wohnung_id} onChange={e => update("wohnung_id", e.target.value)} disabled={!form.liegenschaft_id} className={`${inp} disabled:opacity-40`}>
                <option value="">Allgemeiner Bereich</option>
                {wohnungen.map(w => <option key={w.id} value={w.id}>{w.bezeichnung}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="form-section">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ticket-Details</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Titel *</label>
              <input type="text" required value={form.titel} onChange={e => update("titel", e.target.value)} placeholder="z.B. Heizung ausgefallen Wohnung 3.OG" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Beschreibung *</label>
              <textarea required rows={4} value={form.beschreibung} onChange={e => update("beschreibung", e.target.value)} placeholder="Bitte beschreiben Sie das Problem so detailliert wie möglich…" className={`${inp} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Kategorie</label>
                <select value={form.kategorie} onChange={e => update("kategorie", e.target.value)} className={inp}>
                  {KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Budget max. (CHF)</label>
                <input type="number" min="0" step="50" value={form.budget_max} onChange={e => update("budget_max", e.target.value)} placeholder="z.B. 1000" className={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* Fotos */}
        <div className="form-section">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Fotos (optional)</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          {fotoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {fotoPreviews.map((src, i) => (
                <div key={i} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => removeFoto(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {fotos.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[hsl(214,76%,49%)] hover:text-[hsl(214,76%,49%)] transition-colors flex flex-col items-center gap-2"
            >
              <span className="text-2xl">📷</span>
              <span>Fotos hinzufügen ({fotos.length}/5)</span>
              <span className="text-xs text-gray-400">JPG, PNG, WEBP — max. 10 MB pro Bild</span>
            </button>
          )}
        </div>

        {/* Priorität */}
        <div className="form-section">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Dringlichkeit</h3>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITAETEN.map(p => (
              <label
                key={p.value}
                className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  form.prioritaet === p.value ? `${p.color} bg-blue-50` : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input type="radio" name="prio" value={p.value} checked={form.prioritaet === p.value} onChange={e => update("prioritaet", e.target.value)} className="sr-only" />
                <span className="font-semibold text-sm text-gray-900">{p.label}</span>
                <span className="text-xs text-gray-500 mt-0.5">{p.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="info-box-blue text-xs text-blue-700">
          <strong>ℹ️ Automatische Ausschreibung:</strong> Nach dem Erstellen werden passende Dienstleister in der Region automatisch benachrichtigt und können Offerten einreichen.
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
            Abbrechen
          </button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 transition-colors text-sm">
            {loading ? "Wird erstellt…" : "Ticket erstellen & ausschreiben"}
          </button>
        </div>
      </form>
    </div>
  );
}
