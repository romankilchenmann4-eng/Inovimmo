import { createClient } from '@/lib/supabase/server';
import { erstelleErhoehung } from '@/lib/mietzinserhoehung/actions';

export default async function NeueMietzinsErhoehungPage() {
  const supabase = await createClient();

  const { data: liegenschaften, error } = await supabase
    .from('liegenschaften')
    .select('id, name')
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
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">
        Neue Mietzinserhöhung
      </h1>

      <form
        action={erstelleErhoehung}
        className="space-y-4 rounded border p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">
            Titel
          </label>

          <input
            name="titel"
            defaultValue="Mietzinserhöhung"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Liegenschaft
          </label>

          <select
            name="liegenschaft_id"
            required
            className="w-full rounded border px-3 py-2"
          >
            <option value="">
              Bitte wählen
            </option>

            {list.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? l.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Grund
          </label>

          <select
            name="grund"
            defaultValue="renovation"
            className="w-full rounded border px-3 py-2"
          >
            <option value="renovation">
              Renovation / wertvermehrende Investition
            </option>

            <option value="kostensteigerung">
              Kostensteigerung
            </option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Erstellen
        </button>
      </form>
    </div>
  );
}
