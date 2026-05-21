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

type TabKey = 'investition' | 'saetze' | 'verteilung' | 'dokumente';

export function BerechnungForm({ erhoehung: initial, positionen: initialPositionen }: Props) {
  const [erhoehung, setErhoehung] = useState(initial);
  const [positionen, setPositionen] = useState(initialPositionen);
  const [tab, setTab] = useState<TabKey>('investition');
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Live-Berechnung für Vorschau
  const ergebnis = useMemo(() => berechneErhoehung({
    investition_total: erhoehung.investition_total,
    foerderbeitraege: erhoehung.foerderbeitraege,
    wertvermehrend_prozent: erhoehung.wertvermehrend_prozent,
    ersatzbeschaffung_1zu1: erhoehung.ersatzbeschaffung_1zu1 ?? 0,
    referenzzinssatz: erhoehung.referenzzinssatz,
    zuschlag: erhoehung.zuschlag,
    amortisation_prozent: erhoehung.amortisation_prozent,
    unterhalt_prozent: erhoehung.unterhalt_prozent,
    positionen: positionen.map(p => ({
      wohnung_id: p.wohnung_id,
      nettomiete: Number(p.wohnung?.nettomiete ?? 0),
      beheizt: p.beheizt,
    })),
  }), [erhoehung, positionen]);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function speichern() {
    startTransition(async () => {
      try {
        await aktualisiereErhoehung(erhoehung.id, {
          titel: erhoehung.titel,
          investition_total: erhoehung.investition_total,
          foerderbeitraege: erhoehung.foerderbeitraege,
          wertvermehrend_prozent: erhoehung.wertvermehrend_prozent,
          ersatzbeschaffung_1zu1: erhoehung.ersatzbeschaffung_1zu1 ?? 0,
          nebenkosten_aenderung_monatlich: erhoehung.nebenkosten_aenderung_monatlich ?? 0,
          referenzzinssatz: erhoehung.referenzzinssatz,
          zuschlag: erhoehung.zuschlag,
          amortisation_prozent: erhoehung.amortisation_prozent,
          unterhalt_prozent: erhoehung.unterhalt_prozent,
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

  function fmt0(n: number) {
    return n.toLocaleString('de-CH', {
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    });
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'investition', label: '1. Investition' },
    { key: 'saetze',      label: '2. Sätze' },
    { key: 'verteilung',  label: '3. Verteilung' },
    { key: 'dokumente',   label: '4. Dokumente' },
  ];

  const STATUS_LABEL: Record<string, string> = {
    entwurf:     'Entwurf',
    berechnet:   'Berechnet',
    versendet:   'Versendet',
    angefochten: 'Angefochten',
    aktiv:       'Aktiv',
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
            🗑 Löschen
          </button>
          <button
            onClick={speichern}
            disabled={isPending}
            className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Speichert...' : '💾 Speichern & Berechnen'}
          </button>
        </div>
      </div>

      {/* KPI-Karten Live-Vorschau */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Nettoinvestition"
          value={`CHF ${fmt0(ergebnis.netto_investition)}`}
        />
        <KpiCard
          label="Wertvermehrend"
          value={`CHF ${fmt0(ergebnis.wertvermehrender_betrag)}`}
          highlight="blue"
        />
        <KpiCard
          label="Erhöhung/Mt. total"
          value={`CHF ${fmt(ergebnis.monatliche_mehrbelastung)}`}
          highlight="green"
        />
        <KpiCard
          label="Erhöhung/Jahr"
          value={`CHF ${fmt0(ergebnis.jaehrliche_mehrbelastung)}`}
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

      {/* Tab: Investition */}
      {tab === 'investition' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Investitionskosten</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Total der Investition, Förderbeiträge und wertvermehrender Anteil.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Total Investition (CHF)"
                value={erhoehung.investition_total}
                onChange={v => setErhoehung({ ...erhoehung, investition_total: v })}
              />
              <FormField
                label="Förderbeiträge (CHF)"
                value={erhoehung.foerderbeitraege}
                onChange={v => setErhoehung({ ...erhoehung, foerderbeitraege: v })}
              />
              <FormField
                label="Ersatzbeschaffung 1:1 (CHF)"
                value={erhoehung.ersatzbeschaffung_1zu1 ?? 0}
                onChange={v => setErhoehung({ ...erhoehung, ersatzbeschaffung_1zu1: v })}
              />
              <FormField
                label="NK-Änderung total/Mt. (CHF)"
                value={erhoehung.nebenkosten_aenderung_monatlich ?? 0}
                onChange={v => setErhoehung({ ...erhoehung, nebenkosten_aenderung_monatlich: v })}
              />
              <div className="md:col-span-2">
                <FormField
                  label="Wertvermehrender Anteil in % (automatisch bei Ersatzbeschaffung, sonst typ. 50–70%)"
                  step="1"
                  value={erhoehung.wertvermehrend_prozent}
                  onChange={v => setErhoehung({ ...erhoehung, wertvermehrend_prozent: v })}
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Nettoinvestition (Investition − Förderbeiträge):</span>
                <span className="font-mono font-semibold text-gray-900">
                  CHF {fmt(ergebnis.netto_investition)}
                </span>
              </div>
              {erhoehung.ersatzbeschaffung_1zu1 > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Ersatzbeschaffung 1:1 (Unterhaltsanteil):</span>
                  <span className="font-mono font-semibold text-gray-600">
                    CHF {fmt(erhoehung.ersatzbeschaffung_1zu1)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-700">Wertvermehrender Betrag:</span>
                <span className="font-mono font-semibold text-[hsl(214,76%,49%)]">
                  CHF {fmt(ergebnis.wertvermehrender_betrag)}
                </span>
              </div>
              {erhoehung.nebenkosten_aenderung_monatlich !== 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Nebenkostenänderung total/Mt.:</span>
                  <span className={`font-mono font-semibold ${erhoehung.nebenkosten_aenderung_monatlich < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {erhoehung.nebenkosten_aenderung_monatlich < 0 ? '' : '+'}CHF {fmt(Math.abs(erhoehung.nebenkosten_aenderung_monatlich))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Sätze */}
      {tab === 'saetze' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Jährliche Kostensätze</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Verzinsung, Amortisation und Unterhalt nach VMWG.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Referenzzinssatz (%)" step="0.25"
                value={erhoehung.referenzzinssatz}
                onChange={v => setErhoehung({ ...erhoehung, referenzzinssatz: v })}
              />
              <FormField
                label="Zuschlag (%)" step="0.1"
                value={erhoehung.zuschlag}
                onChange={v => setErhoehung({ ...erhoehung, zuschlag: v })}
              />
              <FormField
                label="Amortisation (%)" step="0.5"
                value={erhoehung.amortisation_prozent}
                onChange={v => setErhoehung({ ...erhoehung, amortisation_prozent: v })}
              />
              <FormField
                label="Unterhalt (%)" step="0.1"
                value={erhoehung.unterhalt_prozent}
                onChange={v => setErhoehung({ ...erhoehung, unterhalt_prozent: v })}
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Gesamtsatz pro Jahr:</span>
                <span className="font-mono font-semibold">{ergebnis.jahressatz_total.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Jährliche Mehrbelastung:</span>
                <span className="font-mono font-semibold">CHF {fmt(ergebnis.jaehrliche_mehrbelastung)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Monatliche Mehrbelastung:</span>
                <span className="font-mono font-semibold text-[hsl(214,76%,49%)]">
                  CHF {fmt(ergebnis.monatliche_mehrbelastung)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Verteilung */}
      {tab === 'verteilung' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Verteilung auf Mietobjekte</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Aufteilung nach Anteil Nettomietzins. Nur beheizte Objekte zahlen die Erhöhung.
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
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Anteil %</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Erhöhung</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Neuer MZ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positionen.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      Keine Mietobjekte. Bitte zuerst eine Liegenschaft mit Wohnungen auswählen.
                    </td>
                  </tr>
                ) : (
                  positionen.map((p, i) => {
                    const erg = ergebnis.positionen[i];
                    const aktuelleMiete = Number(p.wohnung?.nettomiete ?? 0);
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 ${!p.beheizt ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-2 font-mono text-xs">
                          {p.wohnung?.whg_nr ?? '–'}
                        </td>
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
                        <td className="px-4 py-2 text-right font-mono">
                          {fmt(aktuelleMiete)}
                        </td>
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
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">
                          {erg.anteil_prozent.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {erg.monatliche_erhoehung > 0 ? (
                            <span className="text-[hsl(214,76%,49%)]">
                              +{fmt(erg.monatliche_erhoehung)}
                            </span>
                          ) : (
                            <span className="text-gray-400">–</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">
                          {fmt(erg.neuer_nettomietzins)}
                        </td>
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
                      {fmt(positionen.filter(p => p.beheizt).reduce((s, p) => 
                        s + Number(p.wohnung?.nettomiete ?? 0), 0))}
                    </td>
                    <td></td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">100%</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[hsl(214,76%,49%)]">
                      +{fmt(ergebnis.monatliche_mehrbelastung)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {fmt(positionen.filter(p => p.beheizt).reduce((s, p, i) => 
                        s + ergebnis.positionen[positionen.indexOf(p)].neuer_nettomietzins, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab: Dokumente */}
      {tab === 'dokumente' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-amber-900">⚠️ Wichtige Hinweise zur Mitteilung</p>
            <ul className="space-y-1 text-amber-900 list-disc list-inside">
              <li>Die Erhöhung muss auf dem <strong>amtlichen Formular Kanton Zürich</strong> mitgeteilt werden.</li>
              <li>Versand <strong>eingeschrieben</strong>, mind. 10 Tage vor Beginn der Kündigungsfrist.</li>
              <li>Mieter haben <strong>30 Tage Anfechtungsfrist</strong> bei der Schlichtungsbehörde Bezirk Dielsdorf.</li>
              <li>Bei mehreren Vertragspartnern: an <strong>alle einzeln</strong> zustellen.</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Begründungstext für amtliches Formular</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Wird automatisch generiert beim Klick auf "Speichern & Berechnen".
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
        </div>
      )}
    </div>
  );
}

// ── Helper-Komponenten ──────────────────────────────────────

function FormField({
  label, value, onChange, step = '1',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
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

function KpiCard({
  label, value, highlight,
}: {
  label: string;
  value: string;
  highlight?: 'green' | 'blue';
}) {
  const valueColor =
    highlight === 'green' ? 'text-green-600' :
    highlight === 'blue' ? 'text-[hsl(214,76%,49%)]' :
    'text-gray-900';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
