import { createClient } from "@/lib/supabase/server";
import OfferteForm from "./OfferteForm";

export default async function DienstleisterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Open tenders
  const { data: offeneTickets } = await supabase
    .from("tickets")
    .select("id,titel,beschreibung,kategorie,prioritaet,budget_max,created_at,liegenschaft:liegenschaften(name,ort,plz)")
    .in("status", ["ausgeschrieben","offerten_eingegangen"])
    .order("prioritaet", { ascending: false })
    .order("created_at", { ascending: false });

  // My offers
  const { data: meineOfferten } = await supabase
    .from("offerten")
    .select("id,betrag,status,created_at,ticket:tickets(titel,status)")
    .eq("dienstleister_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // My escrows
  const { data: meineEscrows } = await supabase
    .from("escrows")
    .select("id,betrag,provision_betrag,status,ticket:tickets(titel)")
    .eq("dienstleister_id", user!.id)
    .order("created_at", { ascending: false });

  const verdient = meineEscrows?.filter(e=>e.status==="abgeschlossen").reduce((s,e) => s + e.betrag - e.provision_betrag, 0) ?? 0;
  const ausstehend = meineEscrows?.filter(e=>["einbezahlt","in_ausfuehrung"].includes(e.status)).reduce((s,e) => s + e.betrag - e.provision_betrag, 0) ?? 0;

  const KAT: Record<string,string> = { heizung_sanitaer:"🔥 Heizung/Sanitär",elektro:"⚡ Elektro",fenster_tueren:"🚪 Fenster/Türen",maler_boeden:"🎨 Maler/Böden",garten:"🌿 Garten",reinigung:"🧹 Reinigung",sonstiges:"🔧 Sonstiges" };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Mein Betrieb</h2>
        <p className="text-sm text-gray-500">Offene Ausschreibungen & meine Offerten</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-xs text-gray-400 mb-1">Offene Ausschreibungen</p><p className="text-3xl font-bold text-[hsl(214,76%,49%)]">{offeneTickets?.length ?? 0}</p></div>
        <div className="stat-card"><p className="text-xs text-gray-400 mb-1">Ausstehend (Escrow)</p><p className="text-2xl font-bold text-amber-600">CHF {ausstehend.toLocaleString("de-CH")}</p></div>
        <div className="stat-card"><p className="text-xs text-gray-400 mb-1">Total verdient</p><p className="text-2xl font-bold text-green-600">CHF {verdient.toLocaleString("de-CH")}</p></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Open tenders */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Offene Ausschreibungen</h3>
          {!offeneTickets?.length ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center text-gray-400">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm">Keine offenen Ausschreibungen</p>
            </div>
          ) : offeneTickets.map(t => {
            const l = t.liegenschaft as unknown as {name:string,ort:string,plz:string};
            return (
              <div key={t.id} className="bg-white rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl">{t.prioritaet==="notfall"?"🔥":t.prioritaet==="dringend"?"⚡":"🔵"}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-900">{t.titel}</h4>
                    <p className="text-xs text-gray-500">{l?.plz} {l?.ort} · {KAT[t.kategorie] ?? t.kategorie}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{t.beschreibung}</p>
                  </div>
                  {t.budget_max && <span className="badge-gray text-xs">Max CHF {Number(t.budget_max).toLocaleString("de-CH")}</span>}
                </div>
                <OfferteForm ticketId={t.id} />
              </div>
            );
          })}
        </div>

        {/* My offers */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Meine Offerten</h3>
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            {!meineOfferten?.length ? (
              <div className="py-8 text-center text-gray-400 text-sm">Noch keine Offerten eingereicht</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="table-header">Auftrag</th>
                  <th className="table-header">Betrag</th>
                  <th className="table-header">Status</th>
                </tr></thead>
                <tbody>
                  {meineOfferten.map(o => {
                    const t = o.ticket as unknown as {titel:string};
                    const STATUS: Record<string,{label:string,cls:string}> = {
                      eingegangen: {label:"Eingereicht",cls:"badge-amber"},
                      akzeptiert: {label:"✓ Akzeptiert",cls:"badge-green"},
                      abgelehnt: {label:"Abgelehnt",cls:"badge-red"},
                      zurueckgezogen: {label:"Zurückgezogen",cls:"badge-gray"},
                    };
                    const s = STATUS[o.status] ?? {label:o.status,cls:"badge-gray"};
                    return (
                      <tr key={o.id} className="table-row">
                        <td className="table-cell text-sm truncate max-w-[200px]">{t?.titel}</td>
                        <td className="table-cell font-semibold text-sm">CHF {Number(o.betrag).toLocaleString("de-CH")}</td>
                        <td className="table-cell"><span className={s.cls}>{s.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
