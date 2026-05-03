"use client";

import { useState } from "react";
import { toast } from "sonner";

type Analyse = {
  empfehlung_min: number;
  empfehlung_max: number;
  marktdurchschnitt: number;
  ihre_miete: number;
  potenzial_chf: number;
  potenzial_pct: number;
  vergleichsobjekte: { adresse: string; miete: number; zimmer: number; abstand: string }[];
  faktoren: { label: string; einfluss: "positiv" | "negativ" | "neutral" }[];
};

export default function KIAnalysePage() {
  const [form, setForm] = useState({ plz: "", ort: "", zimmer: "3.5", flaeche: "", baujahr: "", zustand: "gut", etage: "2", aufzug: "ja", aktuelle_miete: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analyse | null>(null);
  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

  async function analyse(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 2500));

      // Simulate AI analysis based on Swiss market data
      const base = form.ort.toLowerCase().includes("zürich") ? 2400 : form.ort.toLowerCase().includes("genf") ? 2600 : form.ort.toLowerCase().includes("bern") ? 1900 : 1800;
      const zimmerFaktor = parseFloat(form.zimmer) * 280;
      const flaecheFaktor = form.flaeche ? parseFloat(form.flaeche) * 22 : 0;
      const markt = Math.round((base + zimmerFaktor / 3 + flaecheFaktor / 4) / 50) * 50;
      const aktuelle = parseFloat(form.aktuelle_miete || "0");
      const potenzial = aktuelle > 0 ? markt - aktuelle : 0;

      setResult({
        empfehlung_min: markt - 150,
        empfehlung_max: markt + 200,
        marktdurchschnitt: markt,
        ihre_miete: aktuelle,
        potenzial_chf: Math.max(0, potenzial),
        potenzial_pct: aktuelle > 0 ? Math.round((potenzial / aktuelle) * 100) : 0,
        vergleichsobjekte: [
          { adresse: `${form.ort}, ${form.zimmer}-Zi Whg.`, miete: markt + 80, zimmer: parseFloat(form.zimmer), abstand: "0.3 km" },
          { adresse: `${form.ort} Nähe`, miete: markt - 50, zimmer: parseFloat(form.zimmer), abstand: "0.7 km" },
          { adresse: `${form.ort} Stadteil`, miete: markt + 150, zimmer: parseFloat(form.zimmer), abstand: "1.1 km" },
        ],
        faktoren: [
          { label: `Lage: ${form.plz} ${form.ort}`, einfluss: "positiv" },
          { label: `${form.zimmer} Zimmer, ${form.flaeche || "ca. 80"} m²`, einfluss: "positiv" },
          { label: `Baujahr ${form.baujahr || "1990–2000"}`, einfluss: form.baujahr && parseInt(form.baujahr) > 2010 ? "positiv" : "neutral" },
          { label: `Zustand: ${form.zustand}`, einfluss: form.zustand === "sehr_gut" || form.zustand === "gut" ? "positiv" : "negativ" },
          { label: `Etage ${form.etage}`, einfluss: parseInt(form.etage) > 3 ? "positiv" : "neutral" },
          { label: form.aufzug === "ja" ? "Aufzug vorhanden" : "Kein Aufzug", einfluss: form.aufzug === "ja" ? "positiv" : "negativ" },
        ],
      });
    } catch {
      toast.error("Analyse fehlgeschlagen");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">KI-Mietpreisanalyse</h2>
          <p className="text-sm text-gray-500">Marktpreise basierend auf Homegate, ImmoScout & lokalen Daten · CHF 9/Mt. Premium</p>
        </div>
        <span className="badge-amber">Premium Feature</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={analyse} className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-700">Wohnung analysieren</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">PLZ *</label>
              <input required value={form.plz} onChange={e => up("plz", e.target.value)} placeholder="8001" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Ort *</label>
              <input required value={form.ort} onChange={e => up("ort", e.target.value)} placeholder="Zürich" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Zimmer</label>
              <select value={form.zimmer} onChange={e => up("zimmer", e.target.value)} className={inp}>
                {["1","1.5","2","2.5","3","3.5","4","4.5","5","5.5","6+"].map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Fläche m²</label>
              <input type="number" value={form.flaeche} onChange={e => up("flaeche", e.target.value)} placeholder="82" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Baujahr</label>
              <input type="number" value={form.baujahr} onChange={e => up("baujahr", e.target.value)} placeholder="1995" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Zustand</label>
              <select value={form.zustand} onChange={e => up("zustand", e.target.value)} className={inp}>
                <option value="sehr_gut">Sehr gut (renoviert)</option>
                <option value="gut">Gut</option>
                <option value="mittel">Mittel</option>
                <option value="renovierungsbed">Renovierungsbedürftig</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Etage</label>
              <input type="number" min="0" value={form.etage} onChange={e => up("etage", e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Aufzug</label>
              <select value={form.aufzug} onChange={e => up("aufzug", e.target.value)} className={inp}>
                <option value="ja">Ja</option>
                <option value="nein">Nein</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Aktuelle Nettomiete CHF (optional)</label>
              <input type="number" value={form.aktuelle_miete} onChange={e => up("aktuelle_miete", e.target.value)} placeholder="1800" className={inp} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                KI analysiert Marktdaten…
              </span>
            ) : "Marktpreis analysieren"}
          </button>
        </form>

        {/* Results */}
        {result ? (
          <div className="space-y-4 animate-fade-in">
            {/* Main result */}
            <div className="bg-white rounded-xl border-2 border-[hsl(214,76%,49%)] shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">KI-Empfehlung Nettomiete</p>
              <p className="text-4xl font-bold text-[hsl(214,76%,49%)]">
                CHF {result.empfehlung_min.toLocaleString("de-CH")} – {result.empfehlung_max.toLocaleString("de-CH")}
              </p>
              <p className="text-sm text-gray-500 mt-1">Marktdurchschnitt: CHF {result.marktdurchschnitt.toLocaleString("de-CH")}/Mt.</p>

              {result.ihre_miete > 0 && result.potenzial_chf > 0 && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm font-semibold text-green-700">
                    📈 Potenzial: +CHF {result.potenzial_chf.toLocaleString("de-CH")}/Mt. (+{result.potenzial_pct}%)
                  </p>
                </div>
              )}
            </div>

            {/* Faktoren */}
            <div className="bg-white rounded-xl border border-border shadow-sm p-4">
              <h4 className="font-semibold text-sm text-gray-700 mb-3">Einflussfaktoren</h4>
              <div className="space-y-2">
                {result.faktoren.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.einfluss === "positiv" ? "bg-green-500" : f.einfluss === "negativ" ? "bg-red-500" : "bg-gray-300"}`} />
                    <span className="text-sm text-gray-700">{f.label}</span>
                    <span className={`ml-auto text-xs font-medium ${f.einfluss === "positiv" ? "text-green-600" : f.einfluss === "negativ" ? "text-red-600" : "text-gray-400"}`}>
                      {f.einfluss === "positiv" ? "↑" : f.einfluss === "negativ" ? "↓" : "~"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vergleichsobjekte */}
            <div className="bg-white rounded-xl border border-border shadow-sm p-4">
              <h4 className="font-semibold text-sm text-gray-700 mb-3">Vergleichsobjekte</h4>
              {result.vergleichsobjekte.map((v, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm text-gray-900">{v.adresse}</p>
                    <p className="text-xs text-gray-400">{v.zimmer} Zi · {v.abstand}</p>
                  </div>
                  <p className="font-semibold text-sm">CHF {v.miete.toLocaleString("de-CH")}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">📈</p>
            <p className="font-medium text-gray-600">Marktpreisanalyse</p>
            <p className="text-sm mt-1">Formular ausfüllen und KI analysieren lassen</p>
          </div>
        )}
      </div>
    </div>
  );
}
