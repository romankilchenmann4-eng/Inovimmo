import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles").select("full_name, role").eq("id", user.id).single();

  const { data: liegenschaften } = await supabase
    .from("liegenschaften")
    .select("id, name, ort, anzahl_wohnungen")
    .eq("verwalter_id", user.id)
    .order("name");

  const lgIds = (liegenschaften ?? []).map(l => l.id);

  // Wohnungen: join via liegenschaft_id (wohnungen has no verwalter_id)
  const { data: wohnungen } = lgIds.length
    ? await supabase
        .from("wohnungen")
        .select("id, liegenschaft_id, status, nettomiete, nebenkosten_akonto, typ")
        .in("liegenschaft_id", lgIds)
    : { data: [] };

  const { data: offeneTickets } = lgIds.length
    ? await supabase
        .from("tickets")
        .select("id, liegenschaft_id, prioritaet")
        .in("liegenschaft_id", lgIds)
        .in("status", ["neu", "ausgeschrieben", "offerten_eingegangen"])
    : { data: [] };

  // Zahlungseingänge laufendes Jahr
  const { data: zahlungen } = lgIds.length
    ? await supabase
        .from("buchungen")
        .select("betrag")
        .in("liegenschaft_id", lgIds)
        .eq("typ", "miete_zahlung")
        .eq("periode_jahr", new Date().getFullYear())
    : { data: [] };

  // ── KPI-Berechnung ──
  const alleWohnungen   = (wohnungen ?? []).filter(w => w.typ === "wohnung");
  const nebenobjekte    = (wohnungen ?? []).filter(w => w.typ === "nebenobjekt");
  const totalW          = alleWohnungen.length;
  const belegteW        = alleWohnungen.filter(w => w.status === "vermietet").length;
  const leerstandQuote  = totalW > 0 ? ((totalW - belegteW) / totalW * 100).toFixed(1) : "0.0";
  const jahresEinnahmen = (zahlungen ?? []).reduce((s, z) => s + Number(z.betrag), 0);
  const sollMonat       = alleWohnungen
    .filter(w => w.status === "vermietet")
    .reduce((s, w) => s + Number(w.nettomiete) + Number(w.nebenkosten_akonto), 0);
  const tickets         = offeneTickets ?? [];

  const vorname = profile?.full_name?.split(" ")[0] ?? "";
  const stunde  = new Date().getHours();
  const gruss   = stunde < 12 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";

  // Per-Liegenschaft counts
  const wByLg = (wohnungen ?? []).reduce<Record<string, { w: number; n: number; belegt: number }>>((acc, w) => {
    if (!acc[w.liegenschaft_id]) acc[w.liegenschaft_id] = { w: 0, n: 0, belegt: 0 };
    if (w.typ === "wohnung")     acc[w.liegenschaft_id].w++;
    if (w.typ === "nebenobjekt") acc[w.liegenschaft_id].n++;
    if (w.status === "vermietet" && w.typ === "wohnung") acc[w.liegenschaft_id].belegt++;
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{gruss}, {vorname} 👋</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Wohnungen</p>
          <p className="text-2xl font-bold text-foreground">{totalW}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge-green">{belegteW} vermietet</span>
            {nebenobjekte.length > 0 && (
              <span className="text-xs text-muted-foreground">+{nebenobjekte.length} Nebenobj.</span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Leerstand</p>
          <p className={`text-2xl font-bold ${parseFloat(leerstandQuote) > 10 ? "text-red-600" : parseFloat(leerstandQuote) > 5 ? "text-amber-600" : "text-green-600"}`}>
            {leerstandQuote}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">{totalW - belegteW} freie Whg.</p>
        </div>

        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Einnahmen {new Date().getFullYear()}</p>
          <p className="text-2xl font-bold text-green-600">
            {jahresEinnahmen > 0
              ? `CHF ${Math.round(jahresEinnahmen / 1000)}k`
              : "—"}
          </p>
          {sollMonat > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Soll/Monat: CHF {sollMonat.toLocaleString("de-CH")}</p>
          )}
        </div>

        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Offene Tickets</p>
          <p className={`text-2xl font-bold ${tickets.length > 0 ? "text-amber-600" : "text-green-600"}`}>
            {tickets.length}
          </p>
          {tickets.filter(t => t.prioritaet === "notfall").length > 0 && (
            <span className="badge-red mt-1">
              {tickets.filter(t => t.prioritaet === "notfall").length}× Notfall
            </span>
          )}
        </div>
      </div>

      {/* Liegenschaften */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-gray-900">
            Meine Liegenschaften
            <span className="ml-2 text-sm font-normal text-muted-foreground">({liegenschaften?.length ?? 0})</span>
          </h3>
          <Link href="/dashboard/objekte" className="text-sm text-[hsl(214,76%,49%)] font-medium hover:underline">
            Alle anzeigen →
          </Link>
        </div>

        {!liegenschaften?.length ? (
          <div className="py-12 text-center">
            <p className="text-3xl mb-2">🏢</p>
            <p className="text-sm text-muted-foreground">Noch keine Liegenschaften erfasst</p>
            <Link href="/dashboard/objekte" className="btn-primary mt-4 inline-flex">
              + Erste Liegenschaft
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {liegenschaften.map(l => {
              const counts = wByLg[l.id] ?? { w: 0, n: 0, belegt: 0 };
              const lgTickets = tickets.filter(t => t.liegenschaft_id === l.id).length;
              const belegung = counts.w > 0 ? Math.round(counts.belegt / counts.w * 100) : 0;
              return (
                <div key={l.id} className="flex items-center px-5 py-3.5 hover:bg-gray-50/60 transition-colors group">
                  <div className="w-8 h-8 rounded-xl bg-[hsl(214,100%,97%)] flex items-center justify-center text-sm flex-shrink-0 mr-3">
                    🏢
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.ort}
                      {" · "}
                      <span className="text-foreground font-medium">{counts.w}</span> Whg.
                      {counts.n > 0 && (
                        <> · <span className="text-foreground font-medium">{counts.n}</span> Nebenobj.</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {lgTickets > 0 && (
                      <span className="badge-amber">{lgTickets} Ticket{lgTickets > 1 ? "s" : ""}</span>
                    )}
                    <span className={`text-xs font-medium ${belegung === 100 ? "text-green-600" : belegung >= 80 ? "text-amber-600" : "text-red-600"}`}>
                      {belegung}%
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/objekte/${l.id}`}
                    className="ml-3 text-xs text-muted-foreground group-hover:text-[hsl(214,76%,49%)] transition-colors whitespace-nowrap"
                  >
                    →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/dashboard/tickets/neu",         icon: "🎫", label: "Ticket erstellen" },
          { href: "/dashboard/mahnungen",            icon: "⚠️",  label: "Mahnwesen" },
          { href: "/dashboard/uebergabe/neu",        icon: "🔑",  label: "Übergabe starten" },
          { href: "/dashboard/dokumente/jahresbericht", icon: "📊", label: "Jahresbericht" },
        ].map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="bg-white rounded-2xl border border-border p-4 shadow-sm hover:shadow-md hover:border-[hsl(214,76%,49%)] transition-all group text-center"
          >
            <p className="text-2xl mb-1">{a.icon}</p>
            <p className="text-xs font-semibold text-gray-700 group-hover:text-[hsl(214,76%,49%)] transition-colors">{a.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
