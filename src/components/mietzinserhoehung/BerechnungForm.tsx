'use client';

import { useState, useTransition, useMemo } from 'react';
import { calculateRentIncrease } from '@/lib/mietzinserhoehung/calc';
import { 
  updateCalculation, 
  recalculateAndSave, 
  addAllocation, 
  deleteAllocation,
} from '@/lib/mietzinserhoehung/actions';
import type { 
  RentIncreaseCalculation, 
  RentIncreaseAllocation,
} from '@/lib/mietzinserhoehung/types';

interface Props {
  calculation: RentIncreaseCalculation;
  allocations: RentIncreaseAllocation[];
}

type TabKey = 'investition' | 'saetze' | 'verteilung' | 'dokumente';

export function BerechnungForm({ calculation, allocations: initialAllocations }: Props) {
  const [calc, setCalc] = useState(calculation);
  const [allocations, setAllocations] = useState(initialAllocations);
  const [tab, setTab] = useState<TabKey>('investition');
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Live-Berechnung
  const result = useMemo(() => calculateRentIncrease({
    investment_total: calc.investment_total,
    subsidies: calc.subsidies,
    value_added_pct: calc.value_added_pct,
    reference_rate: calc.reference_rate,
    surcharge: calc.surcharge,
    amortization_pct: calc.amortization_pct,
    maintenance_pct: calc.maintenance_pct,
    allocations: allocations.map(a => ({
      unit_label: a.unit_label,
      tenant_name: a.tenant_name,
      current_rent: a.current_rent,
      is_heated: a.is_heated,
    })),
  }), [calc, allocations]);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateCalculation(calc.id, calc);
        await recalculateAndSave(calc.id);
        showToast('Berechnung gespeichert');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Fehler beim Speichern', 'error');
      }
    });
  }

  function fmt(n: number) {
    return n.toLocaleString('de-CH', { 
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'investition', label: '1. Investition' },
    { key: 'saetze',      label: '2. Sätze' },
    { key: 'verteilung',  label: '3. Verteilung' },
    { key: 'dokumente',   label: '4. Dokumente' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 text-sm ${
          toast.type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={calc.title}
            onChange={(e) => setCalc({ ...calc, title: e.target.value })}
            className="text-xl font-bold text-gray-900 bg-transparent border-0 outline-none w-full focus:ring-0 px-0"
          />
          <p className="text-sm text-gray-500 mt-1">
            Mietzinserhöhung gemäss Art. 269a OR / Art. 14 VMWG
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          <span>💾</span>
          {isPending ? 'Speichert...' : 'Speichern'}
        </button>
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
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Total Investition (CHF)
                </label>
                <input
                  type="number"
                  value={calc.investment_total}
                  onChange={(e) => setCalc({ 
                    ...calc, investment_total: parseFloat(e.target.value) || 0,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Förderbeiträge (CHF)
                </label>
                <input
                  type="number"
                  value={calc.subsidies}
                  onChange={(e) => setCalc({ 
                    ...calc, subsidies: parseFloat(e.target.value) || 0,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Wertvermehrender Anteil in % (typ. 50–70 % bei Systemwechsel)
                </label>
                <input
                  type="number"
                  step="1"
                  value={calc.value_added_pct}
                  onChange={(e) => setCalc({ 
                    ...calc, value_added_pct: parseFloat(e.target.value) || 0,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Nettoinvestition:</span>
                <span className="font-mono font-semibold text-gray-900">
                  CHF {fmt(result.netInvestment)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Wertvermehrender Anteil:</span>
                <span className="font-mono font-semibold text-[hsl(214,76%,49%)]">
                  CHF {fmt(result.valueAddedAmount)}
                </span>
              </div>
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
                value={calc.reference_rate}
                onChange={v => setCalc({ ...calc, reference_rate: v })}
              />
              <FormField 
                label="Zuschlag (%)" step="0.1"
                value={calc.surcharge}
                onChange={v => setCalc({ ...calc, surcharge: v })}
              />
              <FormField 
                label="Amortisation (%)" step="0.5"
                value={calc.amortization_pct}
                onChange={v => setCalc({ ...calc, amortization_pct: v })}
              />
              <FormField 
                label="Unterhalt (%)" step="0.1"
                value={calc.maintenance_pct}
                onChange={v => setCalc({ ...calc, maintenance_pct: v })}
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Gesamtsatz pro Jahr:</span>
                <span className="font-mono font-semibold">{result.totalRatePct.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Jährliche Mehrbelastung:</span>
                <span className="font-mono font-semibold">CHF {fmt(result.yearlyIncrease)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Monatliche Mehrbelastung:</span>
                <span className="font-mono font-semibold text-[hsl(214,76%,49%)]">
                  CHF {fmt(result.monthlyIncrease)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Verteilung */}
      {tab === 'verteilung' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Verteilung auf Mietobjekte</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Aufteilung nach aktuellem Nettomietzins.
              </p>
            </div>
            <button
              disabled={isPending}
              onClick={() => startTransition(async () => {
                try {
                  await addAllocation(calc.id, {
                    rental_unit_id: null,
                    unit_label: 'Neues Objekt',
                    tenant_name: null,
                    current_rent: 0,
                    is_heated: true,
                  });
                  showToast('Objekt hinzugefügt');
                } catch (e) {
                  showToast(e instanceof Error ? e.message : 'Fehler', 'error');
                }
              })}
              className="text-sm text-[hsl(214,76%,49%)] hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              <span>+</span> Objekt hinzufügen
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Objekt</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Mieter</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">MZ/Mt.</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Beheizt</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Anteil %</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Erhöhung</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Neuer MZ</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      Noch keine Objekte zugeordnet
                    </td>
                  </tr>
                ) : (
                  allocations.map((a, i) => {
                    const r = result.allocations[i];
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{a.unit_label}</td>
                        <td className="px-4 py-2 text-gray-600">{a.tenant_name ?? '–'}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(214,76%,49%)]"
                            value={a.current_rent}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setAllocations(allocations.map(x =>
                                x.id === a.id ? { ...x, current_rent: val } : x
                              ));
                            }}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={a.is_heated}
                            onChange={(e) => {
                              setAllocations(allocations.map(x =>
                                x.id === a.id ? { ...x, is_heated: e.target.checked } : x
                              ));
                            }}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {r.share_pct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {fmt(r.monthly_increase)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">
                          {fmt(r.new_rent)}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => startTransition(async () => {
                              try {
                                await deleteAllocation(a.id, calc.id);
                                setAllocations(allocations.filter(x => x.id !== a.id));
                              } catch (e) {
                                showToast(e instanceof Error ? e.message : 'Fehler', 'error');
                              }
                            })}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Dokumente */}
      {tab === 'dokumente' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Rechtliche Hinweise & Dokumente</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-amber-600">⚠️</span>
                <div className="flex-1 space-y-2">
                  <p>
                    Die Erhöhung muss auf dem <strong>amtlichen Formular Kanton Zürich</strong> mitgeteilt werden.
                  </p>
                  <p>
                    Versand <strong>eingeschrieben</strong>, mind. 10 Tage vor Beginn der Kündigungsfrist.
                  </p>
                  <p>
                    Mieter haben <strong>30 Tage Anfechtungsfrist</strong> bei der Schlichtungsbehörde.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <span>📄</span>
              Begründungstext für Formular generieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper-Komponente: FormField ────────────────────────────
function FormField({ 
  label, value, onChange, step = '1' 
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
