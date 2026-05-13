"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function InseratPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const wohnungId = params.wohnungId as string;

  const [wohnung, setWohnung] = useState<any>(null);
  const [form, setForm] = useState({
    titel: "",
    beschreibung: "",
    verfuegbar_ab: "",
    mietzins_netto: "",
    nebenkosten: "",
    kaution_monate: "3",
    plattform_homegate: true,
    plattform_immoscout: false,
    plattform_comparis: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("wohnungen").select("*").eq("id", wohnungId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setWohnung(data);
          setForm(f => ({
            ...f,
            titel: `${data.zimmer}-Zimmer-Wohnung ${data.bezeichnung || ""}`.trim(),
            mietzins_netto: String(data.nettomiete || ""),
            nebenkosten: String(data.nebenkosten_akonto || ""),
          }));
        }
      });
  }, [wohnungId]);

  function update(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      toast.success("Inserat wurde vorbereitet — Veröffentlichung über Plattformen folgt.");
      router.back();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-6">
      <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
        ← Zurück
      </button>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Inserat erstellen</h1>
        <p className="text-sm text-gray-400 mt-1">Leerstehende Wohnung auf Immobilienportalen ausschreiben.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Inseratstitel & Beschreibung</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Titel</label>
            <input
              required value={form.titel}
              onChange={e => update("titel", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="3.5-Zimmer-Wohnung Zürich Seefeld"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Beschreibung</label>
            <textarea
              rows={5} value={form.beschreibung}
              onChange={e => update("beschreibung", e.target.value)}
              placeholder="Helle, gut geschnittene Wohnung mit Balkon…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Konditionen</h2>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Nettomiete CHF</label>
              <input
                type="number" value={form.mietzins_netto}
                onChange={e => update("mietzins_netto", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Nebenkosten CHF</label>
              <input
                type="number" value={form.nebenkosten}
                onChange={e => update("nebenkosten", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Kaution (Monate)</label>
              <select
                value={form.kaution_monate}
                onChange={e => update("kaution_monate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {["1","2","3"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Verfügbar ab</label>
            <input
              type="date" value={form.verfuegbar_ab}
              onChange={e => update("verfuegbar_ab", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Plattformen</h2>
          {[
            { key: "plattform_homegate", label: "Homegate.ch" },
            { key: "plattform_immoscout", label: "ImmoScout24.ch" },
            { key: "plattform_comparis", label: "Comparis.ch" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key as keyof typeof form] as boolean}
                onChange={e => update(key, e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
          <p className="text-xs text-gray-400 pt-1">Veröffentlichung über API-Integration (in Vorbereitung).</p>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors">
            {loading ? "Wird erstellt…" : "Inserat erstellen"}
          </button>
        </div>
      </form>
    </div>
  );
}
