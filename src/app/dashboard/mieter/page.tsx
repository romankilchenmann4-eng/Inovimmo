import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function MieterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: wohnung } = await supabase
    .from("wohnungen")
    .select("*, liegenschaft:liegenschaften(name,strasse,hausnummer,plz,ort,verwalter_id)")
    .eq("mieter_id", user!.id)
    .maybeSingle();

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();

  const [
    { data: meineTickets },
    { data: ungeleseneNachrichten },
    { data: dokumente },
    { data: verwalterProfile },
  ] = await Promise.all([
    supabase.from("tickets").select("id,titel,status,prioritaet,created_at").eq("erstellt_von", user!.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("nachrichten").select("id").eq("empfaenger_id", user!.id).eq("gelesen", false),
    wohnung
      ? supabase.from("dokumente").select("id,name,typ,created_at").eq("liegenschaft_id", (wohnung.liegenschaft as { id?: string } | null)?.id ?? "").order("created_at", { ascending: false }).limit(5)
      : { data: [] },
    wohnung
      ? supabase.from("profiles").select("full_name,email").eq("id", (wohnung.liegenschaft as { verwalter_id?: string } | null)?.verwalter_id ?? "").maybeSingle()
      : { data: null },
  ]);

  const unreadCount = ungeleseneNachrichten?.length ?? 0;

  const STATUS: Record<string, { label: string; cls: string }> = {
    neu:                  { label: "Neu",            cls: "badge-red" },
    ausgeschrieben:       { label: "In Bearbeitung", cls: "badge-amber" },
    offerten_eingegangen: { label: "Offerten läuft", cls: "badge-blue" },
    vergeben:             { label: "Vergeben",        cls: "badge-blue" },
    in_ausfuehrung:       { label: "In Ausführung",  cls: "badge-amber" },
    abgeschlossen:        { label: "Erledigt",        cls: "badge-green" },
  };

  type Liegenschaft = { name: string; strasse: string; hausnummer: string; plz: string; ort: string; verwalter_id: string };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[hsl(214,62%,17%)] to-[hsl(214,55%,23%)] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-6 bottom-4 text-7xl opacity-10">🏠</div>
        <p className="text-white/50 text-xs mb-1">Guten Tag, {profile?.full_name?.split(" ")[0]}</p>
        {wohnung ? (
          <>
            <h2 className="text-xl font-bold mb-3">
              {(wohnung.liegenschaft as Liegenschaft | null)?.strasse} {(wohnung.liegenschaft as Liegenschaft | null)?.hausnummer}, {wohnung.bezeichnung}
            </h2>
            <p className="text-white/60 text-xs mb-3">{(wohnung.liegenschaft as Liegenschaft | null)?.plz} {(wohnung.liegenschaft as Liegenschaft | null)?.ort}</p>
            <div className="flex gap-6">
              <div>
                <p className="text-white/50 text-xs">Nettomiete</p>
                <p className="text-xl font-bold">CHF {Number(wohnung.nettomiete).toLocaleString("de-CH")}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs">NK à-conto</p>
                <p className="text-xl font-bold">CHF {Number(wohnung.nebenkosten_akonto).toLocaleString("de-CH")}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Mietbeginn</p>
                <p className="text-xl font-bold">
                  {wohnung.mietbeginn ? new Date(wohnung.mietbeginn).toLocaleDateString("de-CH", { month: "short", year: "numeric" }) : "—"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-white/70 mt-2">Keine Wohnung zugewiesen. Kontaktieren Sie Ihre Verwaltung.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/dashboard/tickets/neu" className="bg-white rounded-xl border border-border p-4 hover:border-[hsl(214,76%,49%)] hover:shadow-md transition-all group">
          <div className="text-2xl mb-2">🔧</div>
          <p className="font-semibold text-gray-900 text-sm">Schaden melden</p>
          <p className="text-xs text-gray-400 mt-0.5">Ticket erstellen + Fotos</p>
        </Link>
        <Link href="/dashboard/nachrichten" className="bg-white rounded-xl border border-border p-4 hover:border-[hsl(214,76%,49%)] hover:shadow-md transition-all group relative">
          {unreadCount > 0 && (
            <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
          <div className="text-2xl mb-2">💬</div>
          <p className="font-semibold text-gray-900 text-sm">Nachrichten</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} ungelesen` : "Verwaltung kontaktieren"}
          </p>
        </Link>
      </div>

      {/* Verwalter contact */}
      {verwalterProfile && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Meine Verwaltung</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(214,76%,49%)] flex items-center justify-center text-white text-sm font-bold">
              {(verwalterProfile.full_name ?? "V").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-gray-900">{verwalterProfile.full_name ?? "Verwaltung"}</p>
              {verwalterProfile.email && <p className="text-xs text-gray-500">{verwalterProfile.email}</p>}
            </div>
            <Link href="/dashboard/nachrichten" className="px-3 py-1.5 bg-[hsl(214,76%,49%)] text-white text-xs font-semibold rounded-lg hover:bg-[hsl(214,76%,44%)]">
              Nachricht senden
            </Link>
          </div>
        </div>
      )}

      {/* My tickets */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900">Meine Tickets</h3>
          <Link href="/dashboard/tickets/neu" className="text-xs text-[hsl(214,76%,49%)] font-medium">+ Neu</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {!meineTickets?.length ? (
            <div className="py-8 text-center text-gray-400">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm">Keine Tickets erstellt</p>
            </div>
          ) : meineTickets.map(t => {
            const s = STATUS[t.status] ?? { label: t.status, cls: "badge-gray" };
            return (
              <Link key={t.id} href={`/dashboard/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <span className="text-base">{t.prioritaet === "notfall" ? "🔥" : t.prioritaet === "dringend" ? "⚡" : "🔵"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.titel}</p>
                  <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString("de-CH")}</p>
                </div>
                <span className={s.cls}>{s.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-gray-50">
          <Link href="/dashboard/tickets" className="text-xs text-[hsl(214,76%,49%)] hover:underline">Alle Tickets anzeigen →</Link>
        </div>
      </div>

      {/* Dokumente */}
      {(dokumente?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900">Dokumente</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {dokumente!.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="text-lg">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                  <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString("de-CH")}</p>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{d.typ}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Mieter-Services</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "🚛", label: "Umzug", sub: "Offerten einholen" },
            { icon: "📡", label: "Internet", sub: "Angebote vergleichen" },
            { icon: "🧹", label: "Reinigung", sub: "Endreinigung" },
          ].map(s => (
            <div key={s.label} className="p-3 bg-gray-50 rounded-lg text-center hover:bg-blue-50 transition-colors cursor-pointer">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-xs font-semibold text-gray-900">{s.label}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
