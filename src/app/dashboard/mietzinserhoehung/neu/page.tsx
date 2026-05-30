import { createClient } from '@/lib/supabase/server';
import { erstelleErhoehung } from '@/lib/mietzinserhoehung/actions';
import { getNeuesterReferenzzinssatz, getNeuesterLikIndex } from '@/lib/mietzinserhoehung/data';

export default async function NeueMietzinsErhoehungPage() {
  const supabase = await createClient();

  const { data: liegenschaften, error } = await supabase
    .from('liegenschaften')
    .select('id, name, strasse, hausnummer, plz, ort')
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-6 text-sm text-red-700">
        Fehler beim Laden der Liegenschaften: {error.message}
      </div>
    );
  }

  const list = liegenschaften ?? [];
  const aktuellerRZS = getNeuesterReferenzzinssatz();
  const aktuellerLIK = getNeuesterLikIndex();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Neue Mietzinserhöhung</h1>
        <p className="text-sm text-gray-500 mt-1">
          HEV-konforme Berechnung: Referenzzinssatz, Teuerungsausgleich, Kostensteigerung & Investitionen.
        </p>
      </div>

      <form action={erstelleErhoehung} className="space-y-5">
        {/* Allgemein */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Allgemein</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
            <input
              name="titel"
              defaultValue="Mietzinserhöhung"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Liegenschaft *</label>
            <select
              name="liegenschaft_id"
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Bitte wählen</option>
              {list.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name ?? l.id}{l.ort ? ` — ${l.ort}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grund der Erhöhung</label>
              <select
                name="grund"
                defaultValue="referenzzinssatz"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="referenzzinssatz">Referenzzinssatz-Änderung</option>
                <option value="teuerungsausgleich">Teuerungsausgleich (LIK)</option>
                <option value="kostensteigerung">Allgemeine Kostensteigerung</option>
                <option value="investition">Wertvermehrende Investition</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inkrafttreten per</label>
              <input
                type="date"
                name="inkrafttreten"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            <p>Aktueller Referenzzinssatz: <strong>{aktuellerRZS.toFixed(2)}%</strong></p>
            <p>Aktueller LIK-Index: <strong>{aktuellerLIK.toFixed(1)}</strong></p>
            <p className="mt-1 text-blue-600">Die genauen Werte können nach dem Erstellen im Detailformular angepasst werden.</p>
          </div>
        </div>

        {/* Eigentümer */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Eigentümer / Vermieter</h2>
          <p className="text-xs text-gray-500">Erscheint auf dem amtlichen Erhöhungsformular als Absender.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name / Firma</label>
            <input
              name="eigentuemer_name"
              placeholder="Max Muster Immobilien AG"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input
                name="eigentuemer_adresse"
                placeholder="Musterstrasse 1"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PLZ / Ort</label>
              <input
                name="eigentuemer_ort"
                placeholder="8001 Zürich"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] text-white font-semibold text-sm transition-colors"
        >
          Mietzinserhöhung erstellen
        </button>
      </form>
    </div>
  );
}