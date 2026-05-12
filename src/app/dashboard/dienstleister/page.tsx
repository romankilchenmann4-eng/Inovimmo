import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type TicketRow = {
  id: string;
  titel: string;
  kategorie: string;
  prioritaet: string;
  status: string;
  updated_at: string;
  liegenschaft: { name: string; ort: string } | null;
  offerten: { id: string; betrag: number; status: string }[];
};

type BewertungRow = {
  id: string;
  sterne: number;
  kommentar?: string;
  created_at: string;
  ticket: { titel: string } | null;
};

type EscrowRow = {
  id: string;
  betrag: number;
  status: string;
  created_at: string;
};

const KAT: Record<string, string> = {
  heizung_sanitaer: "Heizung/Sanitär",
  elektro: "Elektro",
  fenster_tueren: "Fenster/Türen",
  maler_boeden: "Maler/Böden",
  garten: "Garten",
  reinigung: "Reinigung",
  sonstiges: "Sonstiges",
};

export default async function DienstleisterBetriebPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: profil },
    { data: dlProfil },
    { data: meinTickets },
    { data: meineOfferten },
    { data: bewertungen },
    { data: escrows },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name,firma,phone,email").eq("id", user.id).single(),
    supabase.from("dienstleister_profile")
      .select("kategorien,beschreibung,webseite,bewertung_schnitt,anzahl_bewertungen,verified,abo_typ,abo_aktiv")
      .eq("profile_id", user.id).single(),
    supabase.from("tickets")
      .select(`id, titel, kategorie, prioritaet, status, updated_at,
        liegenschaft:liegenschaften(name, ort),
        offerten(id, betrag, status)`)
      .in("status", ["vergeben", "in_ausfuehrung", "abgeschlossen"])
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase.from("offerten")
      .select("id, betrag, status, created_at")
      .eq("dienstleister_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("bewertungen")
      .select("id, sterne, kommentar, created_at, ticket:tickets(titel)")
      .eq("dienstleister_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("escrows")
      .select("id, betrag, status, created_at")
      .eq("dienstleister_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const dl = dlProfil;
  const allOfferten = (meineOfferten ?? []) as { id: string; betrag: number; status: string; created_at: string }[];
  const allEscrows = (escrows ?? []) as EscrowRow[];
  const allBewertungen = (bewertungen ?? []) as unknown as BewertungRow[];

  const freigegeben = allEscrows.filter(e => e.status === "freigegeben").reduce((s, e) => s + Number(e.betrag), 0);
  const ausstehend = allEscrows.filter(e => ["einbezahlt", "bestaetigt"].includes(e.status)).reduce((s, e) => s + Number(e.betrag), 0);

  const aktiveJobs = ((meinTickets ?? []) as unknown as TicketRow[]).filter(t =>
    t.status === "vergeben" || t.status === "in_ausfuehrung"
  );
  const abgeschlosseneJobs = ((meinTickets ?? []) as unknown as TicketRow[]).filter(t =>
    t.status === "abgeschlossen"
  );

  const statusCls: Record<string, string> = {
    vergeben: "bg-blue-500/20 text-blue-300",
    in_ausfuehrung: "bg-amber-500/20 text-amber-300",
    abgeschlossen: "bg-emerald-500/20 text-emerald-300",
  };
  const statusLabel: Record<string, string> = {
    vergeben: "Vergeben",
    in_ausfuehrung: "In Ausführung",
    abgeschlossen: "Abgeschlossen",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mein Betrieb</h1>
          <p className="text-white/50 text-sm mt-1">{profil?.firma ?? profil?.full_name}</p>
        </div>
        {dl?.verified && (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            ✓ Verifiziert
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Aktive Aufträge", value: String(aktiveJobs.length), icon: "🔨", cls: "text-amber-400" },
          { label: "Abgeschlossen", value: String(abgeschlosseneJobs.length), icon: "✓", cls: "text-emerald-400" },
          { label: "Ausstehend CHF", value: ausstehend.toLocaleString("de-CH", { minimumFractionDigits: 2 }), icon: "⏳", cls: "text-blue-400" },
          { label: "Ausbezahlt CHF", value: freigegeben.toLocaleString("de-CH", { minimumFractionDigits: 2 }), icon: "💰", cls: "text-white" },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4 text-center">
            <p className="text-xl mb-1">{kpi.icon}</p>
            <p className={`text-xl font-bold ${kpi.cls}`}>{kpi.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Profil, Bewertung, Abo */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-white/80 text-sm border-b border-white/10 pb-2">Profil</h2>
          <div className="space-y-1.5 text-sm">
            <p className="text-white/50">Name: <span className="text-white">{profil?.full_name}</span></p>
            {profil?.firma && <p className="text-white/50">Firma: <span className="text-white">{profil.firma}</span></p>}
            {profil?.phone && <p className="text-white/50">Tel: <span className="text-white">{profil.phone}</span></p>}
          </div>
          {dl?.kategorien && (dl.kategorien as string[]).length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-1.5">Fachbereiche</p>
              <div className="flex flex-wrap gap-1.5">
                {(dl.kategorien as string[]).map(k => (
                  <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-[hsl(214,76%,49%)]/20 text-[hsl(214,76%,70%)]">
                    {KAT[k] ?? k}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Link href="/dashboard/einstellungen" className="text-xs text-[hsl(214,76%,60%)] hover:underline">
            Profil bearbeiten →
          </Link>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-white/80 text-sm border-b border-white/10 pb-2 mb-3">Bewertung</h2>
          {dl && Number(dl.anzahl_bewertungen) > 0 ? (
            <div className="text-center py-2">
              <p className="text-4xl font-bold text-white">{Number(dl.bewertung_schnitt).toFixed(1)}</p>
              <p className="text-amber-400 text-lg mt-1">
                {"★".repeat(Math.round(Number(dl.bewertung_schnitt)))}
                {"☆".repeat(5 - Math.round(Number(dl.bewertung_schnitt)))}
              </p>
              <p className="text-xs text-white/40 mt-1">
                {dl.anzahl_bewertungen} Bewertung{Number(dl.anzahl_bewertungen) !== 1 ? "en" : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-white/30 text-center py-4">Noch keine Bewertungen</p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-white/80 text-sm border-b border-white/10 pb-2 mb-3">Abo</h2>
          <div className="text-center py-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${dl?.abo_aktiv ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
              {dl?.abo_aktiv ? (dl.abo_typ === "premium" ? "Premium aktiv" : "Basic aktiv") : "Kein aktives Abo"}
            </span>
            <p className="text-xs text-white/30 mt-3 leading-relaxed">
              {dl?.abo_aktiv
                ? "Unbegrenzte Offerten auf alle Ausschreibungen"
                : "Mit einem Abo erhalten Sie Zugang zu allen Ausschreibungen"}
            </p>
          </div>
        </div>
      </div>

      {/* Aktive Aufträge */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-white">Aktive Aufträge ({aktiveJobs.length})</h2>
          <Link href="/dashboard/offerten" className="text-xs text-[hsl(214,76%,60%)] hover:underline">
            Neue Ausschreibungen →
          </Link>
        </div>
        {aktiveJobs.length === 0 ? (
          <div className="py-10 text-center text-white/30">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm">Keine aktiven Aufträge</p>
            <Link href="/dashboard/offerten" className="text-xs text-[hsl(214,76%,60%)] hover:underline mt-2 block">
              Offerte einreichen →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {aktiveJobs.map(t => {
              const lg = t.liegenschaft as unknown as { name: string; ort: string } | null;
              return (
                <Link key={t.id} href={`/dashboard/tickets/${t.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{t.titel}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {KAT[t.kategorie] ?? t.kategorie}
                      {lg ? ` · ${lg.name}, ${lg.ort}` : ""}
                      {" · "}
                      {new Date(t.updated_at).toLocaleDateString("de-CH")}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusCls[t.status] ?? "bg-white/10 text-white/50"}`}>
                    {statusLabel[t.status] ?? t.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Bewertungen */}
      {allBewertungen.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold text-white">Letzte Bewertungen</h2>
          </div>
          <div className="divide-y divide-white/5">
            {allBewertungen.map(b => (
              <div key={b.id} className="px-5 py-3.5">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-amber-400 text-sm">
                    {"★".repeat(b.sterne)}{"☆".repeat(5 - b.sterne)}
                  </span>
                  <span className="text-xs text-white/40">{new Date(b.created_at).toLocaleDateString("de-CH")}</span>
                  {b.ticket && (
                    <span className="text-xs text-white/30 truncate">
                      {(b.ticket as { titel: string }).titel}
                    </span>
                  )}
                </div>
                {b.kommentar && <p className="text-sm text-white/70">{b.kommentar}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offerten Statistik */}
      <div className="card p-5">
        <h2 className="font-semibold text-white/80 text-sm border-b border-white/10 pb-2 mb-3">Offerten-Statistik</h2>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: "Eingereicht", value: allOfferten.length, cls: "text-white" },
            { label: "Akzeptiert", value: allOfferten.filter(o => o.status === "akzeptiert").length, cls: "text-emerald-400" },
            { label: "Abgelehnt", value: allOfferten.filter(o => o.status === "abgelehnt").length, cls: "text-red-400" },
            { label: "Offen", value: allOfferten.filter(o => o.status === "eingegangen").length, cls: "text-blue-400" },
          ].map(s => (
            <div key={s.label}>
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
