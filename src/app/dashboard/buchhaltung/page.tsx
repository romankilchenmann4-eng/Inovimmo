import { createClient } from "@/lib/supabase/server";
import BuchhaltungExport from "./BuchhaltungExport";

export default async function BuchhaltungPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: escrows } = await supabase
    .from("escrows")
    .select("*, ticket:tickets(titel,kategorie), dienstleister:profiles!escrows_dienstleister_id_fkey(full_name,firma)")
    .eq("verwalter_id", user!.id)
    .eq("status", "abgeschlossen")
    .order("freigegeben_at", { ascending: false });

  const { data: nebkosten } = await supabase
    .from("nebenkostenpositionen")
    .select("*, liegenschaft:liegenschaften(name)")
    .order("jahr", { ascending: false })
    .limit(50);

  const totalUmsatz = escrows?.reduce((s, e) => s + e.betrag, 0) ?? 0;
  const totalProvision = escrows?.reduce((s, e) => s + e.provision_betrag, 0) ?? 0;
  const totalNK = nebkosten?.reduce((s, n) => s + n.betrag_total, 0) ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Buchhaltung & Export</h2>
        <p className="text-sm text-gray-500">Transaktionen exportieren für Abacus, Bexio, Excel</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Auftragsvolumen (total)", value: `CHF ${totalUmsatz.toLocaleString("de-CH")}`, color: "text-gray-900" },
          { label: "Plattform-Provision", value: `CHF ${Math.round(totalProvision).toLocaleString("de-CH")}`, color: "text-[hsl(214,76%,49%)]" },
          { label: "Nebenkosten (total)", value: `CHF ${totalNK.toLocaleString("de-CH")}`, color: "text-gray-900" },
          { label: "Abgeschl. Aufträge", value: escrows?.length ?? 0, color: "text-green-600" },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Export Options */}
      <BuchhaltungExport escrows={escrows ?? []} nebkosten={nebkosten ?? []} />

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Transaktionen</h3>
        </div>
        {!escrows?.length ? (
          <div className="py-10 text-center text-gray-400 text-sm">Noch keine abgeschlossenen Transaktionen</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Datum</th>
                  <th className="table-header">Auftrag</th>
                  <th className="table-header">Dienstleister</th>
                  <th className="table-header">Betrag</th>
                  <th className="table-header">Provision (6%)</th>
                  <th className="table-header">Netto</th>
                  <th className="table-header">MWST</th>
                </tr>
              </thead>
              <tbody>
                {escrows.map(e => {
                  const dl = e.dienstleister as unknown as { full_name: string; firma: string };
                  const ticket = e.ticket as unknown as { titel: string };
                  const netto = e.betrag / 1.081;
                  const mwst = e.betrag - netto;
                  return (
                    <tr key={e.id} className="table-row">
                      <td className="table-cell text-xs text-gray-500">{e.freigegeben_at ? new Date(e.freigegeben_at).toLocaleDateString("de-CH") : "—"}</td>
                      <td className="table-cell text-sm font-medium max-w-[200px] truncate">{ticket?.titel}</td>
                      <td className="table-cell text-sm">{dl?.firma ?? dl?.full_name}</td>
                      <td className="table-cell font-semibold">CHF {Number(e.betrag).toLocaleString("de-CH")}</td>
                      <td className="table-cell text-sm text-[hsl(214,76%,49%)]">CHF {Number(e.provision_betrag).toLocaleString("de-CH")}</td>
                      <td className="table-cell text-sm">CHF {netto.toFixed(2)}</td>
                      <td className="table-cell text-sm text-gray-400">CHF {mwst.toFixed(2)}</td>
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
