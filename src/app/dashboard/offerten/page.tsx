import { createClient } from "@/lib/supabase/server";
import OffertFormClient from "./OffertFormClient";
import Link from "next/link";

type TicketRow = {
  id: string;
  titel: string;
  beschreibung: string;
  kategorie: string;
  prioritaet: string;
  status: string;
  budget_max?: number;
  created_at: string;
  liegenschaft: { name: string; ort: string } | null;
  offerten: { id: string; dienstleister_id: string; betrag: number; status: string }[];
};

type OfferteRow = {
  id: string;
  betrag: number;
  beschreibung: string;
  verfuegbar_ab: string;
  garantie_monate?: number;
  status: string;
  created_at: string;
  ticket: { id: string; titel: string; status: string; liegenschaft: { name: string } | null } | null;
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

const PRIO_CLS: Record<string, string> = {
  notfall: "bg-red-500/20 text-red-300",
  dringend: "bg-amber-500/20 text-amber-300",
  normal: "bg-white/10 text-white/50",
};

export default async function OffertenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "dienstleister";

  // ─── DIENSTLEISTER VIEW ────────────────────────────────────
  if (role === "dienstleister" || role === "admin") {
    // Tickets open for offers (not yet submitted by this user)
    const { data: openTickets } = await supabase
      .from("tickets")
      .select(`
        id, titel, beschreibung, kategorie, prioritaet, status, budget_max, created_at,
        liegenschaft:liegenschaften(name, ort),
        offerten(id, dienstleister_id, betrag, status)
      `)
      .in("status", ["ausgeschrieben", "offerten_eingegangen"])
      .order("created_at", { ascending: false });

    // This dienstleister's own offers
    const { data: meineOfferten } = await supabase
      .from("offerten")
      .select(`
        id, betrag, beschreibung, verfuegbar_ab, garantie_monate, status, created_at,
        ticket:tickets(id, titel, status, liegenschaft:liegenschaften(name))
      `)
      .eq("dienstleister_id", user.id)
      .order("created_at", { ascending: false });

    const tickets = (openTickets ?? []) as unknown as TicketRow[];
    const eigeneOfferten = (meineOfferten ?? []) as unknown as OfferteRow[];

    // Tickets where this user already submitted (non-withdrawn)
    const bidTicketIds = new Set(
      eigeneOfferten
        .filter(o => o.status !== "zurueckgezogen")
        .map(o => o.ticket?.id)
        .filter(Boolean)
    );

    const availableTickets = tickets.filter(t => !bidTicketIds.has(t.id));

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Offerten</h1>
          <p className="text-white/50 text-sm mt-1">Offene Ausschreibungen einsehen und Offerte einreichen</p>
        </div>

        {/* Available tickets */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-white">Offene Ausschreibungen ({availableTickets.length})</h2>
          </div>

          {availableTickets.length === 0 ? (
            <div className="py-12 text-center text-white/30">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">Keine offenen Ausschreibungen</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {availableTickets.map(t => {
                const lg = t.liegenschaft;
                const anzahlOfferten = t.offerten?.filter(o => o.status !== "zurueckgezogen").length ?? 0;
                return (
                  <div key={t.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIO_CLS[t.prioritaet] ?? "bg-white/10 text-white/50"}`}>
                            {t.prioritaet === "notfall" ? "🔥" : t.prioritaet === "dringend" ? "⚡" : "🔵"} {t.prioritaet}
                          </span>
                          <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{KAT[t.kategorie] ?? t.kategorie}</span>
                          {t.budget_max ? (
                            <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Budget: CHF {Number(t.budget_max).toLocaleString("de-CH")}</span>
                          ) : null}
                        </div>
                        <h3 className="font-semibold text-white">{t.titel}</h3>
                        <p className="text-sm text-white/50 mt-0.5">
                          {lg ? `${lg.name}, ${lg.ort}` : ""}
                          {" · "}
                          {new Date(t.created_at).toLocaleDateString("de-CH")}
                          {" · "}
                          {anzahlOfferten} Offerte{anzahlOfferten !== 1 ? "n" : ""}
                        </p>
                        <p className="text-sm text-white/60 mt-2 line-clamp-2">{t.beschreibung}</p>
                      </div>
                    </div>
                    <OffertFormClient ticketId={t.id} ticketTitel={t.titel} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My submitted offers */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold text-white">Meine Offerten ({eigeneOfferten.length})</h2>
          </div>
          {eigeneOfferten.length === 0 ? (
            <div className="py-10 text-center text-white/30 text-sm">Noch keine Offerten eingereicht</div>
          ) : (
            <div className="divide-y divide-white/5">
              {eigeneOfferten.map(o => {
                const statusCls = o.status === "akzeptiert" ? "bg-emerald-500/20 text-emerald-300"
                  : o.status === "abgelehnt" ? "bg-red-500/20 text-red-300"
                  : o.status === "zurueckgezogen" ? "bg-white/10 text-white/30"
                  : "bg-blue-500/20 text-blue-300";
                const statusLabel = o.status === "akzeptiert" ? "Akzeptiert ✓"
                  : o.status === "abgelehnt" ? "Abgelehnt"
                  : o.status === "zurueckgezogen" ? "Zurückgezogen"
                  : "Eingereicht";
                const ticket = o.ticket as { id: string; titel: string; status: string; liegenschaft: { name: string } | null } | null;
                return (
                  <div key={o.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{ticket?.titel ?? "–"}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {(ticket?.liegenschaft as { name: string } | null)?.name ?? ""}
                        {" · "}
                        CHF {Number(o.betrag).toLocaleString("de-CH")}
                        {" · "}
                        ab {new Date(o.verfuegbar_ab).toLocaleDateString("de-CH")}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusCls}`}>
                      {statusLabel}
                    </span>
                    {ticket?.id && (
                      <Link href={`/dashboard/tickets/${ticket.id}`} className="text-xs text-[hsl(214,76%,60%)] hover:underline flex-shrink-0">
                        Ticket →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── VERWALTER / ADMIN VIEW ────────────────────────────────
  const { data: ticketsWithOffers } = await supabase
    .from("tickets")
    .select(`
      id, titel, prioritaet, status, created_at,
      liegenschaft:liegenschaften(name, ort),
      offerten(id, betrag, status, dienstleister:profiles!offerten_dienstleister_id_fkey(full_name, firma))
    `)
    .in("status", ["ausgeschrieben", "offerten_eingegangen"])
    .order("created_at", { ascending: false });

  const withOffersOnly = (ticketsWithOffers ?? []).filter(t => {
    const offs = t.offerten as unknown as { status: string }[];
    return offs?.some(o => o.status === "eingegangen");
  });

  const ausgeschrieben = (ticketsWithOffers ?? []).filter(t => t.status === "ausgeschrieben");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Offerten-Übersicht</h1>
        <p className="text-white/50 text-sm mt-1">Alle offenen Ausschreibungen und eingegangenen Offerten</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Ausgeschrieben", value: ausgeschrieben.length, icon: "📢", cls: "text-amber-400" },
          { label: "Offerten erhalten", value: withOffersOnly.length, icon: "📋", cls: "text-blue-400" },
          { label: "Offene Tickets total", value: ticketsWithOffers?.length ?? 0, icon: "🎫", cls: "text-white" },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4 text-center">
            <p className="text-2xl mb-1">{kpi.icon}</p>
            <p className={`text-2xl font-bold ${kpi.cls}`}>{kpi.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Tickets with offers */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold text-white">Offerten auswerten</h2>
        </div>
        {withOffersOnly.length === 0 ? (
          <div className="py-12 text-center text-white/30">
            <p className="text-3xl mb-2">⏳</p>
            <p className="text-sm">Noch keine Offerten eingegangen</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {withOffersOnly.map(t => {
              const offerten = (t.offerten as unknown as {
                id: string; betrag: number; status: string;
                dienstleister: { full_name: string; firma?: string } | null;
              }[]) ?? [];
              const active = offerten.filter(o => o.status === "eingegangen");
              const minBetrag = Math.min(...active.map(o => o.betrag));
              const lg = t.liegenschaft as unknown as { name: string; ort: string } | null;
              return (
                <Link key={t.id} href={`/dashboard/tickets/${t.id}`} className="block px-5 py-4 hover:bg-white/3 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIO_CLS[t.prioritaet] ?? "bg-white/10 text-white/50"}`}>
                          {t.prioritaet}
                        </span>
                        <span className="text-xs text-white/40">{lg ? `${lg.name}, ${lg.ort}` : ""}</span>
                      </div>
                      <p className="font-semibold text-white truncate">{t.titel}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {active.length} Offerte{active.length !== 1 ? "n" : ""} · günstigste: CHF {minBetrag.toLocaleString("de-CH")}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-xs text-[hsl(214,76%,60%)] font-medium">Auswerten →</span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1">
                    {active.slice(0, 3).map((o, i) => {
                      const dl = o.dienstleister;
                      return (
                        <div key={o.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${i === 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/3"}`}>
                          <span className="text-white/70">{dl?.firma ?? dl?.full_name ?? "Dienstleister"}</span>
                          <span className={`font-bold ${i === 0 ? "text-emerald-400" : "text-white/60"}`}>
                            CHF {Number(o.betrag).toLocaleString("de-CH")}
                            {i === 0 ? " ★" : ""}
                          </span>
                        </div>
                      );
                    })}
                    {active.length > 3 && (
                      <p className="text-xs text-white/30 text-center py-1">+ {active.length - 3} weitere</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Still waiting */}
      {ausgeschrieben.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold text-white/60 text-sm">Warte auf Offerten ({ausgeschrieben.length})</h2>
          </div>
          <div className="divide-y divide-white/5">
            {ausgeschrieben.map(t => {
              const lg = t.liegenschaft as unknown as { name: string; ort: string } | null;
              return (
                <Link key={t.id} href={`/dashboard/tickets/${t.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-colors">
                  <span className="text-white/30 text-sm">⏳</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 truncate">{t.titel}</p>
                    <p className="text-xs text-white/30">{lg ? `${lg.name}, ${lg.ort}` : ""} · {new Date(t.created_at).toLocaleDateString("de-CH")}</p>
                  </div>
                  <span className="text-xs text-white/30">→</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
