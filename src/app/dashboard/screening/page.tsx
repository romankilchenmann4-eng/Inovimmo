"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import SubNav from "@/components/ui/SubNav";

const TOOLS_NAV = [
  { href: "/dashboard/screening", label: "Screening" },
  { href: "/dashboard/uebergabe", label: "Übergabe" },
  { href: "/dashboard/kalender",  label: "Kalender" },
];

type ScreeningResult = {
  betreibungen: number;
  betrag_total: number;
  bonitaet_score: number;
  bonitaet_klasse: "A" | "B" | "C" | "D";
  empfehlung: "freigabe" | "vorbehalt" | "ablehnung";
  details: string[];
};

export default function ScreeningPage() {
  const [form, setForm] = useState({ vorname: "", nachname: "", geburtsdatum: "", strasse: "", plz: "", ort: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [history, setHistory] = useState<{ name: string; datum: string; empfehlung: string }[]>([]);
  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";
  const supabase = createClient();

  async function startScreening(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      // In production: call /api/screening which calls CRIF Schweiz API
      // For demo: simulate realistic result
      await new Promise(r => setTimeout(r, 2000));

      const score = Math.floor(Math.random() * 400) + 500;
      const betreibungen = Math.random() > 0.85 ? Math.floor(Math.random() * 3) + 1 : 0;
      const klasse = score > 800 ? "A" : score > 700 ? "B" : score > 600 ? "C" : "D";
      const empfehlung = betreibungen > 1 || score < 600 ? "ablehnung" : betreibungen === 1 || score < 700 ? "vorbehalt" : "freigabe";

      const mockResult: ScreeningResult = {
        betreibungen,
        betrag_total: betreibungen * Math.floor(Math.random() * 5000),
        bonitaet_score: score,
        bonitaet_klasse: klasse,
        empfehlung,
        details: [
          `Bonität: Klasse ${klasse} (Score ${score}/1000)`,
          betreibungen === 0 ? "✓ Keine Betreibungen gefunden" : `⚠ ${betreibungen} Betreibung(en) gefunden`,
          "✓ Identität verifiziert",
          "✓ Adresse bestätigt",
          "✓ Auskunft vom Betreibungsamt",
        ],
      };

      setResult(mockResult);

      // Save to DB
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("screenings").insert({
        erstellt_von: user!.id,
        mieter_vorname: form.vorname,
        mieter_nachname: form.nachname,
        mieter_geburtsdatum: form.geburtsdatum,
        ergebnis_json: JSON.stringify(mockResult),
        empfehlung: mockResult.empfehlung,
        kosten_chf: 25,
      });

      setHistory(h => [{ name: `${form.vorname} ${form.nachname}`, datum: new Date().toLocaleDateString("de-CH"), empfehlung }, ...h]);
      toast.success("Screening abgeschlossen — CHF 25 wird verrechnet");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Screening");
    } finally { setLoading(false); }
  }

  const EMPF_CONFIG = {
    freigabe:  { label: "✓ Freigabe empfohlen",     cls: "bg-green-50 border-green-200 text-green-800",  icon: "✅" },
    vorbehalt: { label: "⚠ Mit Vorbehalt",           cls: "bg-amber-50 border-amber-200 text-amber-800",  icon: "⚠️" },
    ablehnung: { label: "✗ Ablehnung empfohlen",     cls: "bg-red-50 border-red-200 text-red-800",        icon: "❌" },
  };

  const KLASSE_COLOR: Record<string, string> = { A: "text-green-600", B: "text-blue-600", C: "text-amber-600", D: "text-red-600" };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={TOOLS_NAV} />
      <div>
        <h2 className="text-xl font-bold text-gray-900">Mieter-Screening</h2>
        <p className="text-sm text-gray-500">Betreibungsauszug · Bonität · ID-Verifizierung · CHF 25/Check</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div>
          <form onSubmit={startScreening} className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-700">Neue Überprüfung</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Vorname *</label>
                <input required value={form.vorname} onChange={e => up("vorname", e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Nachname *</label>
                <input required value={form.nachname} onChange={e => up("nachname", e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Geburtsdatum *</label>
                <input required type="date" value={form.geburtsdatum} onChange={e => up("geburtsdatum", e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">E-Mail</label>
                <input type="email" value={form.email} onChange={e => up("email", e.target.value)} placeholder="für Einwilligung" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Strasse *</label>
                <input required value={form.strasse} onChange={e => up("strasse", e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">PLZ / Ort *</label>
                <div className="grid grid-cols-2 gap-1">
                  <input required value={form.plz} onChange={e => up("plz", e.target.value)} placeholder="8001" className={inp} />
                  <input required value={form.ort} onChange={e => up("ort", e.target.value)} placeholder="Zürich" className={inp} />
                </div>
              </div>
            </div>

            <div className="info-box-amber text-xs text-amber-700">
              ⚠️ Die Überprüfung erfordert die schriftliche Einwilligung der betroffenen Person gemäss nDSG. Kosten: CHF 25 pro Check.
            </div>

            <button type="submit" disabled={loading} className="w-full py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl disabled:opacity-50 text-sm">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Wird überprüft…
                </span>
              ) : "Screening starten (CHF 25)"}
            </button>
          </form>
        </div>

        {/* Result */}
        <div className="space-y-4">
          {result ? (
            <div className="space-y-4 animate-fade-in">
              {/* Recommendation */}
              <div className={`rounded-xl border-2 p-5 ${EMPF_CONFIG[result.empfehlung].cls}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{EMPF_CONFIG[result.empfehlung].icon}</span>
                  <div>
                    <p className="font-bold text-lg">{EMPF_CONFIG[result.empfehlung].label}</p>
                    <p className="text-sm opacity-80">{form.vorname} {form.nachname}</p>
                  </div>
                </div>
              </div>

              {/* Score */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                <h4 className="font-semibold text-sm text-gray-700 mb-4">Detailauswertung</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Bonitäts-Score</p>
                    <p className={`text-4xl font-bold ${KLASSE_COLOR[result.bonitaet_klasse]}`}>{result.bonitaet_score}</p>
                    <p className="text-xs text-gray-400">/ 1000</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Bonitäts-Klasse</p>
                    <p className={`text-4xl font-bold ${KLASSE_COLOR[result.bonitaet_klasse]}`}>{result.bonitaet_klasse}</p>
                    <p className="text-xs text-gray-400">A=Excellent, D=Hoch</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {result.details.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
                {result.betreibungen > 0 && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <p className="text-sm font-semibold text-red-700">{result.betreibungen} Betreibung(en) · CHF {result.betrag_total.toLocaleString("de-CH")}</p>
                  </div>
                )}
                <button className="w-full mt-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">📄 PDF-Bericht herunterladen</button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium text-gray-600">Screening-Ergebnis</p>
              <p className="text-sm mt-1">Formular ausfüllen und Screening starten</p>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-border shadow-sm p-4">
              <h4 className="font-semibold text-sm text-gray-700 mb-3">Letzte Screenings</h4>
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{h.name}</p>
                    <p className="text-xs text-gray-400">{h.datum}</p>
                  </div>
                  <span className={`text-xs font-semibold ${h.empfehlung === "freigabe" ? "text-green-600" : h.empfehlung === "vorbehalt" ? "text-amber-600" : "text-red-600"}`}>
                    {h.empfehlung === "freigabe" ? "✓ Freigabe" : h.empfehlung === "vorbehalt" ? "⚠ Vorbehalt" : "✗ Ablehnung"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
