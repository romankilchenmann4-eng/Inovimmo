'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { berechneErhoehung } from '@/lib/mietzinserhoehung/calc';
import {
  aktualisiereErhoehung,
  neuBerechnen,
  setzeBeheizt,
  loescheErhoehung,
} from '@/lib/mietzinserhoehung/actions';
import {
  REFERENZZINSSATZ_HISTORIE,
  LIK_INDEX,
  getReferenzzinssatz,
  getLikIndex,
  KOSTENSTEIGERUNG_PAUSCHALEN,
} from '@/lib/mietzinserhoehung/data';
import type {
  MietzinsErhoehung,
  PositionMitWohnung,
} from '@/lib/mietzinserhoehung/types';

interface Props {
  erhoehung: MietzinsErhoehung & {
    liegenschaft: {
      id: string;
      name: string;
      strasse: string;
      hausnummer: string;
      plz: string;
      ort: string;
    };
  };
  positionen: PositionMitWohnung[];
}

type TabKey = 'basisdaten' | 'saetze' | 'investition' | 'ergebnis';

// Referenzzinssatz-Änderungen für Dropdown (nur Quartale mit Wechsel)
const RZS_CHANGES = (() => {
  const changes: Array<{ datum: string; zinssatz: number; label: string }> = [];
  let prev = -1;
  for (const entry of REFERENZZINSSATZ_HISTORIE) {
    if (entry.zinssatz !== prev) {
      changes.push({
        datum: entry.datum,
        zinssatz: entry.zinssatz,
        label: `${entry.datum} – ${entry.zinssatz.toFixed(2)}%`,
      });
      prev = entry.zinssatz;
    }
  }
  return changes;
})();

const LIK_OPTIONS = LIK_INDEX.map(entry => ({
  monat: entry.monat,
  index: entry.index,
  label: `${entry.monat} – ${entry.index.toFixed(1)}`,
}));

