import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HistoriePage({
  params,
}: {
  params: Promise<{ id: string; wohnungId: string }>;
}) {
  const supabase = await createClient();
  const { id: objektId, wohnungId } = await params;

  const [{ data: allMietverhaeltnisse }, { data: auszuege }, { data: uebergaben }, { data: wohnung }] =
    await Promise.all([
      supabase
        .from("mietverhaeltnisse")
        .select("id, mietbeginn, mietende, ist_hauptperson, mieter:mieter_id(vorname, nachname, email)")
        .eq("wohnung_id", wohnungId)
        .order("mietbeginn", { ascending: false }),
      supabase
        .from("auszuege")
        .select("id, auszugsdatum, zustandsnotiz, kaution_zurueck, schluessel_zurueck, created_at")
        .eq("wohnung_id", wohnungId)
        .order("auszugsdatum", { ascending: false }),
      supabase
        .from("uebergabeprotokolle")
        .select("id, typ, datum, gesamtzustand, created_at")
        .eq("wohnung_id", wohnungId)
        .order("datum", { ascending: false }),
      supabase
        .from("wohnungen")
        .select("bezeichnung, whg_nr")
        .eq("id", wohnungId)
        .maybeSingle(),
    ]);

  const title = wohnung?.whg_nr
    ? `${wohnung.whg_nr} · ${wohnung.bezeichnung}`
    : wohnung?.bezeichnung || "Wohnung";

  // Separate current (active) from historical rental contracts
  const now = new Date();
  const currentMietverhaeltnisse = allMietverhaeltnisse?.filter(
    (mv: any) => !mv.mietende || new Date(mv.mietende) > now
  ) || [];
  const historicalMietverhaeltnisse = allMietverhaeltnisse?.filter(
    (mv: any) => mv.mietende && new Date(mv.mietende) <= now
  ) || [];

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-6">
      <Link
        href={`/dashboard/objekte/${objektId}/wohnungen/${wohnungId}`}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        ← Zurück zu {title}
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Historie</h1>
        <p className="text-sm text-gray-400 mt-1">Frühere Mieter, Auszüge und Protokolle.</p>
      </div>

      {/* Aktuelle Mietverhältnisse */}
      <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-green-100 bg-green-50/50">
          <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide">Aktuelle Mietverhältnisse</h2>
        </div>
        {!currentMietverhaeltnisse.length ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Keine aktuellen Mietverhältnisse.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {currentMietverhaeltnisse.map((mv: any) => (
              <div key={mv.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {[mv.mieter?.vorname, mv.mieter?.nachname].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {mv.mieter?.email || ""}
                    {mv.ist_hauptperson ? " · Hauptmieter" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {mv.mietbeginn ? new Date(mv.mietbeginn).toLocaleDateString("de-CH") : "—"}
                    {" – "}
                    {mv.mietende ? new Date(mv.mietende).toLocaleDateString("de-CH") : "laufend"}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    aktiv
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Frühere Mietverhältnisse */}
      {historicalMietverhaeltnisse.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Frühere Mietverhältnisse</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {historicalMietverhaeltnisse.map((mv: any) => (
              <div key={mv.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {[mv.mieter?.vorname, mv.mieter?.nachname].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {mv.mieter?.email || ""}
                    {mv.ist_hauptperson ? " · Hauptmieter" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {mv.mietbeginn ? new Date(mv.mietbeginn).toLocaleDateString("de-CH") : "—"}
                    {" – "}
                    {mv.mietende ? new Date(mv.mietende).toLocaleDateString("de-CH") : "unbekannt"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auszüge */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Auszüge</h2>
        </div>
        {!auszuege?.length ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Keine Auszüge erfasst.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {auszuege.map((a: any) => (
              <div key={a.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">
                    Auszug {new Date(a.auszugsdatum).toLocaleDateString("de-CH")}
                  </p>
                  <div className="flex gap-2">
                    {a.schluessel_zurueck && <span className="badge-green">Schlüssel</span>}
                    {a.kaution_zurueck && <span className="badge-green">Kaution</span>}
                  </div>
                </div>
                {a.zustandsnotiz && (
                  <p className="text-xs text-gray-400">{a.zustandsnotiz}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Übergabeprotokolle */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Übergabeprotokolle</h2>
        </div>
        {!uebergaben?.length ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Keine Protokolle erfasst.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {uebergaben.map((u: any) => (
              <div key={u.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {u.typ === "einzug" ? "Einzugsprotokoll" : "Auszugsprotokoll"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Gesamtzustand: {u.gesamtzustand}
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  {u.datum ? new Date(u.datum).toLocaleDateString("de-CH") : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
