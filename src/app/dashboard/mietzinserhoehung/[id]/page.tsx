import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  aktualisiereErhoehung,
  loescheErhoehung,
} from '@/lib/mietzinserhoehung/actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MietzinsErhoehungDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: erhoehung, error } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-6 text-sm text-red-700">
        Fehler beim Laden: {error.message}
      </div>
    );
  }

  if (!erhoehung) {
    return <div>Mietzinserhöhung nicht gefunden.</div>;
  }

  async function speichern(formData: FormData) {
    'use server';

    const titel = formData.get('titel');
    const grund = formData.get('grund');
    const status = formData.get('status');
    const investition_total = formData.get('investition_total');
    const netto_investition = formData.get('netto_investition');
    const jahressatz_total = formData.get('jahressatz_total');

    await aktualisiereErhoehung(id, {
      titel: typeof titel === 'string' ? titel : 'Mietzinserhöhung',
      grund: typeof grund === 'string' ? grund : 'renovation',
      status: typeof status === 'string' ? status : 'entwurf',
      investition_total: Number(investition_total || 0),
      netto_investition: Number(netto_investition || 0),
      jahressatz_total: Number(jahressatz_total || 0),
    });

    redirect(`/dashboard/mietzinserhoehung/${id}`);
  }

  async function loeschen() {
    'use server';
    await loescheErhoehung(id);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/mietzinserhoehung"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Zurück
      </Link>

      <div>
        <h1 className="text-2xl font-bold">
          {erhoehung.titel ?? 'Mietzinserhöhung'}
        </h1>
        <p className="text-sm text-gray-500">
          Status: {erhoehung.status ?? 'entwurf'}
        </p>
      </div>

      <form action={speichern} className="space-y-4 rounded border p-6">
        <h2 className="text-lg font-semibold">Mietzinserhöhung bearbeiten</h2>

        <div>
          <label className="mb-1 block text-sm font-medium">Titel</label>
          <input
            name="titel"
            defaultValue={erhoehung.titel ?? 'Mietzinserhöhung'}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Grund</label>
          <select
            name="grund"
            defaultValue={erhoehung.grund ?? 'renovation'}
            className="w-full rounded border px-3 py-2"
          >
            <option value="renovation">Renovation</option>
            <option value="referenzzins">Referenzzinssatz</option>
            <option value="teuerung">Teuerung</option>
            <option value="kostensteigerung">Kostensteigerung</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select
            name="status"
            defaultValue={erhoehung.status ?? 'entwurf'}
            className="w-full rounded border px-3 py-2"
          >
            <option value="entwurf">Entwurf</option>
            <option value="berechnet">Berechnet</option>
            <option value="versendet">Versendet</option>
            <option value="angefochten">Angefochten</option>
            <option value="aktiv">Aktiv</option>
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Investition total
            </label>
            <input
              name="investition_total"
              type="number"
              step="0.01"
              defaultValue={erhoehung.investition_total ?? 0}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Netto-Investition
            </label>
            <input
              name="netto_investition"
              type="number"
              step="0.01"
              defaultValue={erhoehung.netto_investition ?? 0}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Jahressatz total
            </label>
            <input
              name="jahressatz_total"
              type="number"
              step="0.01"
              defaultValue={erhoehung.jahressatz_total ?? 0}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Änderungen speichern
        </button>
      </form>

      <form action={loeschen} className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-700">Mietzinserhöhung löschen</h2>
        <p className="mt-1 text-sm text-red-600">
          Diese Aktion löscht die Mietzinserhöhung dauerhaft.
        </p>

        <button
          type="submit"
          className="mt-4 rounded bg-red-600 px-4 py-2 text-white"
        >
          Löschen
        </button>
      </form>
    </div>
  );
}
