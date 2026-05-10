import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  speichereUndBerechneErhoehung,
  loescheErhoehung,
} from '@/lib/mietzinserhoehung/actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MietzinsErhoehungDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: erhoehung, error: erhoehungError } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (erhoehungError) {
    return <ErrorBox title="Fehler Mietzinserhöhung" error={erhoehungError} />;
  }

  if (!erhoehung) {
    return <div>Mietzinserhöhung nicht gefunden.</div>;
  }

  const { data: positionen, error: positionenError } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('mietzins_erhoehung_id', id);

  if (positionenError) {
    return <ErrorBox title="Fehler Positionen" error={positionenError} />;
  }

  const wohnungIds = (positionen ?? [])
    .map((p: any) => p.wohnung_id)
    .filter(Boolean);

  const { data: wohnungen } = wohnungIds.length
    ? await supabase
        .from('wohnungen')
        .select('*')
        .in('id', wohnungIds)
    : { data: [] };

  const wohnungMap = new Map<string, any>(
    (wohnungen ?? []).map((w: any) => [w.id, w])
  );

  async function speichernUndBerechnen(formData: FormData) {
    'use server';

    await speichereUndBerechneErhoehung(id, formData);

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

      <form
        action={speichernUndBerechnen}
        className="space-y-4 rounded border p-6"
      >
        <h2 className="text-lg font-semibold">
          Berechnung bearbeiten
        </h2>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Titel
          </label>

          <input
            name="titel"
            defaultValue={erhoehung.titel ?? 'Mietzinserhöhung'}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Grund
            </label>

            <select
              name="grund"
              defaultValue={erhoehung.grund ?? 'renovation'}
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

          <div>
            <label className="mb-1 block text-sm font-medium">
              Status
            </label>

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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            name="investition_total"
            label="Investition total"
            value={erhoehung.investition_total}
          />

          <NumberField
            name="foerderbeitraege"
            label="Fördergelder"
            value={erhoehung.foerderbeitraege}
          />

          <NumberField
            name="sonstige_kosten"
            label="Sonstige Kosten"
            value={erhoehung.sonstige_kosten}
          />

          <NumberField
            name="sonstige_abzuege"
            label="Sonstige Abzüge"
            value={erhoehung.sonstige_abzuege}
          />

          <NumberField
            name="wertvermehrend_prozent"
            label="Wertvermehrender Anteil %"
            value={erhoehung.wertvermehrend_prozent ?? 70}
          />

          <NumberField
            name="kapitalisierungssatz"
            label="Kapitalisierungssatz %"
            value={erhoehung.kapitalisierungssatz ?? 8}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard
            label="Netto-Investition"
            value={formatCHF(erhoehung.netto_investition)}
          />

          <InfoCard
            label="Jährlicher Umlagebetrag"
            value={formatCHF(erhoehung.jahressatz_total)}
          />
        </div>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Speichern & neu berechnen
        </button>
      </form>

      <div className="rounded border">
        <div className="border-b p-4">
          <h2 className="font-semibold">
            Detailauflistung pro Wohnung
          </h2>

          <p className="text-sm text-gray-500">
            Alte Miete, monatliche Erhöhung und neue berechnete Miete.
          </p>
        </div>

        {(positionen ?? []).length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            Noch keine Wohnungen / Positionen vorhanden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Wohnung</th>
                  <th className="p-3">Anteil</th>
                  <th className="p-3">Alte Nettomiete</th>
                  <th className="p-3">Erhöhung / Mt.</th>
                  <th className="p-3">Neue Nettomiete</th>
                  <th className="p-3">Investitionsanteil</th>
                  <th className="p-3">Formular</th>
                </tr>
              </thead>

              <tbody>
                {(positionen ?? []).map((p: any) => {
                  const w = wohnungMap.get(p.wohnung_id);

                  const wohnungLabel =
                    [w?.whg_nr, w?.bezeichnung]
                      .filter(Boolean)
                      .join(' · ') ||
                    w?.name ||
                    p.wohnung_id;

                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-3 font-medium">
                        {wohnungLabel}
                      </td>

                      <td className="p-3">
                        {formatPercent(p.verteilschluessel_prozent)}
                      </td>

                      <td className="p-3">
                        {formatCHF(p.miete_alt)}
                      </td>

                      <td className="p-3 font-medium">
                        {formatCHF(p.erhoehung_monatlich ?? p.erhoehung_betrag)}
                      </td>

                      <td className="p-3 font-semibold">
                        {formatCHF(p.miete_neu)}
                      </td>

                      <td className="p-3">
                        {formatCHF(p.investitionsanteil)}
                      </td>

                      <td className="p-3">
                        <Link
                          href={`/dashboard/mietzinserhoehung/${id}/export/formular/${p.id}`}
                          className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                        >
                          Amtliches Formular
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border bg-gray-50 p-6">
        <h2 className="font-semibold">
          Export
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Export der berechneten Mietzinserhöhung pro Wohnung.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/mietzinserhoehung/${id}/export/csv`}
            className="inline-block rounded bg-black px-4 py-2 text-white"
          >
            CSV exportieren
          </Link>

          <Link
            href={`/dashboard/mietzinserhoehung/${id}/export/pdf`}
            className="inline-block rounded border px-4 py-2"
          >
            PDF Vorschau
          </Link>
        </div>
      </div>

      <form
        action={loeschen}
        className="rounded border border-red-200 bg-red-50 p-6"
      >
        <h2 className="font-semibold text-red-700">
          Mietzinserhöhung löschen
        </h2>

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

function NumberField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: unknown;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
      </label>

      <input
        name={name}
        type="number"
        step="0.01"
        defaultValue={Number(value || 0)}
        className="w-full rounded border px-3 py-2"
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border bg-gray-50 p-4">
      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div className="mt-1 font-semibold">
        {value}
      </div>
    </div>
  );
}

function ErrorBox({
  title,
  error,
}: {
  title: string;
  error: any;
}) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-6 text-sm text-red-700">
      <div className="font-semibold">
        {title}
      </div>

      <div>Message: {error.message}</div>
      <div>Code: {error.code}</div>
      <div>Details: {error.details}</div>
      <div>Hint: {error.hint}</div>
    </div>
  );
}

function formatCHF(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'CHF 0.00';
  }

  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(number);
}

function formatPercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '0%';
  }

  return `${number}%`;
}
