"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function EinzugPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const objektId = params.id as string;
  const wohnungId = params.wohnungId as string;

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    vorname: "",
    nachname: "",
    email: "",
    telefon_mobil: "",
    telefon_festnetz: "",
    geburtsdatum: "",
    einzugsdatum: "",
    mietbeginn: "",
    ist_hauptperson: true,
  });

  function update(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      // Mieter anlegen
      const { data: mieter, error: mieterErr } = await supabase
        .from("mieter")
        .insert({
          verwalter_id: user.id,
          vorname: form.vorname,
          nachname: form.nachname,
          email: form.email || null,
          telefon_mobil: form.telefon_mobil || null,
          telefon_festnetz: form.telefon_festnetz || null,
          geburtsdatum: form.geburtsdatum || null,
        })
        .select("id")
        .single();
      if (mieterErr) throw mieterErr;

      // Mietverhältnis anlegen
      const { error: mvErr } = await supabase
        .from("mietverhaeltnisse")
        .insert({
          wohnung_id: wohnungId,
          mieter_id: mieter.id,
          ist_hauptperson: form.ist_hauptperson,
          ist_vertragspartner: form.ist_hauptperson,
          mietbeginn: form.mietbeginn || form.einzugsdatum || null,
        });
      if (mvErr) throw mvErr;

      // Wohnungsstatus auf vermietet setzen
      await supabase
        .from("wohnungen")
        .update({ status: "vermietet" })
        .eq("id", wohnungId);

      toast.success("Einzug erfasst");
      router.push(`/dashboard/objekte/${objektId}/wohnungen/${wohnungId}`);
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Zurück
        </button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Einzug erfassen</h1>
        <p className="text-sm text-gray-500 mt-1">Neuen Mieter anlegen und Mietverhältnis starten.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Mieter-Daten */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Mieter-Daten</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vorname *</label>
              <input
                required value={form.vorname}
                onChange={e => update("vorname", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Anna"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nachname *</label>
              <input
                required value={form.nachname}
                onChange={e => update("nachname", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Muster"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">E-Mail</label>
            <input
              type="email" value={form.email}
              onChange={e => update("email", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="anna@muster.ch"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Telefon Mobil</label>
              <input
                value={form.telefon_mobil}
                onChange={e => update("telefon_mobil", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="+41 79 000 00 00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Telefon Festnetz</label>
              <input
                value={form.telefon_festnetz}
                onChange={e => update("telefon_festnetz", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="+41 44 000 00 00"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Geburtsdatum</label>
            <input
              type="date" value={form.geburtsdatum}
              onChange={e => update("geburtsdatum", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ist_hauptperson}
              onChange={e => update("ist_hauptperson", e.target.checked)}
              className="rounded"
            />
            Hauptmieter / Vertragspartner
          </label>
        </div>

        {/* Mietverhältnis */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Mietverhältnis</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Einzugsdatum *</label>
              <input
                type="date" required value={form.einzugsdatum}
                onChange={e => update("einzugsdatum", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mietbeginn (Vertraglich)</label>
              <input
                type="date" value={form.mietbeginn}
                onChange={e => update("mietbeginn", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
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
            className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            {loading ? "Wird gespeichert…" : "Einzug erfassen"}
          </button>
        </div>
      </form>
    </div>
  );
}
