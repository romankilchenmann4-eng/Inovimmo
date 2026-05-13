import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import SubNav from "@/components/ui/SubNav";

const AUFTRAEGE_NAV = [
  { href: "/dashboard/tickets",  label: "Tickets" },
  { href: "/dashboard/offerten", label: "Offerten" },
  { href: "/dashboard/escrow",   label: "Escrow & Zahlung" },
];

const STATUS_CONFIG = {
  neu:                  { label: "Neu",            cls: "badge-red",   icon: "🆕" },
  ausgeschrieben:       { label: "Ausgeschrieben", cls: "badge-amber", icon: "📢" },
  offerten_eingegangen: { label: "Offerten",       cls: "badge-blue",  icon: "📋" },
  vergeben:             { label: "Vergeben",        cls: "badge-blue",  icon: "✅" },
  in_ausfuehrung:       { label: "In Ausführung",  cls: "badge-amber", icon: "🔨" },
  abgeschlossen:        { label: "Abgeschlossen",  cls: "badge-green", icon: "✓" },
  storniert:            { label: "Storniert",       cls: "badge-gray",  icon: "✕" },
} as const;

const PRIO_CONFIG = {
  notfall:  { cls: "badge-red",   icon: "🔥" },
  dringend: { cls: "badge-amber", icon: "⚡" },
  normal:   { cls: "badge-gray",  icon: "🔵" },
} as const;

const KAT_LABELS: Record<string, string> = {
  heizung_sanitaer: "Heizung / Sanitär",
  elektro:          "Elektro",
  fenster_tueren:   "Fenster / Türen",
  maler_boeden:     "Maler / Böden",
  garten:           "Garten",
  reinigung:        "Reinigung",
  sonstiges:        "Sonstiges",
};

export default async function TicketsPage() {
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("tickets")
    .select(`
      id, titel, beschreibung, kategorie, prioritaet, status, budget_max, created_at,
      liegenschaft:liegenschaften(id, name, ort),
      wohnung:wohnungen(bezeichnung),
      ersteller:profiles!tickets_erstellt_von_fkey(full_name),
      offerten(id)
    `)
    .order("created_at", { ascending: false });

  const counts = {
    offen: tickets?.filter(t => ["neu","ausgeschrieben","offerten_eingegangen"].includes(t.status)).length ?? 0,
    dringend: tickets?.filter(t => t.prioritaet === "notfall").length ?? 0,
    offerte: tickets?.filter(t => t.status === "offerten_eingegangen").length ?? 0,
    abgeschlossen: tickets?.filter(t => t.status === "abgeschlossen").length ?? 0,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={AUFTRAEGE_NAV} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tickets</h2>
          <p className="text-sm text-gray-500">{tickets?.length ?? 0} total · {counts.offen} offen</p>
        </div>
        <Link
          href="/dashboard/tickets/neu"
          className="flex items-center gap-2 px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl hover:bg-[hsl(214,76%,44%)] transition-colors"
        >
          + Ticket erstellen
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Offen",        value: counts.offen,        color: "text-amber-600" },
          { label: "Notfall",      value: counts.dringend,     color: "text-red-600" },
          { label: "Offerte wählen", value: counts.offerte,   color: "text-[hsl(214,76%,49%)]" },
          { label: "Abgeschlossen", value: counts.abgeschlossen, color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {!tickets?.length ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">🎫</p>
            <p className="font-medium text-gray-600">Noch keine Tickets</p>
            <p className="text-sm mt-1 mb-4">Erstellen Sie das erste Ticket für eine Liegenschaft.</p>
            <Link
              href="/dashboard/tickets/neu"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl"
            >
              + Erstes Ticket erstellen
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Ticket</th>
                  <th className="table-header">Liegenschaft</th>
                  <th className="table-header">Kategorie</th>
                  <th className="table-header">Priorität</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Offerten</th>
                  <th className="table-header">Datum</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const s = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG];
                  const p = PRIO_CONFIG[t.prioritaet as keyof typeof PRIO_CONFIG];
                  const offCount = Array.isArray(t.offerten) ? t.offerten.length : 0;
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{p?.icon ?? "🔵"}</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{t.titel}</p>
                            <p className="text-xs text-gray-400 line-clamp-1">{t.beschreibung}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm">{(t.liegenschaft as unknown as {name:string})?.name ?? "—"}</p>
                        {(t.wohnung as unknown as {bezeichnung:string})?.bezeichnung && (
                          <p className="text-xs text-gray-400">{(t.wohnung as unknown as {bezeichnung:string}).bezeichnung}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-gray-600">{KAT_LABELS[t.kategorie] ?? t.kategorie}</span>
                      </td>
                      <td className="table-cell">
                        <span className={p?.cls ?? "badge-gray"}>
                          {t.prioritaet === "notfall" ? "Notfall" : t.prioritaet === "dringend" ? "Dringend" : "Normal"}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={s?.cls ?? "badge-gray"}>{s?.label ?? t.status}</span>
                      </td>
                      <td className="table-cell">
                        {offCount > 0 ? (
                          <span className="badge-blue">{offCount} eingegangen</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="table-cell text-xs text-gray-400">
                        {new Date(t.created_at).toLocaleDateString("de-CH")}
                      </td>
                      <td className="table-cell">
                        <Link
                          href={`/dashboard/tickets/${t.id}`}
                          className="text-xs text-[hsl(214,76%,49%)] font-medium hover:underline whitespace-nowrap"
                        >
                          Details →
                        </Link>
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
  );
}
