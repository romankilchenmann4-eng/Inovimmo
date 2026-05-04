import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ObjektePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: liegenschaften } = await supabase
    .from("liegenschaften")
    .select(`
      id, name, strasse, hausnummer, plz, ort, kanton, baujahr,
      anzahl_wohnungen, objekttyp, created_at,
      wohnungen(id, status, nettomiete)
    `)
    .eq("verwalter_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Objekte & Mieter</h2>
          <p className="text-sm text-gray-500">{liegenschaften?.length ?? 0} Liegenschaften</p>
        </div>
        <Link
          href="/dashboard/objekte/neu"
          className="flex items-center gap-2 px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl hover:bg-[hsl(214,76%,44%)] transition-colors"
        >
          + Liegenschaft hinzufügen
        </Link>
      </div>

      {!liegenschaften?.length ? (
        <div className="bg-white rounded-xl border border-border p-16 text-center">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-semibold text-gray-700 text-lg">Noch keine Liegenschaften</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">Fügen Sie Ihre erste Liegenschaft hinzu.</p>
          <Link href="/dashboard/objekte/neu" className="px-5 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm">
            + Erste Liegenschaft
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {liegenschaften.map((l) => {
            const whgs = Array.isArray(l.wohnungen) ? l.wohnungen : [];
            const vermietet = whgs.filter((w: {status:string}) => w.status === "vermietet").length;
            const mieteinnahmen = whgs.reduce((s: number, w: {nettomiete:number}) => s + (w.nettomiete ?? 0), 0);
            const belegung = whgs.length > 0 ? Math.round((vermietet / whgs.length) * 100) : 0;

            return (
              <div key={l.id} className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">🏢</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-bold text-gray-900">{l.name}</h3>
                        <span className="badge-gray text-xs">{l.objekttyp}</span>
                        {l.baujahr && <span className="text-xs text-gray-400">Baujahr {l.baujahr}</span>}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {l.strasse} {l.hausnummer}, {l.plz} {l.ort}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/objekte/${l.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-[hsl(214,76%,49%)] border border-[hsl(214,76%,49%)] rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
                    >
                      Details →
                    </Link>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400">Wohnungen</p>
                      <p className="text-lg font-bold text-gray-900">{l.anzahl_wohnungen}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Belegt</p>
                      <p className="text-lg font-bold text-gray-900">{vermietet}/{whgs.length || l.anzahl_wohnungen}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Belegung</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${belegung}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{belegung}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Nettomiete/Mt.</p>
                      <p className="text-lg font-bold text-gray-900">
                        {mieteinnahmen > 0 ? `CHF ${mieteinnahmen.toLocaleString("de-CH")}` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
