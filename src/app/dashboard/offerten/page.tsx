import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_CONFIG = {
  ausstehend: { label: "Ausstehend", cls: "badge-amber" },
  akzeptiert:  { label: "Akzeptiert",  cls: "badge-green" },
  abgelehnt:   { label: "Abgelehnt",   cls: "badge-red"   },
} as const;

export default async function OffertenPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: offerten } = await supabase
    .from("offerten")
    .select(`
      id, betrag, beschreibung, status, created_at,
      ticket:tickets(id, titel, prioritaet,
        liegenschaft:liegenschaften(name, ort)
      ),
      dienstleister:profiles!offerten_dienstleister_id_fkey(full_name, firma)
    `)
    .order("created_at", { ascending: false });

  const counts = {
    ausstehend: offerten?.filter(o => o.status === "ausstehend").length ?? 0,
    akzeptiert: offerten?.filter(o => o.status === "akzeptiert").length ?? 0,
    total: offerten?.length ?? 0,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Offerten</h2>
          <p className="text-sm text-gray-500">
            {counts.total} total · {counts.ausstehend} ausstehend
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total",       value: counts.total,      color: "text-gray-800" },
          { label: "Ausstehend",  value: counts.ausstehend, color: "text-amber-600" },
          { label: "Akzeptiert",  value: counts.akzeptiert, color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {!offerten?.length ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium text-gray-600">Noch keine Offerten</p>
            <p className="text-sm mt-1 mb-4">
              Offerten werden eingereicht, sobald Dienstleister auf Tickets antworten.
            </p>
            <Link
              href="/dashboard/tickets"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl"
            >
              Zu den Tickets
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Ticket</th>
                  <th className="table-header">Dienstleister</th>
                  <th className="table-header">Betrag</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Datum</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {offerten.map((o) => {
                  const ticket = o.ticket as any;
                  const dl = o.dienstleister as any;
                  const s = STATUS_CONFIG[o.status as keyof typeof STATUS_CONFIG];
                  return (
                    <tr key={o.id} className="table-row">
                      <td className="table-cell">
                        <p className="font-medium text-gray-900 text-sm">
                          {ticket?.titel ?? "—"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {ticket?.liegenschaft?.name ?? ""}
                        </p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm">{dl?.full_name ?? "—"}</p>
                        {dl?.firma && (
                          <p className="text-xs text-gray-400">{dl.firma}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <p className="text-sm font-semibold text-gray-900">
                          CHF {(o.betrag ?? 0).toLocaleString("de-CH")}
                        </p>
                      </td>
                      <td className="table-cell">
                        <span className={s?.cls ?? "badge-gray"}>{s?.label ?? o.status}</span>
                      </td>
                      <td className="table-cell text-xs text-gray-400">
                        {new Date(o.created_at).toLocaleDateString("de-CH")}
                      </td>
                      <td className="table-cell">
                        <Link
                          href={`/dashboard/tickets/${ticket?.id}`}
                          className="text-xs text-[hsl(214,76%,49%)] font-medium hover:underline whitespace-nowrap"
                        >
                          Ticket →
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
    </div>
  );
}
