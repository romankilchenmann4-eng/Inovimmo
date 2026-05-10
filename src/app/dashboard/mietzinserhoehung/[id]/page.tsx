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

      <div className="rounded border p-6">
        <h2 className="text-lg font-semibold">Berechnung</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <InfoCard label="Investition total" value={formatCHF(erhoehung.investition_total)} />
          <InfoCard label="Fördergelder" value={formatCHF(erhoehung.foerderbeitraege)} />
          <InfoCard label="Sonstige Kosten" value={formatCHF(erhoehung.sonstige_kosten)} />
          <InfoCard label="Sonstige Abzüge" value={formatCHF(erhoehung.sonstige_abzuege)} />
          <InfoCard label="Netto-Investition" value={formatCHF(erhoehung.netto_investition)} />
          <InfoCard label="Jahresbetrag total" value={formatCHF(erhoehung.jahressatz_total)} />
        </div>
      </div>

      <div className="rounded border">
        <div className="border-b p-4">
          <h2 className="font-semibold">
            Detailauflistung pro Wohnung
          </h2>
        </div>

        {(positionen ?? []).length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            Noch keine Wohnungen / Positionen vorhanden.
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {(positionen ?? []).map((p) => (
              <div key={p.id} className="rounded border p-4">
                <div className="font-medium">
                  Wohnung: {p.wohnung_id}
                </div>
                <div className="text-sm text-gray-500">
                  Alte Miete: {formatCHF(p.miete_alt)} · Erhöhung: {formatCHF(p.erhoehung_monatlich)} · Neue Miete: {formatCHF(p.miete_neu)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-gray-50 p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function ErrorBox({ title, error }: { title: string; error: any }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-6 text-sm text-red-700">
      <div className="font-semibold">{title}</div>
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
