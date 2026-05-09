import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { erstelleErhoehung } from '@/lib/mietzinserhoehung/actions';

export default async function MietzinserhoehungPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: calculations } = await supabase
    .from('rent_increase_calculations')
    .select('*')
    .order('created_at', { ascending: false });

  const STATUS: Record<string, { label: string; cls: string }> = {
    draft:       { label: 'Entwurf',       cls: 'badge-gray' },
    calculated:  { label: 'Berechnet',     cls: 'badge-blue' },
    sent:        { label: 'Versendet',     cls: 'badge-amber' },
    challenged:  { label: '⚠ Angefochten', cls: 'badge-red' },
    active:      { label: 'Aktiv',         cls: 'badge-green' },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mietzinserhöhungen</h2>
          <p className="text-sm text-gray-500">
            Berechnung und Verwaltung wertvermehrender Investitionen 
            nach Art. 269a OR / Art. 14 VMWG
          </p>
        </div>
        <form action={erstelleErhoehung(formData)}>
          <input type="hidden" name="title" value="Neue Berechnung" />
          <input type="hidden" name="reason" value="heating_replacement" />
          <button
            type="submit"
            className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2"
          >
            <span>+</span> Neue Berechnung
          </button>
        </form>
      </div>

      {/* Empty State oder Liste */}
      {!calculations?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
          <p className="text-4xl mb-3">🧾</p>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Noch keine Berechnungen
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Erstellen Sie Ihre erste Mietzinserhöhungs-Berechnung.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {calculations.map(calc => {
            const status = STATUS[calc.status] ?? { label: calc.status, cls: 'badge-gray' };
            return (
              <Link 
                key={calc.id} 
                href={`/dashboard/mietzinserhoehung/${calc.id}`}
                className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                      🧾
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {calc.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>
                          Erstellt: {new Date(calc.created_at).toLocaleDateString('de-CH')}
                        </span>
                        {calc.investment_total > 0 && (
                          <span>
                            Investition: CHF {Number(calc.investment_total).toLocaleString('de-CH')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={status.cls}>{status.label}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
