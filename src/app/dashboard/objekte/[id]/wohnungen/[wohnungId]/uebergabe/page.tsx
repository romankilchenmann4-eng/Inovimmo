"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const RAEUME = [
  "Eingangsdiele", "Wohnzimmer", "Küche", "Bad/WC", "Schlafzimmer",
  "Kinderzimmer", "Balkon/Terrasse", "Keller", "Estrich",
];

const ZUSTAND_OPT = ["Einwandfrei", "Gut", "Befriedigend", "Mangelhaft"];

type Raum = {
  name: string;
  zustand: string;
  bemerkung: string;
};

export default function UebergabePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const objektId = params.id as string;
  const wohnungId = params.wohnungId as string;

  const [typ, setTyp] = useState<"einzug" | "auszug">("einzug");
  const [datum, setDatum] = useState("");
  const [schluessel, setSchluessel] = useState("");
  const [gesamtzustand, setGesamtzustand] = useState("Gut");
  const [bemerkungen, setBemerkungen] = useState("");
  const [raeume, setRaeume] = useState<Raum[]>(
    RAEUME.map(name => ({ name, zustand: "Gut", bemerkung: "" }))
  );
  const [loading, setLoading] = useState(false);

  function updateRaum(i: number, field: keyof Raum, value: string) {
    setRaeume(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const { error } = await supabase.from("uebergabeprotokolle").insert({
        wohnung_id: wohnungId,
        erstellt_von: user.id,
        typ,
        datum: datum || null,
        anzahl_schluessel: schluessel ? parseInt(schluessel) : null,
        schluessel_anzahl: schluessel ? parseInt(schluessel) : null,
        gesamtzustand,
        zustand_json: JSON.stringify(raeume),
        notizen_allgemein: bemerkungen || null,
      });
      if (error) throw error;

      toast.success("Protokoll gespeichert");
      router.push(`/dashboard/objekte/${objektId}/wohnungen/${wohnungId}`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-6">
      <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
        ← Zurück
      </button>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Übergabeprotokoll</h1>
        <p className="text-sm text-gray-400 mt-1">Wohnungszustand bei Ein- oder Auszug dokumentieren.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Kopfdaten */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Allgemein</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Protokolltyp</label>
              <select
                value={typ}
                onChange={e => setTyp(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="einzug">Einzugsprotokoll</option>
                <option value="auszug">Auszugsprotokoll</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Datum</label>
              <input
                type="date" required value={datum}
                onChange={e => setDatum(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Schlüssel übergeben (Anzahl)</label>
              <input
                type="number" min="0" value={schluessel}
                onChange={e => setSchluessel(e.target.value)}
                placeholder="3"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Gesamtzustand</label>
              <select
                value={gesamtzustand}
                onChange={e => setGesamtzustand(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {ZUSTAND_OPT.map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Räume */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Räume</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {raeume.map((r, i) => (
              <div key={r.name} className="px-5 py-3.5 grid grid-cols-3 gap-3 items-center">
                <p className="text-sm font-medium text-gray-700">{r.name}</p>
                <select
                  value={r.zustand}
                  onChange={e => updateRaum(i, "zustand", e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {ZUSTAND_OPT.map(z => <option key={z}>{z}</option>)}
                </select>
                <input
                  value={r.bemerkung}
                  onChange={e => updateRaum(i, "bemerkung", e.target.value)}
                  placeholder="Bemerkung…"
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Allgemeine Bemerkungen */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Bemerkungen</h2>
          <textarea
            rows={3} value={bemerkungen}
            onChange={e => setBemerkungen(e.target.value)}
            placeholder="Weitere Bemerkungen zum Zustand der Wohnung…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors">
            {loading ? "Wird gespeichert…" : "Protokoll speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
