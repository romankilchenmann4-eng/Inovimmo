import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import SubNav from "@/components/ui/SubNav";
import RefzinsRechner from "./RefzinsRechner";

const DOKUMENTE_NAV = [
  { href: "/dashboard/dokumente",              label: "Dokumente" },
  { href: "/dashboard/mietvertrag",            label: "Mietvertrag" },
  { href: "/dashboard/mietzinserhoehung",      label: "Mietzinserhöhung" },
  { href: "/dashboard/dokumente/jahresbericht", label: "Jahresbericht" },
];

const STATUS_CLS: Record<string, string> = {
  entwurf:    "bg-gray-100 text-gray-600",
  versendet:  "bg-blue-100 text-blue-700",
  abgeschlossen: "bg-green-100 text-green-700",
};

export default async function MietzinsErhoehungPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-6 text-sm text-red-700">
        Fehler beim Laden: {error.message}
      </div>
    );
  }

  const erhoehungen = data ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <SubNav items={DOKUMENTE_NAV} />

      {/* Referenzzinssatz-Rechner */}
      <RefzinsRechner />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mietzinserhöhungen</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{erhoehungen.length} Einträge</p>
        </div>
        <Link href="/dashboard/mietzinserhoehung/neu" className="btn-primary">
          + Neue Mietzinserhöhung
        </Link>
      </div>

      {erhoehungen.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-10 text-center text-gray-400">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Noch keine Mietzinserhöhung vorhanden</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {erhoehungen.map((e) => (
              <Link
                key={e.id}
                href={`/dashboard/mietzinserhoehung/${e.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{e.titel ?? 'Mietzinserhöhung'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(e.created_at).toLocaleDateString("de-CH")}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CLS[e.status ?? "entwurf"] ?? "bg-gray-100 text-gray-600"}`}>
                  {e.status ?? "Entwurf"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
