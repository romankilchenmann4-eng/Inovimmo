import { createClient } from "@/lib/supabase/server";
import EscrowActions from "./EscrowActions";
import SubNav from "@/components/ui/SubNav";

const AUFTRAEGE_NAV = [
  { href: "/dashboard/tickets",  label: "Tickets" },
  { href: "/dashboard/offerten", label: "Offerten" },
  { href: "/dashboard/escrow",   label: "Escrow & Zahlung" },
];

export default async function EscrowPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: escrows } = await supabase
    .from("escrows")
    .select("*, ticket:tickets(titel), offerte:offerten(betrag,verfuegbar_ab), dienstleister:profiles!escrows_dienstleister_id_fkey(full_name,firma)")
    .eq("verwalter_id", user!.id)
    .order("created_at", { ascending: false });

  const gesperrt = escrows?.filter(e => ["einbezahlt","in_ausfuehrung"].includes(e.status)).reduce((s,e) => s + e.betrag, 0) ?? 0;
  const ausgezahlt = escrows?.filter(e => e.status === "abgeschlossen").reduce((s,e) => s + e.betrag, 0) ?? 0;
  const provision = escrows?.reduce((s,e) => s + e.provision_betrag, 0) ?? 0;

  const STATUS: Record<string,{label:string,cls:string}> = {
    ausstehend:      { label: "Zahlung ausstehend", cls: "badge-red" },
    einbezahlt:      { label: "Einbezahlt",         cls: "badge-blue" },
    in_ausfuehrung:  { label: "In Ausführung",      cls: "badge-amber" },
    abgeschlossen:   { label: "Abgeschlossen",       cls: "badge-green" },
    zurueckerstattet:{ label: "Zurückerstattet",     cls: "badge-gray" },
    streit:          { label: "⚠ Streit",            cls: "badge-red" },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={AUFTRAEGE_NAV} />
      <div>
        <h2 className="text-xl font-bold text-gray-900">Escrow & Zahlungen</h2>
        <p className="text-sm text-gray-500">Sichere, treuhänderische Abwicklung aller Aufträge.</p>
      </div>

      {/* How it works */}
      <div className="info-box-blue">
        <p className="text-sm font-semibold text-blue-800 mb-2">🔒 So funktioniert Escrow</p>
        <div className="flex items-center gap-2 flex-wrap">
          {["Auftrag vergeben","→","Betrag einzahlen","→","Ausführung","→","Bestätigen","→","Auszahlung an Dienstleister"].map((s,i) => (
            <span key={i} className={`text-xs ${s==="→" ? "text-blue-300" : "font-medium text-blue-700 bg-white/60 px-2 py-1 rounded"}`}>{s}</span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-2">Das Geld fliesst erst nach Ihrer Bestätigung. Inovimmo-Provision: 6%.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Aktuell gesperrt", value: `CHF ${gesperrt.toLocaleString("de-CH")}`, color: "text-[hsl(214,76%,49%)]" },
          { label: "Total ausgezahlt", value: `CHF ${ausgezahlt.toLocaleString("de-CH")}`, color: "text-green-600" },
          { label: "Inovimmo-Provision", value: `CHF ${Math.round(provision).toLocaleString("de-CH")}`, color: "text-gray-900" },
          { label: "Offene Aufträge", value: escrows?.filter(e => ["ausstehend","einbezahlt","in_ausfuehrung"].includes(e.status)).length ?? 0, color: "text-amber-600" },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Escrow-Transaktionen</h3>
        </div>
        {!escrows?.length ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-3xl mb-2">🔒</p>
            <p className="text-sm">Noch keine Escrow-Transaktionen</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Auftrag</th>
                  <th className="table-header">Dienstleister</th>
                  <th className="table-header">Betrag</th>
                  <th className="table-header">Provision (6%)</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {escrows.map(e => {
                  const s = STATUS[e.status] ?? { label: e.status, cls: "badge-gray" };
                  const dl = e.dienstleister as unknown as {full_name:string,firma:string};
                  const ticket = e.ticket as unknown as {titel:string};
                  return (
                    <tr key={e.id} className="table-row">
                      <td className="table-cell">
                        <p className="font-medium text-sm text-gray-900 truncate max-w-[200px]">{ticket?.titel}</p>
                        <p className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString("de-CH")}</p>
                      </td>
                      <td className="table-cell text-sm">{dl?.firma ?? dl?.full_name}</td>
                      <td className="table-cell font-semibold">CHF {Number(e.betrag).toLocaleString("de-CH")}</td>
                      <td className="table-cell text-sm text-gray-500">CHF {Number(e.provision_betrag).toLocaleString("de-CH")}</td>
                      <td className="table-cell"><span className={s.cls}>{s.label}</span></td>
                      <td className="table-cell">
                        <EscrowActions escrow={e} />
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
