import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user!.id).single();

  // Fetch stats
  const [
    { count: totalWohnungen },
    { count: belegteWohnungen },
    { count: offeneTickets },
    { count: dringendeTickets },
    { data: escrows },
    { data: recentTickets },
    { data: liegenschaften },
  ] = await Promise.all([
    supabase.from("wohnungen").select("*", { count: "exact", head: true }),
    supabase.from("wohnungen").select("*", { count: "exact", head: true }).eq("status", "vermietet"),
    supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["neu","ausgeschrieben","offerten_eingegangen"]),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("prioritaet", "notfall").in("status", ["neu","ausgeschrieben"]),
    supabase.from("escrows").select("betrag").in("status", ["einbezahlt","in_ausfuehrung"]),
    supabase.from("tickets").select("id,titel,prioritaet,status,created_at,liegenschaft:liegenschaften(name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("liegenschaften").select("id,name,ort,anzahl_wohnungen").limit(5),
  ]);

  const escrowGesperrt = escrows?.reduce((s, e) => s + (e.betrag ?? 0), 0) ?? 0;
  const leerstandQuote = totalWohnungen
    ? (((totalWohnungen - (belegteWohnungen ?? 0)) / totalWohnungen) * 100).toFixed(1)
    : "0.0";

  const statusLabels: Record<string, { label: string; cls: string }> = {
    neu:                  { label: "Neu",           cls: "badge-red" },
    ausgeschrieben:       { label: "Ausgeschrieben", cls: "badge-amber" },
    offerten_eingegangen: { label: "Offerte wählen", cls: "badge-blue" },
    vergeben:             { label: "Vergeben",       cls: "badge-blue" },
    in_ausfuehrung:       { label: "In Ausführung",  cls: "badge-amber" },
    abgeschlossen:        { label: "Abgeschlossen",  cls: "badge-green" },
    storniert:            { label: "Storniert",      cls: "badge-gray" },
  };

  const prioIcons: Record<string, string> = {
    notfall: "🔥", dringend: "⚡", normal: "🔵",
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Guten Tag, {profile?.full_name?.split(" ")[0] ?? ""}! 👋
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Hier ist Ihre aktuelle Übersicht.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Wohnungen</p>
          <p className="text-3xl font-bold text-gray-900">{totalWohnungen ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">{belegteWohnungen ?? 0} belegt</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${totalWohnungen ? ((belegteWohnungen ?? 0) / totalWohnungen) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Offene Tickets</p>
          <p className={`text-3xl font-bold ${(offeneTickets ?? 0) > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {offeneTickets ?? 0}
          </p>
          {(dringendeTickets ?? 0) > 0 && (
            <p className="text-xs text-red-600 mt-1 font-medium">🔥 {dringendeTickets} Notfall</p>
          )}
        </div>

        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Escrow gesperrt</p>
          <p className="text-3xl font-bold text-gray-900">
            CHF {escrowGesperrt.toLocaleString("de-CH")}
          </p>
          <p className="text-xs text-gray-400 mt-1">Laufende Aufträge</p>
        </div>

        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Leerstand</p>
          <p className={`text-3xl font-bold ${parseFloat(leerstandQuote) > 5 ? "text-amber-600" : "text-green-600"}`}>
            {leerstandQuote}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Inovimmo: CHF 0</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <div className="bg-white rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Neueste Tickets</h3>
            <Link href="/dashboard/tickets" className="text-xs text-[hsl(214,76%,49%)] font-medium hover:underline">
              Alle anzeigen →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentTickets?.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-sm">
                <p className="text-2xl mb-2">🎫</p>
                Noch keine Tickets.{" "}
                <Link href="/dashboard/tickets" className="text-[hsl(214,76%,49%)]">Erstes erstellen →</Link>
              </div>
            )}
            {recentTickets?.map((t) => (
              <Link key={t.id} href={`/dashboard/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <span className="text-lg">{prioIcons[t.prioritaet] ?? "🔵"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.titel}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {(t.liegenschaft as unknown as {name:string})?.name ?? "—"}
                  </p>
                </div>
                <span className={statusLabels[t.status]?.cls ?? "badge-gray"}>
                  {statusLabels[t.status]?.label ?? t.status}
                </span>
              </Link>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <Link
              href="/dashboard/tickets/neu"
              className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-[hsl(214,76%,49%)] hover:bg-blue-50 rounded-lg transition-colors"
            >
              + Neues Ticket erstellen
            </Link>
          </div>
        </div>

        {/* Liegenschaften */}
        <div className="bg-white rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Meine Liegenschaften</h3>
            <Link href="/dashboard/objekte" className="text-xs text-[hsl(214,76%,49%)] font-medium hover:underline">
              Alle anzeigen →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {liegenschaften?.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-sm">
                <p className="text-2xl mb-2">🏢</p>
                Noch keine Liegenschaften.{" "}
                <Link href="/dashboard/objekte/neu" className="text-[hsl(214,76%,49%)]">Erste hinzufügen →</Link>
              </div>
            )}
            {liegenschaften?.map((l) => (
              <Link key={l.id} href={`/dashboard/objekte/${l.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-base flex-shrink-0">
                  🏢
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{l.name}</p>
                  <p className="text-xs text-gray-400">{l.ort} · {l.anzahl_wohnungen} Wohnungen</p>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </Link>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <Link
              href="/dashboard/objekte/neu"
              className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-[hsl(214,76%,49%)] hover:bg-blue-50 rounded-lg transition-colors"
            >
              + Liegenschaft hinzufügen
            </Link>
          </div>
        </div>
      </div>

      {/* Platform Cost Banner */}
      <div className="info-box-green flex items-center gap-4">
        <div className="text-3xl">🎉</div>
        <div>
          <p className="text-sm font-semibold text-green-800">Inovimmo ist kostenlos für Sie</p>
          <p className="text-xs text-green-700 mt-0.5">
            Keine Lizenzgebühren, keine versteckten Kosten. Plattformkosten werden durch Dienstleister-Provisionen finanziert.
          </p>
        </div>
      </div>
    </div>
  );
}
