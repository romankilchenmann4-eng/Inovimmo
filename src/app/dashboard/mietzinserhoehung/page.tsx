import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function MietzinsErhoehungPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('SUPABASE ERROR mietzins_erhoehungen:', error);
    throw new Error(error.message);
  }

  const erhoehungen = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mietzinserhöhungen</h1>

        <Link
          href="/dashboard/mietzinserhoehung/neu"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Neue Mietzinserhöhung
        </Link>
      </div>

      {erhoehungen.length === 0 ? (
        <div className="rounded border p-6 text-sm text-gray-600">
          Noch keine Mietzinserhöhung vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {erhoehungen.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/mietzinserhoehung/${e.id}`}
              className="block rounded border p-4 hover:bg-gray-50"
            >
              <div className="font-medium">
                {e.titel ?? 'Mietzinserhöhung'}
              </div>

              <div className="text-sm text-gray-500">
                Status: {e.status ?? 'entwurf'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