export function BerechnungForm({ erhoehung: initial, positionen: initialPositionen }: Props) {
  const [erhoehung, setErhoehung] = useState(initial);
  const [positionen, setPositionen] = useState(initialPositionen);
  const [tab, setTab] = useState<TabKey>('basisdaten');
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Gesamtnettomiete für Basis-Berechnung
  const gesamtNettomiete = useMemo(() =>
    positionen.reduce((s, p) => s + Number(p.wohnung?.nettomiete ?? 0), 0),
    [positionen]
  );

  const gesamtNebenkosten = useMemo(() =>
    positionen.reduce((s, p) => s + Number(p.wohnung?.nebenkosten_akonto ?? 0), 0),
    [positionen]
  );

  // Live-Berechnung für Vorschau
  const ergebnis = useMemo(() => berechneErhoehung({
    nettomiete_aktuell: gesamtNettomiete,
    nebenkosten_aktuell: gesamtNebenkosten,
    referenzzinssatz_alt: erhoehung.referenzzinssatz_alt ?? 0,
    referenzzinssatz_neu: erhoehung.referenzzinssatz_neu ?? 0,
    lik_index_alt: erhoehung.lik_index_alt ?? 0,
    lik_index_neu: erhoehung.lik_index_neu ?? 0,
    kostensteigerung_pauschale: erhoehung.kostensteigerung_pauschale ?? 0,
    kostensteigerung_jahre: erhoehung.kostensteigerung_pro_jahr ?? 0,
    investition_total: erhoehung.investition_total ?? 0,
    foerderbeitraege: erhoehung.foerderbeitraege ?? 0,
    wertvermehrend_prozent: erhoehung.wertvermehrend_prozent ?? 100,
    ersatzbeschaffung_1zu1: erhoehung.ersatzbeschaffung_1zu1 ?? 0,
    amortisation_prozent: erhoehung.amortisation_prozent ?? 0,
    unterhalt_prozent: erhoehung.unterhalt_prozent ?? 0,
    positionen: positionen.map(p => ({
      wohnung_id: p.wohnung_id,
      nettomiete: Number(p.wohnung?.nettomiete ?? 0),
      beheizt: p.beheizt,
    })),
  }), [erhoehung, positionen, gesamtNettomiete, gesamtNebenkosten]);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function speichern() {
    startTransition(async () => {
      try {
        await aktualisiereErhoehung(erhoehung.id, {
          titel: erhoehung.titel,
          grund: erhoehung.grund,
          referenzzinssatz_alt: erhoehung.referenzzinssatz_alt,
          referenzzinssatz_neu: erhoehung.referenzzinssatz_neu,
          lik_index_alt: erhoehung.lik_index_alt,
          lik_index_neu: erhoehung.lik_index_neu,
          kostensteigerung_pauschale: erhoehung.kostensteigerung_pauschale,
          kostensteigerung_pro_jahr: erhoehung.kostensteigerung_pro_jahr,
          investition_total: erhoehung.investition_total,
          foerderbeitraege: erhoehung.foerderbeitraege,
          wertvermehrend_prozent: erhoehung.wertvermehrend_prozent,
          ersatzbeschaffung_1zu1: erhoehung.ersatzbeschaffung_1zu1,
          amortisation_prozent: erhoehung.amortisation_prozent,
          unterhalt_prozent: erhoehung.unterhalt_prozent,
          nebenkosten_aenderung_monatlich: erhoehung.nebenkosten_aenderung_monatlich,
          inkrafttreten: erhoehung.inkrafttreten,
          berechnungsdatum: erhoehung.berechnungsdatum,
          letzte_anpassung: erhoehung.letzte_anpassung,
          mietbeginn: erhoehung.mietbeginn,
        });
        await neuBerechnen(erhoehung.id);
        showToast('Berechnung gespeichert');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Fehler beim Speichern', 'error');
      }
    });
  }

  function handleLoeschen() {
    if (!confirm('Berechnung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    startTransition(async () => {
      try {
        await loescheErhoehung(erhoehung.id);
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
      }
    });
  }

  function fmt(n: number) {
    return n.toLocaleString('de-CH', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  function fmt4(n: number) {
    return n.toLocaleString('de-CH', {
      minimumFractionDigits: 4, maximumFractionDigits: 4,
    });
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'basisdaten', label: '1. Basisdaten' },
    { key: 'saetze', label: '2. Zins & Teuerung' },
    { key: 'investition', label: '3. Kosten & Investitionen' },
    { key: 'ergebnis', label: '4. Ergebnis' },
  ];

  const STATUS_LABEL: Record<string, string> = {
    entwurf: 'Entwurf',
    berechnet: 'Berechnet',
    versendet: 'Versendet',
    angefochten: 'Angefochten',
    aktiv: 'Aktiv',
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 text-sm ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href="/dashboard/mietzinserhoehung"
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            ← Zurück zur Übersicht
          </Link>
          <input
            type="text"
            value={erhoehung.titel}
            onChange={(e) => setErhoehung({ ...erhoehung, titel: e.target.value })}
            className="text-xl font-bold text-gray-900 bg-transparent border-0 outline-none w-full focus:ring-0 px-0 mt-1"
          />
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">
              {erhoehung.liegenschaft?.name}, {erhoehung.liegenschaft?.plz} {erhoehung.liegenschaft?.ort}
            </span>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
              {STATUS_LABEL[erhoehung.status] ?? erhoehung.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleLoeschen}
            disabled={isPending}
            className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            Löschen
          </button>
          <button
            onClick={speichern}
            disabled={isPending}
            className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Speichert...' : 'Speichern & Berechnen'}
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Referenzzins"
          value={`CHF ${fmt(ergebnis.erhoehung_referenzzins_chf)}`}
          highlight={ergebnis.erhoehung_referenzzins_chf > 0 ? 'green' : ergebnis.erhoehung_referenzzins_chf < 0 ? 'red' : undefined}
        />
        <KpiCard
          label="Teuerung (40%)"
          value={`CHF ${fmt(ergebnis.erhoehung_teuerung_chf)}`}
          highlight={ergebnis.erhoehung_teuerung_chf > 0 ? 'green' : undefined}
        />
        <KpiCard
          label="Erhöhung/Mt. total"
          value={`CHF ${fmt(ergebnis.erhoehung_total_monatlich)}`}
          highlight="blue"
        />
        <KpiCard
          label="Neuer Nettomietzins"
          value={`CHF ${fmt(ergebnis.neuer_nettomietzins)}`}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[hsl(214,76%,49%)] text-[hsl(214,76%,49%)]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Basisdaten */}
      {tab === 'basisdaten' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Basisdaten</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Nettomiete, Daten und Grund der Erhöhung.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DateField
                label="Inkrafttreten per"
                value={erhoehung.inkrafttreten ?? ''}
                onChange={v => setErhoehung({ ...erhoehung, inkrafttreten: v })}
              />
              <DateField
                label="Letzte verbindliche Mietzinsfestsetzung"
                value={erhoehung.letzte_anpassung ?? ''}
                onChange={v => setErhoehung({ ...erhoehung, letzte_anpassung: v })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Grund der Erhöhung
                </label>
                <select
                  value={erhoehung.grund}
                  onChange={(e) => setErhoehung({ ...erhoehung, grund: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                >
                  <option value="referenzzinssatz">Referenzzinssatz-Änderung</option>
                  <option value="teuerungsausgleich">Teuerungsausgleich (LIK)</option>
                  <option value="kostensteigerung">Allgemeine Kostensteigerung</option>
                  <option value="investition">Wertvermehrende Investition</option>
                </select>
              </div>
              <DateField
                label="Mietbeginn"
                value={erhoehung.mietbeginn ?? ''}
                onChange={v => setErhoehung({ ...erhoehung, mietbeginn: v })}
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Nettomiete total (aus Wohnungen):</span>
                <span className="font-mono font-semibold">CHF {fmt(gesamtNettomiete)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Nebenkosten total:</span>
                <span className="font-mono font-semibold">CHF {fmt(gesamtNebenkosten)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Zins & Teuerung */}
      {tab === 'saetze' && (
        <div className="space-y-4">
          {/* Referenzzinssatz */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">1. Referenzzinssatz-Änderung</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Pro 0.25%-Schritt Erhöhung → 3% Mietzinserhöhung. Senkung → Mietzinsreduktion.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Alter Referenzzinssatz (%)
                  </label>
                  <select
                    value={erhoehung.referenzzinssatz_alt || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setErhoehung({ ...erhoehung, referenzzinssatz_alt: isNaN(v) ? 0 : v });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                  >
                    <option value="">Manuell eingeben oder wählen</option>
                    {RZS_CHANGES.map(c => (
                      <option key={c.datum} value={c.zinssatz}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.25"
                    value={erhoehung.referenzzinssatz_alt ?? 0}
                    onChange={(e) => setErhoehung({ ...erhoehung, referenzzinssatz_alt: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                    placeholder="oder manuell eingeben"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Neuer Referenzzinssatz (%)
                  </label>
                  <select
                    value={erhoehung.referenzzinssatz_neu || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setErhoehung({ ...erhoehung, referenzzinssatz_neu: isNaN(v) ? 0 : v });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                  >
                    <option value="">Manuell eingeben oder wählen</option>
                    {RZS_CHANGES.map(c => (
                      <option key={c.datum} value={c.zinssatz}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.25"
                    value={erhoehung.referenzzinssatz_neu ?? 0}
                    onChange={(e) => setErhoehung({ ...erhoehung, referenzzinssatz_neu: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                    placeholder="oder manuell eingeben"
                  />
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Änderung:</span>
                  <span className={`font-mono font-semibold ${ergebnis.referenzzinssatz_aenderung_pp >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {ergebnis.referenzzinssatz_aenderung_pp >= 0 ? '+' : ''}{fmt4(ergebnis.referenzzinssatz_aenderung_pp)} Prozentpunkte
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Erhöhung durch Referenzzins/Mt.:</span>
                  <span className={`font-mono font-semibold ${ergebnis.erhoehung_referenzzins_chf >= 0 ? 'text-[hsl(214,76%,49%)]' : 'text-green-600'}`}>
                    CHF {fmt(ergebnis.erhoehung_referenzzins_chf)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Teuerungsausgleich (LIK) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">2. Teuerungsausgleich (LIK)</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                40% der Teuerung gemäss Landesindex der Konsumentenpreise (LIK).
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    LIK-Indexstand alt (bei letzter Festsetzung)
                  </label>
                  <select
                    value={erhoehung.lik_index_alt || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setErhoehung({ ...erhoehung, lik_index_alt: isNaN(v) ? 0 : v });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                  >
                    <option value="">Manuell eingeben oder wählen</option>
                    {LIK_OPTIONS.map(o => (
                      <option key={o.monat} value={o.index}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    value={erhoehung.lik_index_alt ?? 0}
                    onChange={(e) => setErhoehung({ ...erhoehung, lik_index_alt: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                    placeholder="oder manuell eingeben"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    LIK-Indexstand neu (bei aktueller Anpassung)
                  </label>
                  <select
                    value={erhoehung.lik_index_neu || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setErhoehung({ ...erhoehung, lik_index_neu: isNaN(v) ? 0 : v });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                  >
                    <option value="">Manuell eingeben oder wählen</option>
                    {LIK_OPTIONS.map(o => (
                      <option key={o.monat} value={o.index}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    value={erhoehung.lik_index_neu ?? 0}
                    onChange={(e) => setErhoehung({ ...erhoehung, lik_index_neu: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                    placeholder="oder manuell eingeben"
                  />
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Teuerung (100%):</span>
                  <span className="font-mono font-semibold">{fmt4(ergebnis.teuerung_prozent)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Anrechenbar (40%):</span>
                  <span className="font-mono font-semibold text-[hsl(214,76%,49%)]">{fmt4(ergebnis.teuerung_40_prozent)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Erhöhung durch Teuerung/Mt.:</span>
                  <span className="font-mono font-semibold">CHF {fmt(ergebnis.erhoehung_teuerung_chf)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Kosten & Investitionen */}
      {tab === 'investition' && (
        <div className="space-y-4">
          {/* Kostensteigerung */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">3. Allgemeine Kostensteigerung</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Pauschale für Betriebs-, Unterhalts- und Verwaltungskostensteigerungen.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pauschale pro Jahr (%)
                  </label>
                  <div className="flex gap-2">
                    {KOSTENSTEIGERUNG_PAUSCHALEN.map(p => (
                      <button
                        key={p}
                        onClick={() => setErhoehung({ ...erhoehung, kostensteigerung_pauschale: p })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          erhoehung.kostensteigerung_pauschale === p
                            ? 'bg-[hsl(214,76%,49%)] text-white border-[hsl(214,76%,49%)]'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {p === 0 ? '0%' : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <NumberField
                  label="Jahre seit letzter Anpassung"
                  value={erhoehung.kostensteigerung_pro_jahr ?? 0}
                  onChange={v => setErhoehung({ ...erhoehung, kostensteigerung_pro_jahr: v })}
                  step="1"
                />
              </div>
              <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Gesamtkostensteigerung ({fmt(erhoehung.kostensteigerung_pauschale ?? 0)}% × {erhoehung.kostensteigerung_pro_jahr ?? 0} Jahre):</span>
                  <span className="font-mono font-semibold">{fmt4(ergebnis.kostensteigerung_gesamt_prozent)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Erhöhung durch Kostensteigerung/Mt.:</span>
                  <span className="font-mono font-semibold">CHF {fmt(ergebnis.erhoehung_kostensteigerung_chf)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Investitionen */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">4. Wertvermehrende Investition</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Gemäss Art. 269a lit. b OR / Art. 14 VMWG. Nur ausfüllen wenn zutreffend.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NumberField
                  label="Total Investition (CHF)"
                  value={erhoehung.investition_total ?? 0}
                  onChange={v => setErhoehung({ ...erhoehung, investition_total: v })}
                />
                <NumberField
                  label="Förderbeiträge (CHF)"
                  value={erhoehung.foerderbeitraege ?? 0}
                  onChange={v => setErhoehung({ ...erhoehung, foerderbeitraege: v })}
                />
                <NumberField
                  label="Ersatzbeschaffung 1:1 (CHF)"
                  value={erhoehung.ersatzbeschaffung_1zu1 ?? 0}
                  onChange={v => setErhoehung({ ...erhoehung, ersatzbeschaffung_1zu1: v })}
                />
                <NumberField
                  label="Wertvermehrender Anteil in %"
                  value={erhoehung.wertvermehrend_prozent ?? 100}
                  onChange={v => setErhoehung({ ...erhoehung, wertvermehrend_prozent: v })}
                  step="1"
                />
                <NumberField
                  label="Amortisation (% pro Jahr)"
                  value={erhoehung.amortisation_prozent ?? 0}
                  onChange={v => setErhoehung({ ...erhoehung, amortisation_prozent: v })}
                  step="0.5"
                />
                <NumberField
                  label="Unterhalt (% pro Jahr)"
                  value={erhoehung.unterhalt_prozent ?? 0}
                  onChange={v => setErhoehung({ ...erhoehung, unterhalt_prozent: v })}
                  step="0.1"
                />
                <NumberField
                  label="NK-Änderung total/Mt. (CHF)"
                  value={erhoehung.nebenkosten_aenderung_monatlich ?? 0}
                  onChange={v => setErhoehung({ ...erhoehung, nebenkosten_aenderung_monatlich: v })}
                />
              </div>
              {(erhoehung.investition_total ?? 0) > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Nettoinvestition:</span>
                    <span className="font-mono font-semibold">CHF {fmt(ergebnis.netto_investition)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Wertvermehrender Betrag:</span>
                    <span className="font-mono font-semibold text-[hsl(214,76%,49%)]">CHF {fmt(ergebnis.wertvermehrender_betrag)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Jahressatz total:</span>
                    <span className="font-mono font-semibold">{fmt4(ergebnis.jahressatz_prozent)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Erhöhung/Jahr:</span>
                    <span className="font-mono font-semibold">CHF {fmt(ergebnis.erhoehung_investition_jaehrlich)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Erhöhung/Monat:</span>
                    <span className="font-mono font-semibold">CHF {fmt(ergebnis.erhoehung_investition_monatlich)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Ergebnis */}
      {tab === 'ergebnis' && (
        <div className="space-y-4">
          {/* Zusammenfassung */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Zusammenfassung</h3>
            </div>
            <div className="p-5">
              <table className="w-full text-sm">
                <tbody>
                  {ergebnis.erhoehung_referenzzins_chf !== 0 && (
                    <tr className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">1. Referenzzinssatz ({fmt4(ergebnis.referenzzinssatz_aenderung_pp)} pp)</td>
                      <td className="py-2 text-right font-mono font-semibold">{ergebnis.erhoehung_referenzzins_chf >= 0 ? '+' : ''}CHF {fmt(ergebnis.erhoehung_referenzzins_chf)}</td>
                    </tr>
                  )}
                  {ergebnis.erhoehung_teuerung_chf !== 0 && (
                    <tr className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">2. Teuerungsausgleich ({fmt4(ergebnis.teuerung_40_prozent)}%)</td>
                      <td className="py-2 text-right font-mono font-semibold">+CHF {fmt(ergebnis.erhoehung_teuerung_chf)}</td>
                    </tr>
                  )}
                  {ergebnis.erhoehung_kostensteigerung_chf !== 0 && (
                    <tr className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">3. Kostensteigerung ({fmt4(ergebnis.kostensteigerung_gesamt_prozent)}%)</td>
                      <td className="py-2 text-right font-mono font-semibold">+CHF {fmt(ergebnis.erhoehung_kostensteigerung_chf)}</td>
                    </tr>
                  )}
                  {ergebnis.erhoehung_investition_monatlich !== 0 && (
                    <tr className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">4. Investition</td>
                      <td className="py-2 text-right font-mono font-semibold">+CHF {fmt(ergebnis.erhoehung_investition_monatlich)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-3 font-semibold text-gray-900">Gesamterhöhung/Monat</td>
                    <td className="py-3 text-right font-mono font-bold text-[hsl(214,76%,49%)] text-lg">
                      {ergebnis.erhoehung_total_monatlich >= 0 ? '+' : ''}CHF {fmt(ergebnis.erhoehung_total_monatlich)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-700">Neuer Nettomietzins total</td>
                    <td className="py-2 text-right font-mono font-semibold">CHF {fmt(ergebnis.neuer_nettomietzins)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Verteilung auf Wohnungen */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Verteilung auf Mietobjekte</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Pro Wohnung: Nettomiete × (Referenzzins-Änderung + Teuerung 40% + Kostensteigerung). Investitionen nur auf beheizte Wohnungen.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Whg-Nr.</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Bezeichnung</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Mieter</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Aktuell MZ</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-600">Beheizt</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Erhöhung</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Neuer MZ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {positionen.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        Keine Mietobjekte.
                      </td>
                    </tr>
                  ) : (
                    positionen.map((p, i) => {
                      const erg = ergebnis.positionen[i];
                      const aktuelleMiete = Number(p.wohnung?.nettomiete ?? 0);
                      return (
                        <tr key={p.id} className={`hover:bg-gray-50 ${!p.beheizt ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-2 font-mono text-xs">{p.wohnung?.whg_nr ?? '–'}</td>
                          <td className="px-4 py-2">
                            <div className="font-medium">{p.wohnung?.bezeichnung}</div>
                            <div className="text-xs text-gray-400">{p.wohnung?.wohnungstyp}</div>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-600">
                            {p.mieter_namen?.length > 0
                              ? p.mieter_namen.join(', ')
                              : <span className="text-gray-400">–</span>
                            }
                          </td>
                          <td className="px-4 py-2 text-right font-mono">{fmt(aktuelleMiete)}</td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={p.beheizt}
                              disabled={isPending}
                              onChange={(e) => {
                                const beheizt = e.target.checked;
                                setPositionen(positionen.map(x =>
                                  x.id === p.id ? { ...x, beheizt } : x
                                ));
                                startTransition(() =>
                                  setzeBeheizt(p.id, erhoehung.id, beheizt).catch(e =>
                                    showToast(e.message, 'error')
                                  )
                                );
                              }}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {erg.monatliche_erhoehung !== 0 ? (
                              <span className={erg.monatliche_erhoehung > 0 ? 'text-[hsl(214,76%,49%)]' : 'text-green-600'}>
                                {erg.monatliche_erhoehung > 0 ? '+' : ''}{fmt(erg.monatliche_erhoehung)}
                              </span>
                            ) : (
                              <span className="text-gray-400">–</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-semibold">{fmt(erg.neuer_nettomietzins)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {positionen.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-semibold text-gray-900">
                        Total {positionen.filter(p => p.beheizt).length} beheizte / {positionen.length} Objekte
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {fmt(positionen.reduce((s, p) => s + Number(p.wohnung?.nettomiete ?? 0), 0))}
                      </td>
                      <td></td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[hsl(214,76%,49%)]">
                        {ergebnis.erhoehung_total_monatlich >= 0 ? '+' : ''}{fmt(ergebnis.erhoehung_total_monatlich)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {fmt(ergebnis.neuer_nettomietzins)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Dokumente / Begründungstext */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Begründungstext für amtliches Formular</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Wird automatisch generiert beim Speichern.
              </p>
            </div>
            <div className="p-5">
              {erhoehung.begruendung_text ? (
                <pre className="bg-gray-50 rounded-lg p-4 text-xs whitespace-pre-wrap font-mono text-gray-800">
                  {erhoehung.begruendung_text}
                </pre>
              ) : (
                <p className="text-gray-400 text-sm italic">
                  Klicken Sie auf "Speichern & Berechnen" um den Begründungstext zu generieren.
                </p>
              )}
            </div>
          </div>

          {/* Rechtliche Hinweise */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-amber-900">Wichtige Hinweise zur Mitteilung</p>
            <ul className="space-y-1 text-amber-900 list-disc list-inside">
              <li>Die Erhöhung muss auf dem <strong>amtlichen Formular</strong> mitgeteilt werden.</li>
              <li>Versand <strong>eingeschrieben</strong>, mind. 10 Tage vor Beginn der Kündigungsfrist.</li>
              <li>Mieter haben <strong>30 Tage Anfechtungsfrist</strong>.</li>
              <li>Bei mehreren Vertragspartnern: an <strong>alle einzeln</strong> zustellen.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper-Komponenten ──────────────────────────────────────

function NumberField({
  label, value, onChange, step = '1',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
      />
    </div>
  );
}

function DateField({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
      />
    </div>
  );
}

function KpiCard({
  label, value, highlight,
}: {
  label: string;
  value: string;
  highlight?: 'green' | 'blue' | 'red';
}) {
  const valueColor =
    highlight === 'green' ? 'text-green-600' :
    highlight === 'blue' ? 'text-[hsl(214,76%,49%)]' :
    highlight === 'red' ? 'text-red-600' :
    'text-gray-900';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}