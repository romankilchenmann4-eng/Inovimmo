import { createClient } from "@/lib/supabase/server";

export default async function MieterAnpassungenPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Mietzinserhöhungen für Wohnungen dieses Mieters
  const { data: anpassungen } = await supabase
    .from("mietzins_erhoehungen")
    .select(`
      id, titel, grund, status, inkrafttreten, created_at,
      positionen:mietzins_erhoehung_positionen(
        wohnung:wohnungen(bezeichnung, nettomiete, nebenkosten_akonto,
          liegenschaft:liegenschaften(name, ort)
        ),
        miete_alt, miete_neu, erhoehung_monatlich, verteilschluessel_prozent
      )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Mietzinsanpassungen</h2>
        <p className="text-sm text-gray-500 mt-1">
          Übersicht aller Mietzinsanpassungen für Ihre Wohnung.
        </p>
      </div>

      {!anpassungen?.length ? (
        <div className="bg-white rounded-xl border border-border shadow-sm py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">🧾</p>
          <p className="font-medium text-gray-600">Keine Anpassungen vorhanden</p>
          <p className="text-sm mt-1">Es wurden noch keine Mietzinsanpassungen für Ihre Wohnung erfasst.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {anpassungen.map((a) => {
            const positionen = (a.positionen as any[]) ?? [];
            return (
              <div key={a.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {a.titel ?? "Mietzinserhöhung"}
                      {a.inkrafttreten ? ` · per ${new Date(a.inkrafttreten).toLocaleDateString("de-CH")}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Grund: {a.grund ?? "—"}
                    </p>
                  </div>
                  <span
                    className={
                      a.status === "versendet"
                        ? "badge-blue"
                        : a.status === "abgeschlossen"
                        ? "badge-green"
                        : "badge-amber"
                    }
                  >
                    {a.status === "versendet"
                      ? "Versendet"
                      : a.status === "abgeschlossen"
                      ? "Abgeschlossen"
                      : "Entwurf"}
                  </span>
                </div>

                {positionen.map((pos: any, i: number) => {
                  const wohnung = pos.wohnung as any;
                  return (
                    <div key={i} className="p-4 border-b last:border-b-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm text-gray-900">
                            {wohnung?.bezeichnung ?? "Wohnung"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {wohnung?.liegenschaft?.name ?? ""}{" "}
                            {wohnung?.liegenschaft?.ort ? `· ${wohnung.liegenschaft.ort}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            CHF {(pos.miete_alt ?? 0).toLocaleString("de-CH")}{" "}
                            <span className="text-gray-300">→</span>{" "}
                            <span className="font-semibold text-gray-900">
                              CHF {(pos.miete_neu ?? 0).toLocaleString("de-CH")}
                            </span>
                          </p>
                          {pos.erhoehung_monatlich > 0 && (
                            <p className="text-xs text-red-500 font-medium">
                              +CHF {pos.erhoehung_monatlich.toLocaleString("de-CH")} / Monat
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
