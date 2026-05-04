"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const RAEUME = [
  { id: "eingang", label: "Eingang / Korridor", items: ["Boden", "Wände", "Decke", "Türe", "Briefkasten"] },
  { id: "wohnzimmer", label: "Wohnzimmer", items: ["Boden", "Wände", "Decke", "Fenster", "Türe", "Steckdosen", "Lichtschalter"] },
  { id: "kueche", label: "Küche", items: ["Boden", "Wände", "Küchenzeile", "Herd/Backofen", "Geschirrspüler", "Kühlschrank", "Dunstabzug", "Waschbecken"] },
  { id: "badezimmer", label: "Badezimmer", items: ["Boden", "Wände", "Dusche/Badewanne", "WC", "Lavabo", "Spiegel", "Lüftung"] },
  { id: "schlafzimmer", label: "Schlafzimmer", items: ["Boden", "Wände", "Decke", "Fenster", "Türe", "Einbauschrank"] },
  { id: "keller", label: "Keller / Estrich", items: ["Boden", "Wände", "Tür", "Beleuchtung"] },
];

type ZustandWert = "gut" | "maengel" | "n/a";
type Zustand = Record<string, Record<string, { wert: ZustandWert; notiz: string }>>;

export default function WohnungsUebergabePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [meta, setMeta] = useState({
    typ: "auszug" as "einzug" | "auszug",
    wohnung_bezeichnung: "",
    mieter_name: "",
    datum: new Date().toISOString().split("T")[0],
    zaehlerstand_strom: "",
    zaehlerstand_wasser: "",
    anzahl_schluessel: "2",
    notizen_allgemein: "",
  });

  const [zustand, setZustand] = useState<Zustand>(() => {
    const init: Zustand = {};
    RAEUME.forEach(r => {
      init[r.id] = {};
      r.items.forEach(item => { init[r.id][item] = { wert: "gut", notiz: "" }; });
    });
    return init;
  });

  const [currentRaum, setCurrentRaum] = useState(0);
  const [unterschrift, setUnterschrift] = useState(false);

  function setItemZustand(raumId: string, item: string, wert: ZustandWert) {
    setZustand(z => ({ ...z, [raumId]: { ...z[raumId], [item]: { ...z[raumId][item], wert } } }));
  }

  function setItemNotiz(raumId: string, item: string, notiz: string) {
    setZustand(z => ({ ...z, [raumId]: { ...z[raumId], [item]: { ...z[raumId][item], notiz } } }));
  }

  const maengelCount = Object.values(zustand).flatMap(r => Object.values(r)).filter(v => v.wert === "maengel").length;

  async function abschliessen() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("uebergabeprotokolle").insert({
        erstellt_von: user!.id,
        typ: meta.typ,
        wohnung_bezeichnung: meta.wohnung_bezeichnung,
        mieter_name: meta.mieter_name,
        datum: meta.datum,
        zaehlerstand_strom: meta.zaehlerstand_strom,
        zaehlerstand_wasser: meta.zaehlerstand_wasser,
        anzahl_schluessel: parseInt(meta.anzahl_schluessel),
        notizen_allgemein: meta.notizen_allgemein,
        zustand_json: JSON.stringify(zustand),
        maengel_anzahl: maengelCount,
        unterschrift_mieter: unterschrift,
        status: "abgeschlossen",
      });
      toast.success("Übergabeprotokoll gespeichert! PDF wird generiert.");
      router.push("/dashboard/uebergabe");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setLoading(false); }
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Digitale Wohnungsübergabe</h2>
        <p className="text-sm text-gray-500">Schritt {step} von 4 · CHF 12 bei Abschluss</p>
        {/* Progress */}
        <div className="flex gap-2 mt-3">
          {["Grunddaten", "Räume prüfen", "Zähler & Schlüssel", "Unterschrift"].map((s, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < step ? "bg-[hsl(214,76%,49%)]" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>

      {/* Step 1: Grunddaten */}
      {step === 1 && (
        <div className="form-section space-y-4">
          <h3 className="font-semibold text-gray-700">Grunddaten</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Typ</label>
              <div className="grid grid-cols-2 gap-2">
                {["einzug", "auszug"].map(t => (
                  <label key={t} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer ${meta.typ === t ? "border-[hsl(214,76%,49%)] bg-blue-50" : "border-gray-200"}`}>
                    <input type="radio" name="typ" value={t} checked={meta.typ === t} onChange={() => setMeta(m => ({ ...m, typ: t as "einzug"|"auszug" }))} />
                    <span className="font-medium text-sm">{t === "einzug" ? "🔑 Einzug" : "🚪 Auszug"}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Wohnung *</label>
              <input required value={meta.wohnung_bezeichnung} onChange={e => setMeta(m => ({ ...m, wohnung_bezeichnung: e.target.value }))} placeholder="z.B. 3.OG links" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Datum</label>
              <input type="date" value={meta.datum} onChange={e => setMeta(m => ({ ...m, datum: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Mieter / Mieterin *</label>
              <input required value={meta.mieter_name} onChange={e => setMeta(m => ({ ...m, mieter_name: e.target.value }))} placeholder="Vor- und Nachname" className={inp} />
            </div>
          </div>
          <button onClick={() => setStep(2)} disabled={!meta.wohnung_bezeichnung || !meta.mieter_name} className="w-full py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl disabled:opacity-50 text-sm">
            Weiter →
          </button>
        </div>
      )}

      {/* Step 2: Räume */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Raum Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {RAEUME.map((r, i) => {
              const hasMaengel = Object.values(zustand[r.id] ?? {}).some(v => v.wert === "maengel");
              return (
                <button key={r.id} onClick={() => setCurrentRaum(i)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${currentRaum === i ? "bg-[hsl(214,76%,49%)] text-white" : "bg-gray-100 text-gray-600"} ${hasMaengel ? "ring-2 ring-red-300" : ""}`}>
                  {r.label.split(" ")[0]}
                  {hasMaengel && " ⚠"}
                </button>
              );
            })}
          </div>

          <div className="form-section">
            <h3 className="font-semibold text-gray-700 mb-4">{RAEUME[currentRaum].label}</h3>
            <div className="space-y-3">
              {RAEUME[currentRaum].items.map(item => {
                const val = zustand[RAEUME[currentRaum].id]?.[item];
                return (
                  <div key={item}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item}</span>
                      <div className="flex gap-1">
                        {(["gut", "maengel", "n/a"] as ZustandWert[]).map(w => (
                          <button key={w} onClick={() => setItemZustand(RAEUME[currentRaum].id, item, w)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${val?.wert === w ? w === "gut" ? "bg-green-500 text-white" : w === "maengel" ? "bg-red-500 text-white" : "bg-gray-400 text-white" : "bg-gray-100 text-gray-500"}`}>
                            {w === "gut" ? "✓ Gut" : w === "maengel" ? "⚠ Mängel" : "n/a"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {val?.wert === "maengel" && (
                      <input placeholder="Mangel beschreiben…" value={val.notiz}
                        onChange={e => setItemNotiz(RAEUME[currentRaum].id, item, e.target.value)}
                        className="w-full px-3 py-1.5 border border-red-200 rounded-lg text-xs focus:outline-none focus:border-red-400 bg-red-50" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {maengelCount > 0 && (
            <div className="info-box-amber text-xs text-amber-700">⚠ {maengelCount} Mängel erfasst — werden im Protokoll aufgeführt</div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">← Zurück</button>
            <button onClick={() => setStep(3)} className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm">Weiter →</button>
          </div>
        </div>
      )}

      {/* Step 3: Zähler & Schlüssel */}
      {step === 3 && (
        <div className="form-section space-y-4">
          <h3 className="font-semibold text-gray-700">Zähler & Schlüssel</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Stromzähler (kWh)</label>
              <input type="number" value={meta.zaehlerstand_strom} onChange={e => setMeta(m => ({ ...m, zaehlerstand_strom: e.target.value }))} placeholder="12345" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Wasserzähler (m³)</label>
              <input type="number" value={meta.zaehlerstand_wasser} onChange={e => setMeta(m => ({ ...m, zaehlerstand_wasser: e.target.value }))} placeholder="456" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Schlüssel zurück</label>
              <input type="number" min="0" value={meta.anzahl_schluessel} onChange={e => setMeta(m => ({ ...m, anzahl_schluessel: e.target.value }))} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Allgemeine Notizen</label>
            <textarea rows={3} value={meta.notizen_allgemein} onChange={e => setMeta(m => ({ ...m, notizen_allgemein: e.target.value }))} placeholder="Weitere Bemerkungen…" className={`${inp} resize-none`} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">← Zurück</button>
            <button onClick={() => setStep(4)} className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm">Weiter →</button>
          </div>
        </div>
      )}

      {/* Step 4: Zusammenfassung + Unterschrift */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="form-section">
            <h3 className="font-semibold text-gray-700 mb-4">Zusammenfassung</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400">Typ</p><p className="font-medium">{meta.typ === "einzug" ? "🔑 Einzug" : "🚪 Auszug"}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400">Wohnung</p><p className="font-medium">{meta.wohnung_bezeichnung}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400">Mieter</p><p className="font-medium">{meta.mieter_name}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400">Datum</p><p className="font-medium">{new Date(meta.datum).toLocaleDateString("de-CH")}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400">Mängel</p><p className={`font-medium ${maengelCount > 0 ? "text-red-600" : "text-green-600"}`}>{maengelCount === 0 ? "✓ Keine" : `⚠ ${maengelCount}`}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400">Schlüssel</p><p className="font-medium">{meta.anzahl_schluessel} Stück</p></div>
            </div>
          </div>

          {/* Signature */}
          <div className="form-section">
            <h3 className="font-semibold text-gray-700 mb-3">Bestätigung</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={unterschrift} onChange={e => setUnterschrift(e.target.checked)} className="mt-0.5 w-4 h-4" />
              <p className="text-sm text-gray-700">
                Ich, <strong>{meta.mieter_name}</strong>, bestätige die Richtigkeit dieses Übergabeprotokolls und habe alle Räume geprüft.
              </p>
            </label>
          </div>

          <div className="info-box-blue text-xs text-blue-700">
            📄 Nach Abschluss wird automatisch ein PDF-Protokoll generiert und per E-Mail an Verwalter und Mieter versendet.
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">← Zurück</button>
            <button onClick={abschliessen} disabled={!unterschrift || loading} className="flex-1 py-2.5 bg-green-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
              {loading ? "Wird gespeichert…" : "✓ Protokoll abschliessen (CHF 12)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
