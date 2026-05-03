import { createClient } from "@/lib/supabase/server";
import DokumentUpload from "./DokumentUpload";
import DokumentListe from "./DokumentListe";

export default async function DokumentePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: liegenschaften } = await supabase
    .from("liegenschaften").select("id,name").eq("verwalter_id", user!.id);

  const { data: dokumente } = await supabase
    .from("dokumente")
    .select("*, liegenschaft:liegenschaften(name), wohnung:wohnungen(bezeichnung), erstellt_von:profiles(full_name)")
    .eq("eigentümer_id", user!.id)
    .order("created_at", { ascending: false });

  const typen = {
    mietvertrag: { label: "Mietvertrag", icon: "📝", cls: "badge-blue" },
    nk_abrechnung: { label: "NK-Abrechnung", icon: "📑", cls: "badge-green" },
    uebergabeprotokoll: { label: "Übergabeprotokoll", icon: "🏠", cls: "badge-amber" },
    versicherung: { label: "Versicherung", icon: "🛡", cls: "badge-blue" },
    wartung: { label: "Wartungsprotokoll", icon: "🔧", cls: "badge-gray" },
    korrespondenz: { label: "Korrespondenz", icon: "✉️", cls: "badge-gray" },
    sonstiges: { label: "Sonstiges", icon: "📄", cls: "badge-gray" },
  } as Record<string, { label: string; icon: string; cls: string }>;

  const totalGB = (dokumente?.reduce((s, d) => s + (d.groesse_bytes ?? 0), 0) ?? 0) / 1e9;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dokumentenarchiv</h2>
          <p className="text-sm text-gray-500">{dokumente?.length ?? 0} Dokumente · {totalGB.toFixed(2)} GB verwendet</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload */}
        <div className="lg:col-span-1">
          <DokumentUpload liegenschaften={liegenschaften ?? []} />

          {/* Kategorien */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-4 mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Nach Typ filtern</h4>
            <div className="space-y-1">
              {Object.entries(typen).map(([key, val]) => {
                const count = dokumente?.filter(d => d.typ === key).length ?? 0;
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{val.icon}</span>
                      <span className="text-sm text-gray-700">{val.label}</span>
                    </div>
                    <span className="text-xs text-gray-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dokumente Liste */}
        <div className="lg:col-span-2">
          <DokumentListe dokumente={dokumente ?? []} typen={typen} />
        </div>
      </div>
    </div>
  );
}
