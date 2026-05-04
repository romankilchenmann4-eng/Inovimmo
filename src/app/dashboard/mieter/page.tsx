import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function MieterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: wohnung } = await supabase
    .from("wohnungen")
    .select("*, liegenschaft:liegenschaften(name,strasse,hausnummer,plz,ort,verwalter_id), verwalter:liegenschaften(profiles!liegenschaften_verwalter_id_fkey(full_name,email,phone))")
    .eq("mieter_id", user!.id)
    .single();

  const { data: meineTickets } = await supabase
    .from("tickets")
    .select("id,titel,status,prioritaet,created_at,updated_at")
    .eq("erstellt_von", user!.id)
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id",user!.id).single();

  const STATUS: Record<string,{label:string,cls:string}> = {
    neu:                  { label:"Neu",           cls:"badge-red" },
    ausgeschrieben:       { label:"In Bearbeitung",cls:"badge-amber" },
    offerten_eingegangen: { label:"Offerten läuft",cls:"badge-blue" },
    vergeben:             { label:"Vergeben",       cls:"badge-blue" },
    in_ausfuehrung:       { label:"In Ausführung", cls:"badge-amber" },
    abgeschlossen:        { label:"Erledigt",       cls:"badge-green" },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[hsl(214,62%,17%)] to-[hsl(214,55%,23%)] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-6 bottom-4 text-7xl opacity-10">🏠</div>
        <p className="text-white/50 text-xs mb-1">Guten Tag, {profile?.full_name?.split(" ")[0]}</p>
        {wohnung ? (
          <>
            <h2 className="text-xl font-bold font-serif mb-3">
              {(wohnung.liegenschaft as unknown as {strasse:string,hausnummer:string})?.strasse} {(wohnung.liegenschaft as unknown as {hausnummer:string})?.hausnummer}, {wohnung.bezeichnung}
            </h2>
            <div className="flex gap-6">
              <div><p className="text-white/50 text-xs">Nettomiete</p><p className="text-xl font-bold">CHF {Number(wohnung.nettomiete).toLocaleString("de-CH")}</p></div>
              <div><p className="text-white/50 text-xs">NK à-conto</p><p className="text-xl font-bold">CHF {Number(wohnung.nebenkosten_akonto).toLocaleString("de-CH")}</p></div>
              <div><p className="text-white/50 text-xs">Mietbeginn</p><p className="text-xl font-bold">{wohnung.mietbeginn ? new Date(wohnung.mietbeginn).toLocaleDateString("de-CH",{month:"short",year:"numeric"}) : "—"}</p></div>
            </div>
          </>
        ) : (
          <p className="text-white/70">Keine Wohnung zugewiesen. Kontaktieren Sie Ihre Verwaltung.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/dashboard/tickets/neu" className="bg-white rounded-xl border border-border p-4 hover:border-[hsl(214,76%,49%)] hover:shadow-md transition-all group">
          <div className="text-2xl mb-2">🔧</div>
          <p className="font-semibold text-gray-900 text-sm">Schaden melden</p>
          <p className="text-xs text-gray-400 mt-0.5">Ticket erstellen</p>
        </Link>
        <div className="bg-white rounded-xl border border-border p-4 opacity-60 cursor-not-allowed">
          <div className="text-2xl mb-2">📄</div>
          <p className="font-semibold text-gray-900 text-sm">Dokumente</p>
          <p className="text-xs text-gray-400 mt-0.5">Mietvertrag, NK-Abrechnung</p>
        </div>
      </div>

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
              <p className="text-sm">Keine offenen Tickets</p>
            </div>
          ) : meineTickets.map(t => {
            const s = STATUS[t.status] ?? {label:t.status,cls:"badge-gray"};
            return (
              <Link key={t.id} href={`/dashboard/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <span className="text-base">{t.prioritaet==="notfall"?"🔥":t.prioritaet==="dringend"?"⚡":"🔵"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.titel}</p>
                  <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString("de-CH")}</p>
                </div>
                <span className={s.cls}>{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Services */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Mieter-Services</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon:"🚛", label:"Umzug", sub:"Offerten einholen" },
            { icon:"📡", label:"Internet", sub:"Angebote vergleichen" },
            { icon:"🧹", label:"Reinigung", sub:"Endreinigung" },
          ].map(s => (
            <div key={s.label} className="p-3 bg-gray-50 rounded-lg text-center cursor-pointer hover:bg-blue-50 transition-colors">
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
