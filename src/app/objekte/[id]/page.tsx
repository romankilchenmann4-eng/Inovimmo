import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import AddWohnungForm from "./AddWohnungForm";

export default async function LiegenschaftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: l } = await supabase.from("liegenschaften").select("*").eq("id", id).single();
  if (!l) notFound();

  const { data: wohnungen } = await supabase
    .from("wohnungen")
    .select("*, mieter:profiles!wohnungen_mieter_id_fkey(full_name, email, phone)")
    .eq("liegenschaft_id", id)
    .order("etage").order("bezeichnung");

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, titel, status, prioritaet, created_at")
    .eq("liegenschaft_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const vermietet = wohnungen?.filter(w => w.status === "vermietet").length ?? 0;
  const total = wohnungen?.length ?? 0;
  const mieteinnahmen = wohnungen?.reduce((s, w) => s + (w.nettomiete ?? 0), 0) ?? 0;

  const statusCls: Record<string,string> = {
    vermietet: "badge-green", leer: "badge-red", kuendigung: "badge-amber"
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-3xl flex-shrink-0">🏢</div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">{l.name}</h2>
            <span className="badge-gray">{l.objekttyp}</span>
          </div>
          <p className="text-sm text-gray-500">{l.strasse} {l.hausnummer}, {l.plz} {l.ort} · Kanton {l.kanton}{l.baujahr ? ` · Baujahr ${l.baujahr}` : ""}</p>
        </div>
        <Link href="/dashboard/objekte" className="text-sm text-gray-400 hover:text-gray-600">← Zurück</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Wohnungen", value: l.anzahl_wohnungen },
          { label: "Belegt", value: `${vermietet}/${total}` },
          { label: "Belegung", value: `${total > 0 ? Math.round((vermietet/total)*100) : 0}%` },
          { label: "Nettomiete/Mt.", value: mieteinnahmen > 0 ? `CHF ${mieteinnahmen.toLocaleString("de-CH")}` : "—" },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Wohnungen */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Wohnungen</h3>
          </div>

          {!wohnungen?.length ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center text-gray-400">
              <p className="text-2xl mb-2">🏠</p>
              <p className="text-sm">Noch keine Wohnungen erfasst.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Wohnung</th>
                    <th className="table-header">Zimmer</th>
                    <th className="table-header">Miete</th>
                    <th className="table-header">Mieter</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {wohnungen.map(w => (
                    <tr key={w.id} className="table-row">
                      <td className="table-cell font-medium">{w.bezeichnung}{w.etage > 0 ? ` (${w.etage}.OG)` : " (EG)"}</td>
                      <td className="table-cell">{w.zimmer} Zi.</td>
                      <td className="table-cell">CHF {Number(w.nettomiete).toLocaleString("de-CH")}</td>
                      <td className="table-cell text-sm text-gray-600">
                        {(w.mieter as unknown as {full_name:string})?.full_name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell">
                        <span className={statusCls[w.status] ?? "badge-gray"}>
                          {w.status === "vermietet" ? "Vermietet" : w.status === "leer" ? "Leer" : "Kündigung"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Wohnung */}
          <AddWohnungForm liegenschaftId={id} />
        </div>

        {/* Sidebar: Tickets + Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h4 className="font-semibold text-sm text-gray-900">Letzte Tickets</h4>
              <Link href={`/dashboard/tickets?liegenschaft=${id}`} className="text-xs text-[hsl(214,76%,49%)]">Alle →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {!tickets?.length ? (
                <p className="py-6 text-center text-xs text-gray-400">Keine Tickets</p>
              ) : tickets.map(t => (
                <Link key={t.id} href={`/dashboard/tickets/${t.id}`} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50">
                  <span className="text-sm">{t.prioritaet === "notfall" ? "🔥" : t.prioritaet === "dringend" ? "⚡" : "🔵"}</span>
                  <span className="text-xs text-gray-700 flex-1 truncate">{t.titel}</span>
                </Link>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-50">
              <Link href={`/dashboard/tickets/neu`} className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-[hsl(214,76%,49%)] hover:bg-blue-50 rounded-lg">
                + Neues Ticket
              </Link>
            </div>
          </div>

          {l.notizen && (
            <div className="info-box-blue">
              <p className="text-xs font-semibold text-blue-800 mb-1">Notizen</p>
              <p className="text-xs text-blue-700">{l.notizen}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
