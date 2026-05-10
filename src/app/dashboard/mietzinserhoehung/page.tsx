import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { erstelleErhoehung } from '@/lib/mietzinserhoehung/actions';

export default async function MietzinserhoehungPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Erhöhungen laden mit Liegenschaft
  const { data: erhoehungen } = await supabase
    .from('mietzins_erhoehungen')
    .select(`
      *,
      liegenschaft:liegenschaft_id ( id, name, plz, ort )
    `)
    .order('created_at', { ascending: false });

  // Liegenschaften für Auswahl im Formular
  const { data: liegenschaften } = await supabase
    .from('liegenschaften')
    .select('id, name, strasse, hausnummer, plz, ort')
    .order('name');

  const STATUS: Record<string, { label: string; cls: string }> = {
    entwurf:     { label: 'Entwurf',     cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700' },
    berechnet:   { label: 'Berechnet',   cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700' },
    versendet:   { label: 'Versendet',   cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700' },
    angefochten: { label: '⚠ Angefochten', cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700' },
    aktiv:       { label: 'Aktiv',       cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700' },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Mietzinserhöhungen</h2>
        <p className="text-sm text-gray-500">
          Berechnung und Verwaltung wertvermehrender Investitionen
          nach Art. 269a OR / Art. 14 VMWG
        </p>
      </div>

      {/* Neue Berechnung anlegen */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Neue Berechnung erstellen</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Wählen Sie die Liegenschaft, für die Sie eine Mietzinserhöhung berechnen möchten.
          </p>
        </div>
        <div className="p-5">
          {!liegenschaften?.length ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              <p className="text-2xl mb-2">🏢</p>
              <p>Noch keine Liegenschaften vorhanden.</p>
              <Link
                href="/dashboard/objekte"
                className="text-[hsl(214,76%,49%)] hover:underline text-sm mt-2 inline-block"
              >
                → Liegenschaft anlegen
              </Link>
            </div>
          ) : (
            <form action={erstelleErhoehung} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Liegenschaft
                  </label>
                  <select
                    name="liegenschaft_id"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                  >
                    <option value="">– Liegenschaft auswählen –</option>
                    {liegenschaften.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name} – {l.strasse} {l.hausnummer}, {l.plz} {l.ort}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Grund
                  </label>
                  <select
                    name="grund"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                  >
                    <option value="heizungsersatz">Heizungsersatz</option>
                    <option value="renovation">Renovation</option>
                    <option value="wertvermehrend_sonstiges">Sonstige wertvermehrende Investition</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Bezeichnung
                </label>
                <input
                  type="text"
                  name="titel"
                  defaultValue="Heizungsersatz Ölheizung → Wärmepumpe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-lg text-sm font-medium hover:opacity-90"
              >
                + Berechnung erstellen
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bestehende Berechnungen */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Bestehende Berechnungen</h3>

        {!erhoehungen?.length ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-12 text-center">
            <p className="text-3xl mb-2">🧾</p>
            <p className="text-sm text-gray-500">
              Noch keine Berechnungen vorhanden.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {erhoehungen.map(e => {
              const status = STATUS[e.status] ?? STATUS.entwurf;
              const liegenschaft = e.liegenschaft as any;
              return (
                <Link
                  key={e.id}
                  href={`/dashboard/mietzinserhoehung/${e.id}`}
                  className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                        🧾
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {e.titel}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {liegenschaft?.name ?? 'Keine Liegenschaft'}
                          {liegenschaft && ` · ${liegenschaft.plz} ${liegenschaft.ort}`}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                          <span>
                            {new Date(e.created_at).toLocaleDateString('de-CH')}
                          </span>
                          {Number(e.investition_total) > 0 && (
                            <span>
                              CHF {Number(e.investition_total).toLocaleString('de-CH')}
                            </span>
                          )}
                          {e.wertvermehrend_prozent && (
                            <span>
                              {e.wertvermehrend_prozent}% wertvermehrend
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
    </div>
  );
}
