"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Liegenschaft = { id: string; name: string; strasse: string; hausnummer: string; plz: string; ort: string };

export default function JahresberichtPage() {
  const supabase = createClient();
  const [liegenschaften, setLiegenschaften] = useState<Liegenschaft[]>([]);
  const [selectedLg, setSelectedLg] = useState("");
  const [jahr, setJahr] = useState(new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("liegenschaften")
        .select("id,name,strasse,hausnummer,plz,ort")
        .eq("verwalter_id", user.id)
        .order("name");
      if (data) setLiegenschaften(data);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLg) { toast.error("Bitte eine Liegenschaft auswählen"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/jahresbericht", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liegenschaft_id: selectedLg, jahr }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fehler bei PDF-Generierung");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const lg = liegenschaften.find(l => l.id === selectedLg);
      a.download = `Jahresbericht_${jahr}_${(lg?.name ?? "Liegenschaft").replace(/\s/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Jahresbericht erstellt und heruntergeladen");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const inp = "w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 focus:outline-none focus:border-[hsl(214,76%,49%)] text-white";

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Eigentümer-Jahresbericht</h1>
        <p className="text-white/50 text-sm mt-1">
          Automatischer PDF-Bericht mit Erfolgsrechnung, Zahlungsquote, Wohnungsübersicht und NK-Abrechnungen.
        </p>
      </div>

      <div className="card p-5 space-y-2">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Enthaltene Angaben</h3>
        <ul className="space-y-1.5">
          {[
            "Bruttomietertrag Soll vs. Ist (Zahlungsquote %)",
            "Nettoeinkommen (Einnahmen – Ausgaben)",
            "Monatlicher Cashflow-Verlauf",
            "Wohnungsübersicht mit Mietzins und Status",
            "Nebenkostenabrechnungen des Jahres",
            "Automatisch aus Buchhaltungsdaten befüllt",
          ].map(item => (
            <li key={item} className="flex items-center gap-2 text-sm text-white/70">
              <span className="text-emerald-400 flex-shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={generate} className="card p-5 space-y-4">
        <div>
          <label className="block text-xs text-white/50 mb-1">Liegenschaft <span className="text-red-400">*</span></label>
          <select
            className={inp}
            value={selectedLg}
            onChange={e => setSelectedLg(e.target.value)}
            required
          >
            <option value="">– Liegenschaft auswählen –</option>
            {liegenschaften.map(lg => (
              <option key={lg.id} value={lg.id}>
                {lg.name} · {lg.strasse} {lg.hausnummer}, {lg.plz} {lg.ort}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1">Berichtsjahr <span className="text-red-400">*</span></label>
          <select
            className={inp}
            value={jahr}
            onChange={e => setJahr(parseInt(e.target.value))}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !selectedLg}
          className="w-full py-2.5 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,42%)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "PDF wird generiert…" : "Jahresbericht als PDF herunterladen"}
        </button>
      </form>
    </div>
  );
}
