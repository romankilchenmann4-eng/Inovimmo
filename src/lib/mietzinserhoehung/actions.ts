import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { erstelleErhoehung } from '@/lib/mietzinserhoehung/actions';

export default async function MietzinserhoehungPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // ============================================================
  // Mietzinserhöhungen laden (safe + robust)
  // ============================================================
  const { data: erhoehungen, error: erhoehungenError } = await supabase
    .from('mietzins_erhoehungen')
    .select(`
      *,
      liegenschaft:liegenschaft_id (
        id,
        name,
        plz,
        ort
      )
    `)
    .order('created_at', { ascending: false });

  if (erhoehungenError) {
    console.error('Fehler beim Laden der Erhöhungen:', erhoehungenError);
  }

  // ============================================================
  // Liegenschaften laden
  // ============================================================
  const { data: liegenschaften, error: liegenschaftenError } =
    await supabase
      .from('liegenschaften')
      .select('id, name, strasse, hausnummer, plz, ort')
      .order('name');

  if (liegenschaftenError) {
    console.error('Fehler beim Laden der Liegenschaften:', liegenschaftenError);
  }

  // ============================================================
  // Status Mapping
  // ============================================================
  const STATUS: Record<string, { label: string; cls: string }> = {
    entwurf: {
      label: 'Entwurf',
      cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700',
    },
    berechnet: {
      label: 'Berechnet',
      cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700',
    },
    versendet: {
      label: 'Versendet',
      cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700',
    },
    angefochten: {
      label: '⚠ Angefochten',
      cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700',
    },
    aktiv: {
      label: 'Aktiv',
      cls: 'inline-block text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700',
    },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Mietzinserhöhungen
        </h2>
        <p className="text-sm text-gray-500">
          Berechnung und Verwaltung wertvermehrender Investitionen nach Art. 269a OR / VMWG
        </p>
      </div>

      {/* ======================================================== */}
      {/* NEUE BERECHNUNG */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            Neue Berechnung erstellen
          </h3>
        </div>

        <div className="p-5">
          {!liegenschaften?.length ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              <p className="text-2xl mb-2">🏢</p>
              <p>Keine Liegenschaften vorhanden</p>

              <Link
                href="/dashboard/objekte"
                className="text-blue-600 hover:underline mt-2 inline-block"
              >
                → Liegenschaft anlegen
              </Link>
            </div>
          ) : (
            <form action={erstelleErhoehung} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* LIEGENSCHAFT */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Liegenschaft
                  </label>

                  <select
                    name="liegenschaft_id"
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">– auswählen –</option>
                    {liegenschaften?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} – {l.plz} {l.ort}
                      </option>
                    ))}
                  </select>
                </div>

                {/* GRUND */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Grund
                  </label>

                  <select
                    name="grund"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="heizungsersatz">Heizungsersatz</option>
                    <option value="renovation">Renovation</option>
                    <option value="wertvermehrend_sonstiges">
                      Sonstige
                    </option>
                  </select>
                </div>
              </div>

              {/* TITEL */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Bezeichnung
                </label>

                <input
                  name="titel"
                  defaultValue="Mietzinserhöhung"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
              >
                + Berechnung erstellen
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* LISTE */}
      {/* ======================================================== */}
      <div>
        <h3 className="font-semibold mb-3">Bestehende Berechnungen</h3>

        {!erhoehungen?.length ? (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
            Keine Daten vorhanden
          </div>
        ) : (
          <div className="grid gap-3">
            {(erhoehungen ?? []).map((e) => {
              const status =
                STATUS[e.status as keyof typeof STATUS] ?? STATUS.entwurf;

              const l = e.liegenschaft as any;

              return (
                <Link
                  key={e.id}
                  href={`/dashboard/mietzinserhoehung/${e.id}`}
                  className="bg-white border rounded-xl p-5 flex justify-between hover:shadow"
                >
                  <div>
                    <div className="font-semibold">{e.titel}</div>
                    <div className="text-xs text-gray-500">
                      {l?.name ?? 'Keine Liegenschaft'}
                    </div>

                    <div className="text-xs text-gray-400 mt-2">
                      {e.created_at
                        ? new Date(e.created_at).toLocaleDateString('de-CH')
                        : '–'}
                    </div>
                  </div>

                  <span className={status.cls}>{status.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
