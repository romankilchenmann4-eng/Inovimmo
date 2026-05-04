import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import AcceptOfferButton from "./AcceptOfferButton";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("tickets")
    .select("*, liegenschaft:liegenschaften(name,ort), ersteller:profiles!tickets_erstellt_von_fkey(full_name,email)")
    .eq("id", id).single();
  if (!t) notFound();
  const { data: offerten } = await supabase.from("offerten")
    .select("*, dienstleister:profiles!offerten_dienstleister_id_fkey(full_name,firma), dl_profil:dienstleister_profile(bewertung_schnitt,anzahl_bewertungen,verified)")
    .eq("ticket_id", id).order("betrag");
  const KAT: Record<string,string> = { heizung_sanitaer:"Heizung/Sanitär",elektro:"Elektro",fenster_tueren:"Fenster/Türen",maler_boeden:"Maler/Böden",garten:"Garten",reinigung:"Reinigung",sonstiges:"Sonstiges" };
  const steps = [
    { label:"Ticket erstellt", done:true },
    { label:"Ausgeschrieben", done:["ausgeschrieben","offerten_eingegangen","vergeben","in_ausfuehrung","abgeschlossen"].includes(t.status) },
    { label:"Offerten eingegangen", done:["offerten_eingegangen","vergeben","in_ausfuehrung","abgeschlossen"].includes(t.status) },
    { label:"Auftrag vergeben", done:["vergeben","in_ausfuehrung","abgeschlossen"].includes(t.status) },
    { label:"Abgeschlossen", done:t.status === "abgeschlossen" },
  ];
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/tickets" className="text-sm text-gray-400 hover:text-gray-600">← Tickets</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 truncate">{t.titel}</span>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{t.prioritaet==="notfall"?"🔥":t.prioritaet==="dringend"?"⚡":"🔵"}</span>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">{t.titel}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={t.prioritaet==="notfall"?"badge-red":t.prioritaet==="dringend"?"badge-amber":"badge-gray"}>{t.prioritaet}</span>
                  <span className="badge-blue">{KAT[t.kategorie]??t.kategorie}</span>
                  {t.budget_max && <span className="badge-gray">Budget: CHF {Number(t.budget_max).toLocaleString("de-CH")}</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-0.5">Liegenschaft</p><p className="text-sm font-medium">{(t.liegenschaft as {name:string}|null)?.name ?? "—"}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-0.5">Erstellt am</p><p className="text-sm font-medium">{new Date(t.created_at).toLocaleDateString("de-CH")}</p></div>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Beschreibung</p>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{t.beschreibung}</p>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Offerten ({offerten?.length ?? 0})</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {!offerten?.length ? (
                <div className="py-10 text-center text-gray-400"><p className="text-2xl mb-2">⏳</p><p className="text-sm">Warte auf Offerten…</p></div>
              ) : offerten.map((o, idx) => {
                const dl = o.dienstleister as {full_name:string;firma:string}|null;
                return (
                  <div key={o.id} className={`p-5 ${idx===0?"bg-green-50":""}`}>
                    {idx===0 && <div className="mb-2"><span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-semibold">Günstigste Offerte</span></div>}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[hsl(214,76%,49%)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{(dl?.firma??dl?.full_name??"?")[0].toUpperCase()}</div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{dl?.firma??dl?.full_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Verfügbar ab: {new Date(o.verfuegbar_ab).toLocaleDateString("de-CH")}</p>
                        <p className="text-sm text-gray-700 mt-2">{o.beschreibung}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold">CHF {Number(o.betrag).toLocaleString("de-CH")}</p>
                        <p className="text-xs text-gray-400">inkl. MwSt.</p>
                        {o.status==="eingegangen" && !["vergeben","abgeschlossen"].includes(t.status) && (
                          <AcceptOfferButton offerteId={o.id} ticketId={t.id} betrag={o.betrag} dienstleisterId={o.dienstleister_id} />
                        )}
                        {o.status==="akzeptiert" && <span className="badge-green mt-1 block">✓ Akzeptiert</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <h4 className="font-semibold text-sm text-gray-900 mb-4">Ticket-Verlauf</h4>
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
              {steps.map((s,i) => (
                <div key={i} className="relative mb-4 last:mb-0">
                  <div className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${s.done?"bg-green-500":"bg-gray-200"}`} />
                  <p className={`text-sm ${s.done?"font-medium text-gray-900":"text-gray-400"}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
