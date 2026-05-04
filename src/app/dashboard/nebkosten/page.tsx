import { createClient } from "@/lib/supabase/server";
import NKForm from "./NKForm";

export default async function NebenkostenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: liegenschaften } = await supabase
    .from("liegenschaften").select("id,name,ort,anzahl_wohnungen").eq("verwalter_id", user!.id);

  const { data: positionen } = await supabase
    .from("nebenkostenpositionen").select("*,liegenschaft:liegenschaften(name)").order("jahr",{ascending:false}).order("bezeichnung");

  const { data: abrechnungen } = await supabase
    .from("nebenkostenabrechnungen").select("*,wohnung:wohnungen(bezeichnung),liegenschaft:liegenschaften(name)").order("jahr",{ascending:false}).limit(20);

  const aktuellesJahr = new Date().getFullYear();

  const STATUS: Record<string,{label:string,cls:string}> = {
    entwurf: { label:"Entwurf", cls:"badge-amber" },
    versendet: { label:"Versendet", cls:"badge-blue" },
    bezahlt: { label:"Bezahlt", cls:"badge-green" },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Nebenkostenabrechnung</h2>
          <p className="text-sm text-gray-500">MWST-konform · Automatisch berechnet · CHF 8/Wohnung/Jahr</p>
        </div>
      </div>

      <div className="info-box-blue">
        <p className="text-sm font-semibold text-blue-800 mb-1">ℹ️ So funktioniert die NK-Abrechnung</p>
        <p className="text-xs text-blue-700">
          Erfassen Sie alle Kostenpositionen (Heizung, Wasser, Strom etc.) und Inovimmo berechnet automatisch den Anteil pro Wohnung nach dem gewählten Verteilschlüssel. Am Ende exportieren Sie als PDF und versenden direkt an alle Mieter.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Positionen erfassen */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Kostenpositionen {aktuellesJahr}</h3>
          <NKForm liegenschaften={liegenschaften ?? []} jahr={aktuellesJahr} />

          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            {!positionen?.length ? (
              <div className="py-8 text-center text-gray-400 text-sm">Noch keine Positionen erfasst</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="table-header">Liegenschaft</th>
                  <th className="table-header">Jahr</th>
                  <th className="table-header">Position</th>
                  <th className="table-header text-right">Betrag</th>
                </tr></thead>
                <tbody>
                  {positionen.map(p => (
                    <tr key={p.id} className="table-row">
                      <td className="table-cell text-xs">{(p.liegenschaft as unknown as {name:string})?.name}</td>
                      <td className="table-cell text-xs">{p.jahr}</td>
                      <td className="table-cell text-sm">{p.bezeichnung}</td>
                      <td className="table-cell text-sm text-right font-semibold">CHF {Number(p.betrag_total).toLocaleString("de-CH")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Abrechnungen */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Erstellte Abrechnungen</h3>
          {!abrechnungen?.length ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center text-gray-400">
              <p className="text-2xl mb-2">📑</p>
              <p className="text-sm">Noch keine Abrechnungen erstellt</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="table-header">Wohnung</th>
                  <th className="table-header">Jahr</th>
                  <th className="table-header">Differenz</th>
                  <th className="table-header">Status</th>
                </tr></thead>
                <tbody>
                  {abrechnungen.map(a => {
                    const diff = Number(a.differenz);
                    return (
                      <tr key={a.id} className="table-row">
                        <td className="table-cell text-sm">{(a.wohnung as unknown as {bezeichnung:string})?.bezeichnung}</td>
                        <td className="table-cell text-sm">{a.jahr}</td>
                        <td className="table-cell">
                          <span className={diff > 0 ? "text-green-600 font-semibold text-sm" : diff < 0 ? "text-red-600 font-semibold text-sm" : "text-gray-400 text-sm"}>
                            {diff > 0 ? `+CHF ${diff.toLocaleString("de-CH")} Rückerstattung` : diff < 0 ? `CHF ${Math.abs(diff).toLocaleString("de-CH")} Nachzahlung` : "Ausgeglichen"}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={STATUS[a.status]?.cls ?? "badge-gray"}>{STATUS[a.status]?.label ?? a.status}</span>
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
    </div>
  );
}
