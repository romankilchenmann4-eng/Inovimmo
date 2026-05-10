import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

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
    return (
      <div className="rounded border border-red-300 bg-red-50 p-6 text-sm text-red-700">
        Fehler beim Laden der Mietzinserhöhung: {erhoehungError.message}
      </div>
    );
  }

  if (!erhoehung) {
    return <div>Mietzinserhöhung nicht gefunden.</div>;
  }

  const { data: positionen, error: positionenError } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('mietzins_erhoehung_id', id);

  if (positionenError) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-6 text-sm text-red-700">
        Fehler beim Laden der Wohnungen: {positionenError.message}
      </div>
    );
  }

  const wohnungIds = (positionen ?? [])
    .map((p) => p.wohnung_id)
    .filter(Boolean);

  const { data: wohnungen } = wohnungIds.length
    ? await supabase
        .from('wohnungen')
        .select('*')
        .in('id', wohnungIds)
    : { data: [] };

  const wohnungMap = new Map(
    (wohnungen ?? []).map((w) => [w.id, w])
  );

  const rows = (positionen ?? []).map((p) => {
    const w = wohnungMap.get(p.wohnung_id) ?? {};

    return {
      id: p.id,
      wohnung_id: p.wohnung_id,
      wohnung: w,
      position: p,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/mietzinserhoehung"
          className="text-sm text-gray-500 hover:underline"
        >
          ← Zurück
        </Link>

        <h1 className="mt-2 text-2xl font-bold">
          {erhoehung.titel ?? 'Mietzinserhöhung'}
        </h1>

        <p className="text-sm text-gray-500">
          Status: {erhoehung.status ?? 'entwurf'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <InfoCard label="Grund" value={erhoehung.grund ?? '-'} />
        <InfoCard label="Investition total" value={formatCHF(erhoehung.investition_total)} />
        <InfoCard label="Netto-Investition" value={formatCHF(erhoehung.netto_investition)} />
        <InfoCard label="Jahressatz total" value={formatCHF(erhoehung.jahressatz_total)} />
      </div>

      <div className="rounded border">
        <div className="border-b p-4">
          <h2 className="font-semibold">
            Detailauflistung pro Wohnung
          </h2>
          <p className="text-sm text-gray-500">
            Übersicht aller Wohnungen, die dieser Mietzinserhöhung zugeordnet sind.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            Noch keine Wohnungen / Positionen vorhanden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Wohnung</th>
                  <th className="p-3">Mieter</th>
                  <th className="p-3">Aktuelle Miete</th>
                  <th className="p-3">Erhöhung</th>
                  <th className="p-3">Neue Miete</th>
                  <th className="p-3">Beheizt</th>
                </tr>
              </thead>

              <tbody>
                {rows.map(({ id, wohnung, position }) => (
                  <tr key={id} className="border-t">
                    <td className="p-3">
                      {wohnung.name ??
                        wohnung.nummer ??
                        wohnung.bezeichnung ??
                        wohnung.id ??
                        'Wohnung'}
                    </td>

                    <td className="p-3">
                      {wohnung.mieter_name ??
                        wohnung.mieter ??
                        wohnung.mieter_id ??
                        '-'}
                    </td>

                    <td className="p-3">
                      {formatCHF(
                        position.miete_alt ??
                          wohnung.miete ??
                          wohnung.netto_miete
                      )}
                    </td>

                    <td className="p-3">
                      {formatCHF(
                        position.erhoehung_betrag ??
                          position.monatliche_erhoehung
                      )}
                    </td>

                    <td className="p-3">
                      {formatCHF(
                        position.miete_neu ??
                          position.neue_miete
                      )}
                    </td>

                    <td className="p-3">
                      {position.beheizt ? 'Ja' : 'Nein'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border bg-gray-50 p-4 text-sm text-gray-600">
        Vorschlag nächste Ausbaustufe: automatische Berechnung pro Wohnung mit Anteil nach Fläche,
        aktueller Nettomiete, wertvermehrender Investition, Heizkosten-Relevanz und neuer Monatsmiete.
      </div>
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
    <div className="rounded border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function formatCHF(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '-';
  }

  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(number);
}
