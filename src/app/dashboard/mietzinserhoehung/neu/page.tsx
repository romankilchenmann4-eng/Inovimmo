import { createClient } from '@/lib/supabase/server';
import { erstelleErhoehung } from '@/lib/mietzinserhoehung/actions';

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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Neue Mietzinserhöhung</h1>
        <p className="text-sm text-gray-500 mt-1">Erstellt das amtliche Formular für alle Wohnungen der Liegenschaft.</p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grund der Erhöhung</label>
            <select
              name="grund"
              defaultValue="renovation"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="renovation">Renovation / wertvermehrende Investition</option>
              <option value="kostensteigerung">Kostensteigerung (Nebenkosten, Betrieb)</option>
              <option value="hypothek">Hypothekarzinsanpassung</option>
              <option value="teuerung">Teuerungsausgleich</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inkrafttreten</label>
            <input
              type="date"
              name="inkrafttreten"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Eigentümer / Vermieter */}
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

        {/* Mieter-Hinweis */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-800 mb-1">ℹ️ Mieter-Zuordnung</p>
          <p className="text-xs text-blue-700">
            Nach dem Erstellen werden automatisch Positionen für alle Wohnungen der Liegenschaft angelegt.
            Auf dem Detailformular können Sie pro Wohnung den Mieter (Name, Adresse) ergänzen.
          </p>
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
