import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Wohnung = {
  id: string;
  bezeichnung: string;
  status: string;
  nettomiete: number;
  nebenkosten_akonto: number;
  zimmer: number;
  flaeche_m2: number | null;
};

type Liegenschaft = {
  id: string;
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  objekttyp: string;
  baujahr: number | null;
  wohnungen: Wohnung[];
  offene_tickets: number;
};

export default async function EigentuemerPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: liegenschaften } = await supabase
    .from("liegenschaften")
    .select(`
      id, name, strasse, hausnummer, plz, ort, objekttyp, baujahr,
      wohnungen(id, bezeichnung, status, nettomiete, nebenkosten_akonto, zimmer, flaeche_m2)
    `)
    .eq("verwalter_id", user.id)
    .order("name");

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, liegenschaft_id, status")
    .in("status", ["neu", "ausgeschrieben", "offerten_eingegangen", "vergeben", "in_ausfuehrung"]);

  const { data: buchungen } = await supabase
    .from("buchungen")
    .select("liegenschaft_id, typ, betrag, periode_jahr")
    .eq("typ", "miete_zahlung")
    .eq("periode_jahr", new Date().getFullYear());

  const items: Liegenschaft[] = (liegenschaften ?? []).map(l => {
    const wohnungen = (l.wohnungen as unknown as Wohnung[]) ?? [];
    const offene_tickets = (tickets ?? []).filter(t => t.liegenschaft_id === l.id).length;
    return { ...l, wohnungen, offene_tickets };
  });

  // Global KPIs
  const allWohnungen = items.flatMap(l => l.wohnungen);
  const vermietet = allWohnungen.filter(w => w.status === "vermietet").length;
  const totalWohnungen = allWohnungen.length;
  const belegungsquote = totalWohnungen > 0 ? Math.round((vermietet / totalWohnungen) * 100) : 0;
  const jahresMiete = (buchungen ?? []).reduce((s, b) => s + Number(b.betrag), 0);
  const sollMiete = allWohnungen
    .filter(w => w.status === "vermietet")
    .reduce((s, w) => s + Number(w.nettomiete) + Number(w.nebenkosten_akonto), 0) * 12;

  const noLiegenschaften = items.length === 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Eigentümer-Portal</h2>
        <p className="text-sm text-muted-foreground">Ihre Liegenschaften und Erträge im Überblick</p>
      </div>

      {noLiegenschaften ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-16 text-center">
          <p className="text-4xl mb-4">🏛</p>
          <p className="font-semibold text-gray-700 text-lg">Keine Liegenschaften zugewiesen</p>
          <p className="text-sm text-muted-foreground mt-2">
            Ihr Verwalter muss Ihnen Liegenschaften in Ihrem Konto zuweisen,
            damit Sie sie hier sehen können.
          </p>
        </div>
      ) : (
        <>
          {/* Global KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-xs text-muted-foreground mb-1">Liegenschaften</p>
              <p className="text-2xl font-bold text-foreground">{items.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground mb-1">Belegungsquote</p>
              <p className={`text-2xl font-bold ${belegungsquote >= 90 ? "text-green-600" : belegungsquote >= 70 ? "text-amber-600" : "text-red-600"}`}>
                {belegungsquote}%
              </p>
              <p className="text-xs text-muted-foreground">{vermietet}/{totalWohnungen} Whg.</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground mb-1">Mieteinnahmen YTD</p>
              <p className="text-2xl font-bold text-green-600">
                {jahresMiete > 0
                  ? `CHF ${(jahresMiete / 1000).toFixed(0)}k`
                  : "—"}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground mb-1">Jahres-Soll</p>
              <p className="text-2xl font-bold text-[hsl(214,76%,49%)]">
                CHF {Math.round(sollMiete / 1000)}k
              </p>
            </div>
          </div>

          {/* Liegenschaften */}
          <div className="space-y-6">
            {items.map(lg => {
              const lgVermietet = lg.wohnungen.filter(w => w.status === "vermietet").length;
              const lgTotal = lg.wohnungen.length;
              const lgBelegung = lgTotal > 0 ? Math.round((lgVermietet / lgTotal) * 100) : 0;
              const lgJahresMiete = lg.wohnungen
                .filter(w => w.status === "vermietet")
                .reduce((s, w) => s + (Number(w.nettomiete) + Number(w.nebenkosten_akonto)) * 12, 0);

              return (
                <div key={lg.id} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                  {/* Liegenschaft Header */}
                  <div className="px-6 py-4 border-b border-border bg-gray-50/50 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏢</span>
                        <h3 className="font-semibold text-gray-900">{lg.name}</h3>
                        <span className="badge-gray text-[10px]">{lg.objekttyp}</span>
                        {lg.offene_tickets > 0 && (
                          <span className="badge-amber">{lg.offene_tickets} offene Tickets</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {lg.strasse} {lg.hausnummer}, {lg.plz} {lg.ort}
                        {lg.baujahr && ` · Baujahr ${lg.baujahr}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        CHF {Math.round(lgJahresMiete / 1000)}k / Jahr
                      </p>
                      <p className={`text-xs font-medium ${lgBelegung === 100 ? "text-green-600" : lgBelegung >= 80 ? "text-amber-600" : "text-red-600"}`}>
                        {lgBelegung}% belegt ({lgVermietet}/{lgTotal})
                      </p>
                    </div>
                  </div>

                  {/* Wohnungen Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Wohnung</th>
                          <th className="table-header">Zimmer</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Nettomiete</th>
                          <th className="table-header">NK-Akonto</th>
                          <th className="table-header">Brutto / Jahr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lg.wohnungen.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="table-cell text-center text-muted-foreground py-6">
                              Keine Wohnungen erfasst
                            </td>
                          </tr>
                        ) : (
                          lg.wohnungen.map(w => {
                            const brutto = (Number(w.nettomiete) + Number(w.nebenkosten_akonto)) * 12;
                            return (
                              <tr key={w.id} className="table-row">
                                <td className="table-cell">
                                  <p className="font-medium text-sm">{w.bezeichnung}</p>
                                  {w.flaeche_m2 && <p className="text-xs text-muted-foreground">{w.flaeche_m2} m²</p>}
                                </td>
                                <td className="table-cell text-sm">{w.zimmer ?? "—"}</td>
                                <td className="table-cell">
                                  <span className={
                                    w.status === "vermietet" ? "badge-green" :
                                    w.status === "frei" ? "badge-blue" : "badge-amber"
                                  }>
                                    {w.status === "vermietet" ? "✓ Vermietet" :
                                     w.status === "frei" ? "Frei" : w.status}
                                  </span>
                                </td>
                                <td className="table-cell text-sm font-medium">
                                  {Number(w.nettomiete) > 0
                                    ? `CHF ${Number(w.nettomiete).toLocaleString("de-CH")}`
                                    : "—"}
                                </td>
                                <td className="table-cell text-sm text-muted-foreground">
                                  {Number(w.nebenkosten_akonto) > 0
                                    ? `CHF ${Number(w.nebenkosten_akonto).toLocaleString("de-CH")}`
                                    : "—"}
                                </td>
                                <td className="table-cell text-sm font-semibold text-gray-900">
                                  {brutto > 0
                                    ? `CHF ${brutto.toLocaleString("de-CH")}`
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { href: "/dashboard/dokumente/jahresbericht", icon: "📊", label: "Jahresbericht", sub: "PDF herunterladen" },
              { href: "/dashboard/dokumente",               icon: "📁", label: "Dokumente",      sub: "Verträge & Protokolle" },
              { href: "/dashboard/ki-assistent",            icon: "🤖", label: "KI-Assistent",   sub: "Fragen stellen" },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white rounded-2xl border border-border p-4 shadow-sm hover:shadow-md hover:border-[hsl(214,76%,49%)] transition-all group"
              >
                <p className="text-2xl mb-2">{link.icon}</p>
                <p className="font-semibold text-sm text-gray-900 group-hover:text-[hsl(214,76%,49%)]">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.sub}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
