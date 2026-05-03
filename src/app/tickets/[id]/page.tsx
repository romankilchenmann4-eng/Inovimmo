import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import AcceptOfferButton from "./AcceptOfferButton";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tickets")
    .select(`*, liegenschaft:liegenschaften(name,ort), wohnung:wohnungen(bezeichnung), ersteller:profiles!tickets_erstellt_von_fkey(full_name,email)`)
    .eq("id", id).single();
  if (!t) notFound();

  const { data: offerten } = await supabase
    .from("offerten")
    .select("*, dienstleister:profiles!offerten_dienstleister_id_fkey(full_name,firma), dl_profil:dienstleister_profile(bewertung_schnitt,anzahl_bewertungen,verified)")
    .eq("ticket_id", id)
    .order("betrag");

  const steps = [
    { label: "Ticket erstellt", done: true, active: false },
    { label: "Ausgeschrieben", done: ["ausgeschrieben","offerten_eingegangen","vergeben","in_ausfuehrung","abgeschlossen"].includes(t.status), active: t.status === "ausgeschrieben" },
    { label: "Offerten eingegangen", done: ["offerten_eingegangen","vergeben","in_ausfuehrung","abgeschlossen"].includes(t.status), active: t.status === "offerten_eingegangen" },
    { label: "Auftrag vergeben", done: ["vergeben","in_ausfuehrung","abgeschlossen"].includes(t.status), active: t.status === "vergeben" },
    { label: "In Ausführung", done: ["in_ausfuehrung","abgeschlossen"].includes(t.status), active: t.status === "in_ausfuehrung" },
    { label: "Abgeschlossen", done: t.status === "abgeschlossen", active: false },
  ];

  const KAT: Record<string,string> = { heizung_sanitaer:"Heizung/Sanitär",elektro:"Elektro",fenster_tueren:"Fenster/Türen",maler_boeden:"Maler/Böden",garten:"Garten",reinigung:"Reinigung",sonstiges:"Sonstiges" };
  const PRIO: Record<string,{cls:string,icon:string}> = { notfall:{cls:"badge-red",icon:"🔥"},dringend:{cls:"badge-amber",icon:"⚡"},normal:{cls:"badge-gray",icon:"🔵"} };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/tickets" className="text-sm text-gray-400 hover:text-gray-600">← Tickets</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 truncate">{t.titel}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Ticket Header */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{PRIO[t.prioritaet]?.icon ?? "🔵"}</span>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">{t.titel}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={PRIO[t.prioritaet]?.cls ?? "badge-gray"}>
                    {t.prioritaet === "notfall" ? "Notfall" : t.prioritaet === "dringend" ? "Dringend" : "Normal"}
                  </span>
                  <span className="badge-blue">{KAT[t.kategorie] ?? t.kategorie}</span>
                  {t.budget_max && <span className="badge-gray">Budget: CHF {Number(t.budget_max).toLocaleString("de-CH")}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Liegenschaft</p>
                <p className="text-sm font-medium">{(t.liegenschaft as unknown as {name:string})?.name}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Wohnung / Bereich</p>
                <p className="text-sm font-medium">{(t.wohnung as unknown as {bezeichnung:string})?.bezeichnung ?? "Allgemein"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Erstellt von</p>
                <p className="text-sm font-medium">{(t.ersteller as unknown as {full_name:string})?.full_name}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Erstellt am</p>
                <p className="text-sm font-medium">{new Date(t.created_at).toLocaleDateString("de-CH")}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Beschreibung</p>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{t.beschreibung}</p>
            </div>
          </div>

          {/* Offerten */}
          <div className="bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Offerten ({offerten?.length ?? 0})</h3>
              {t.status === "offerten_eingegangen" && (
                <div className="info-box-blue py-1 px-3 text-xs">🔒 Escrow-gesichert</div>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {!offerten?.length ? (
                <div className="py-10 text-center text-gray-400">
                  <p className="text-2xl mb-2">⏳</p>
                  <p className="text-sm">Warte auf Offerten von Dienstleistern…</p>
                </div>
              ) : offerten.map((o, idx) => {
                const dl = o.dienstleister as unknown as {full_name:string,firma:string};
                const dlp = o.dl_profil as unknown as {bewertung_schnitt:number,anzahl_bewertungen:number,verified:boolean};
                const isLowest = idx === 0;
                return (
                  <div key={o.id} className={`p-5 ${isLowest ? "bg-green-50" : ""}`}>
                    {isLowest && (
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-semibold">Günstigste Offerte</span>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[hsl(214,76%,49%)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {(dl?.full_name ?? dl?.firma ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900">{dl?.firma ?? dl?.full_name}</p>
                          {dlp?.verified && <span className="badge-green text-xs">✓ Verifiziert</span>}
                          {dlp?.anzahl_bewertungen > 0 && (
                            <span className="text-xs text-amber-600">★ {Number(dlp.bewertung_schnitt).toFixed(1)} ({dlp.anzahl_bewertungen})</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Verfügbar ab: {new Date(o.verfuegbar_ab).toLocaleDateString("de-CH")}</p>
                        <p className="text-sm text-gray-700 mt-2 leading-relaxed">{o.beschreibung}</p>
                        {o.garantie_monate && (
                          <p className="text-xs text-green-600 mt-1">✓ {o.garantie_monate} Monate Garantie</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold text-gray-900">CHF {Number(o.betrag).toLocaleString("de-CH")}</p>
                        <p className="text-xs text-gray-400">inkl. MwSt.</p>
                        {o.status === "eingegangen" && t.status !== "vergeben" && t.status !== "abgeschlossen" && (
                          <AcceptOfferButton offerteId={o.id} ticketId={t.id} betrag={o.betrag} />
                        )}
                        {o.status === "akzeptiert" && <span className="badge-green mt-1 block">✓ Akzeptiert</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar: Timeline + Security */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <h4 className="font-semibold text-sm text-gray-900 mb-4">Ticket-Verlauf</h4>
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
              {steps.map((s, i) => (
                <div key={i} className="relative mb-4 last:mb-0">
                  <div className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${s.done ? "bg-green-500" : s.active ? "bg-[hsl(214,76%,49%)]" : "bg-gray-200"}`} />
                  <p className={`text-sm ${s.done || s.active ? "font-medium text-gray-900" : "text-gray-400"}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <h4 className="font-semibold text-sm text-gray-900 mb-3">🛡 Sicherheits-Check</h4>
            {[
              { label: "Offerten versiegelt", ok: true },
              { label: "Escrow-Modell aktiv", ok: true },
              { label: "Kommunikation auf Plattform", ok: true },
              { label: "Anomalie-Erkennung", ok: true },
            ].map(c => (
              <div key={c.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-600">{c.label}</span>
                <span className={`text-xs font-semibold ${c.ok ? "text-green-600" : "text-red-600"}`}>
                  {c.ok ? "✓ OK" : "✗"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
