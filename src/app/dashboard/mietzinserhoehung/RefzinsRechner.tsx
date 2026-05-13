"use client";

import { useState } from "react";

const CURRENT_REFZINS = 1.75; // SNB Referenzzinssatz (aktuell)

export default function RefzinsRechner() {
  const [altZins, setAltZins] = useState("1.75");
  const [neuZins, setNeuZins] = useState("1.75");
  const [aktuellerMietzins, setAktuellerMietzins] = useState("");
  const [inflation, setInflation] = useState("0.0");
  const [kostenSteigerung, setKostenSteigerung] = useState("0.0");
  const [open, setOpen] = useState(false);

  const alt = parseFloat(altZins) || 0;
  const neu = parseFloat(neuZins) || 0;
  const miete = parseFloat(aktuellerMietzins) || 0;
  const infl = parseFloat(inflation) || 0;
  const kosten = parseFloat(kostenSteigerung) || 0;

  const zinsDiff = neu - alt;
  const zinsAenderungProzent = (zinsDiff / 0.25) * 3;
  const inflationsAnteil = infl * 0.4;
  const gesamtProzent = zinsAenderungProzent + inflationsAnteil + kosten;
  const maximaleAenderung = miete > 0 ? (miete * gesamtProzent) / 100 : null;
  const neuerMietzins = miete > 0 ? miete + (maximaleAenderung ?? 0) : null;

  const istErhoehung = gesamtProzent > 0;
  const istSenkung = gesamtProzent < 0;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📐</span>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">Referenzzinssatz-Rechner</p>
            <p className="text-xs text-gray-400">Aktueller SNB Referenzzinssatz: <strong>{CURRENT_REFZINS.toFixed(2)}%</strong></p>
          </div>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border">
          <div className="grid md:grid-cols-2 gap-6 mt-5">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Eingaben</h3>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                  Alter Referenzzinssatz (bei Vertragsabschluss) %
                </label>
                <input
                  type="number" step="0.25" min="0" max="10"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
                  value={altZins}
                  onChange={e => setAltZins(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                  Neuer Referenzzinssatz (aktuell) %
                </label>
                <input
                  type="number" step="0.25" min="0" max="10"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
                  value={neuZins}
                  onChange={e => setNeuZins(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                  Aktueller Nettomietzins (CHF/Monat)
                </label>
                <input
                  type="number" min="0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
                  value={aktuellerMietzins}
                  onChange={e => setAktuellerMietzins(e.target.value)}
                  placeholder="z.B. 1500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                  Teuerung (LIK, letzter Jahresdurchschnitt) %
                </label>
                <input
                  type="number" step="0.1" min="-5" max="20"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
                  value={inflation}
                  onChange={e => setInflation(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                  Allgemeine Kostensteigerung %
                </label>
                <input
                  type="number" step="0.5" min="0" max="5"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
                  value={kostenSteigerung}
                  onChange={e => setKostenSteigerung(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Max. 0.5% pro Jahr gem. OR Art. 269a</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Resultat</h3>

              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Zinsdifferenz</p>
                  <p className={`text-lg font-bold ${zinsDiff > 0 ? "text-red-600" : zinsDiff < 0 ? "text-green-600" : "text-gray-700"}`}>
                    {zinsDiff > 0 ? "+" : ""}{zinsDiff.toFixed(2)}%
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Zinsbedingte Anpassung</p>
                  <p className="text-sm font-semibold text-gray-800">{zinsAenderungProzent > 0 ? "+" : ""}{zinsAenderungProzent.toFixed(2)}%</p>
                  <p className="text-xs text-gray-400">({(zinsDiff / 0.25).toFixed(0)} × 3% pro 0.25%-Schritt)</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Teuerungsanteil (40% von {infl.toFixed(1)}%)</p>
                  <p className="text-sm font-semibold text-gray-800">{inflationsAnteil > 0 ? "+" : ""}{inflationsAnteil.toFixed(2)}%</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Kostensteigerung</p>
                  <p className="text-sm font-semibold text-gray-800">{kosten > 0 ? "+" : ""}{kosten.toFixed(1)}%</p>
                </div>

                <div className={`rounded-xl p-4 border-2 ${
                  istErhoehung ? "bg-red-50 border-red-200" :
                  istSenkung   ? "bg-green-50 border-green-200" :
                  "bg-gray-50 border-gray-200"
                }`}>
                  <p className="text-xs font-semibold uppercase mb-1">
                    {istErhoehung ? "Max. Erhöhung" : istSenkung ? "Senkungsanspruch" : "Keine Änderung"}
                  </p>
                  <p className={`text-2xl font-bold ${istErhoehung ? "text-red-700" : istSenkung ? "text-green-700" : "text-gray-600"}`}>
                    {gesamtProzent > 0 ? "+" : ""}{gesamtProzent.toFixed(2)}%
                  </p>
                  {maximaleAenderung !== null && (
                    <>
                      <p className="text-sm font-semibold mt-2 text-gray-800">
                        CHF {Math.abs(maximaleAenderung).toFixed(2)}/Monat {istErhoehung ? "mehr" : "weniger"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Neuer Mietzins: CHF {neuerMietzins?.toFixed(2)}/Monat
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-700">
                  <strong>Hinweis:</strong> Diese Berechnung basiert auf OR Art. 269a und dient als Richtwert.
                  Massgebend ist der amtliche Referenzzinssatz des SECO/SNB im Formular «Mitteilung an den Mieter».
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
