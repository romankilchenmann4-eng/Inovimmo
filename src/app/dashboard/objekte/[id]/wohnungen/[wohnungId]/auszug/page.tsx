"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function AuszugPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const objektId = params.id as string;
  const wohnungId = params.wohnungId as string;

  const [loading, setLoading] = useState(false);
  const [mieter, setMieter] = useState<any[]>([]);
  const [form, setForm] = useState({
    auszugsdatum: "",
    zustandsnotiz: "",
    kaution_zurueck: false,
    kaution_betrag: "",
    schluessel_zurueck: false,
  });

  useEffect(() => {
    supabase
      .from("mietverhaeltnisse")
      .select("mieter:mieter_id(id, vorname, nachname, email)")
      .eq("wohnung_id", wohnungId)
      .then(({ data }) => setMieter((data as any) || []));
  }, [wohnungId]);

  function update(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      // Auszug-Eintrag erstellen
      const { error: aErr } = await supabase.from("auszuege").insert({
        wohnung_id: wohnungId,
        erstellt_von: user.id,
        auszugsdatum: form.auszugsdatum,
        zustandsnotiz: form.zustandsnotiz || null,
        kaution_zurueck: form.kaution_zurueck,
        kaution_betrag: form.kaution_betrag ? parseFloat(form.kaution_betrag) : null,
        schluessel_zurueck: form.schluessel_zurueck,
        erledigt: false,
      });
      if (aErr) throw aErr;

      // Mietverhältnisse beenden (mietende setzen)
      await supabase
        .from("mietverhaeltnisse")
        .update({ mietende: form.auszugsdatum })
        .eq("wohnung_id", wohnungId);

      // Wohnungsstatus auf leer setzen
      await supabase
        .from("wohnungen")
        .update({ status: "leer" })
        .eq("id", wohnungId);

      toast.success("Auszug erfasst — Wohnung auf «leer» gesetzt");
      router.push(`/dashboard/objekte/${objektId}/wohnungen/${wohnungId}`);
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Auszug erfassen</h1>
        <p className="text-sm text-gray-500 mt-1">Auszug dokumentieren und Wohnung als leer markieren.</p>
      </div>

      {/* Aktuelle Mieter */}
      {mieter.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Aktuelle Mieter — werden bei Auszug abgemeldet</p>
          {mieter.map((mv: any, i: number) => (
            <p key={i} className="text-sm text-amber-700">
              {mv.mieter?.vorname} {mv.mieter?.nachname}
              {mv.mieter?.email ? ` · ${mv.mieter.email}` : ""}
            </p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Auszugs-Details</h2>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Auszugsdatum *</label>
            <input
              type="date" required value={form.auszugsdatum}
              onChange={e => update("auszugsdatum", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Zustandsnotizen</label>
            <textarea
              rows={4} value={form.zustandsnotiz}
              onChange={e => update("zustandsnotiz", e.target.value)}
              placeholder="Schäden, Reinigungszustand, Bemerkungen…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Rückgabe & Kaution</h2>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.schluessel_zurueck}
              onChange={e => update("schluessel_zurueck", e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-700">🔑 Schlüssel zurückgegeben</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.kaution_zurueck}
              onChange={e => update("kaution_zurueck", e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-700">💰 Kaution wird zurückerstattet</span>
          </label>

          {form.kaution_zurueck && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Kautionsbetrag CHF</label>
              <input
                type="number" min="0" step="0.01" value={form.kaution_betrag}
                onChange={e => update("kaution_betrag", e.target.value)}
                placeholder="2400.00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ Nach dem Speichern wird der Wohnungsstatus auf <strong>«leer»</strong> gesetzt und das Mietverhältnis beendet.
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            {loading ? "Wird gespeichert…" : "Auszug erfassen & Wohnung leeren"}
          </button>
        </div>
      </form>
    </div>
  );
}
