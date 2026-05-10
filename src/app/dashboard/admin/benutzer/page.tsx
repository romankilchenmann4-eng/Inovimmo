import { createClient } from '@/lib/supabase/server';
import { adminCreateUser } from '@/lib/admin/user-actions';

export default async function AdminBenutzerPage() {
  const supabase = await createClient();

  const { data: liegenschaften } = await supabase
    .from('liegenschaften')
    .select('id, name')
    .order('name');

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Benutzerverwaltung
        </h1>

        <p className="text-sm text-gray-500">
          Benutzer erstellen und Liegenschaften zuweisen.
        </p>
      </div>

      <form
        action={adminCreateUser}
        className="space-y-6 rounded-xl border bg-white p-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Vollständiger Name
            </label>

            <input
              name="full_name"
              className="w-full rounded border px-3 py-2"
              placeholder="Max Muster"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              E-Mail
            </label>

            <input
              name="email"
              type="email"
              required
              className="w-full rounded border px-3 py-2"
              placeholder="max@muster.ch"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Rolle
            </label>

            <select
              name="role"
              className="w-full rounded border px-3 py-2"
              defaultValue="eigentümer"
            >
              <option value="admin">
                Admin
              </option>

              <option value="verwalter">
                Verwalter
              </option>

              <option value="eigentümer">
                Eigentümer
              </option>

              <option value="dienstleister">
                Dienstleister
              </option>

              <option value="mieter">
                Mieter
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Liegenschaft
            </label>

            <select
              name="liegenschaft_id"
              className="w-full rounded border px-3 py-2"
            >
              <option value="">
                Keine Zuweisung
              </option>

              {(liegenschaften ?? []).map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Benutzer erstellen
        </button>
      </form>
    </div>
  );
}
