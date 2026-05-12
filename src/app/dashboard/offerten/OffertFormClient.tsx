"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function OffertFormClient({ ticketId, ticketTitel }: { ticketId: string; ticketTitel: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    betrag: "",
    beschreibung: "",
    verfuegbar_ab: new Date().toISOString().split("T")[0],
    garantie_monate: "",
  });

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.betrag || !form.beschreibung || !form.verfuegbar_ab) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/offerten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          betrag: parseFloat(form.betrag),
          beschreibung: form.beschreibung,
          verfuegbar_ab: form.verfuegbar_ab,
          garantie_monate: form.garantie_monate || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      toast.success("Offerte eingereicht!");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 px-4 py-2 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,42%)] text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Offerte einreichen
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 p-4 bg-white/5 border border-white/10 rounded-xl">
      <p className="text-sm font-semibold text-white">Offerte für: {ticketTitel}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/50 mb-1">Betrag CHF <span className="text-red-400">*</span></label>
          <input
            type="number"
            min="1"
            step="0.01"
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 focus:outline-none focus:border-[hsl(214,76%,49%)] text-white"
            value={form.betrag}
            onChange={e => up("betrag", e.target.value)}
            required
            placeholder="1'200.00"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Verfügbar ab <span className="text-red-400">*</span></label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 focus:outline-none focus:border-[hsl(214,76%,49%)] text-white"
            value={form.verfuegbar_ab}
            onChange={e => up("verfuegbar_ab", e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1">Leistungsbeschreibung <span className="text-red-400">*</span></label>
        <textarea
          className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 focus:outline-none focus:border-[hsl(214,76%,49%)] text-white min-h-[80px] resize-none"
          value={form.beschreibung}
          onChange={e => up("beschreibung", e.target.value)}
          required
          placeholder="Beschreiben Sie die Arbeiten, Material und Zeitaufwand..."
        />
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1">Garantie (Monate)</label>
        <input
          type="number"
          min="0"
          className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 focus:outline-none focus:border-[hsl(214,76%,49%)] text-white"
          value={form.garantie_monate}
          onChange={e => up("garantie_monate", e.target.value)}
          placeholder="12"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,42%)] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? "Wird eingereicht…" : "Offerte verbindlich einreichen"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 bg-white/5 text-white/60 text-sm rounded-lg hover:bg-white/10 transition-colors"
        >
          Abbrechen
        </button>
      </div>
      <p className="text-xs text-white/30">Offerten sind nach Einreichung verbindlich und können nicht mehr geändert werden.</p>
    </form>
  );
}
