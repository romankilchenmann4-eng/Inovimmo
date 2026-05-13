import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles").select("full_name, role").eq("id", user.id).single();

  const role = profile?.role;

  const { data: liegenschaften } = await supabase
    .from("liegenschaften")
    .select("id, name, ort, anzahl_wohnungen")
    .eq("verwalter_id", user.id)
    .order("name");

  const lgIds = (liegenschaften ?? []).map(l => l.id);

  const [
    { data: wohnungen },
    { data: offeneTickets },
    { data: zahlungen },
    { data: offeneMahnungen },
    { data: ungeleseneNachrichten },
    { data: upcomingGVs },
  ] = await Promise.all([
    lgIds.length
      ? supabase.from("wohnungen").select("id, liegenschaft_id, status, nettomiete, nebenkosten_akonto, wohnungstyp").in("liegenschaft_id", lgIds)
      : { data: [] },
    lgIds.length
      ? supabase.from("tickets").select("id, liegenschaft_id, prioritaet").in("liegenschaft_id", lgIds).in("status", ["neu", "ausgeschrieben", "offerten_eingegangen"])
      : { data: [] },
    lgIds.length
      ? supabase.from("buchungen").select("betrag").in("liegenschaft_id", lgIds).eq("typ", "miete_zahlung").eq("periode_jahr", new Date().getFullYear())
      : { data: [] },
    supabase.from("mahnungen").select("id").eq("verwalter_id", user.id).eq("status", "offen"),
    supabase.from("nachrichten").select("id").eq("empfaenger_id", user.id).eq("gelesen", false),
    supabase.from("stwe_generalversammlungen").select("id, typ, datum, ort, status, gemeinschaft:stwe_gemeinschaften(name)").gte("datum", new Date().toISOString()).order("datum").limit(3),
  ]);

  const alleWohnungen  = (wohnungen ?? []).filter(w => w.wohnungstyp === "wohnung");
  const nebenobjekte   = (wohnungen ?? []).filter(w => w.wohnungstyp !== "wohnung");
  const totalW         = alleWohnungen.length;
  const belegteW       = alleWohnungen.filter(w => w.status === "vermietet").length;
  const leerstandQuote = totalW > 0 ? ((totalW - belegteW) / totalW * 100).toFixed(1) : "0.0";
  const jahresEinnahmen = (zahlungen ?? []).reduce((s, z) => s + Number(z.betrag), 0);
  const sollMonat       = alleWohnungen.filter(w => w.status === "vermietet").reduce((s, w) => s + Number(w.nettomiete) + Number(w.nebenkosten_akonto), 0);
  const tickets         = offeneTickets ?? [];
  const mahnCount       = offeneMahnungen?.length ?? 0;
  const nachrichtenCount = ungeleseneNachrichten?.length ?? 0;

  const vorname = profile?.full_name?.split(" ")[0] ?? "";
  const stunde  = new Date().getHours();
  const gruss   = stunde < 12 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";

  const wByLg = (wohnungen ?? []).reduce<Record<string, { w: number; n: number; belegt: number }>>((acc, w) => {
    if (!acc[w.liegenschaft_id]) acc[w.liegenschaft_id] = { w: 0, n: 0, belegt: 0 };
    if (w.wohnungstyp === "wohnung")  acc[w.liegenschaft_id].w++;
    if (w.wohnungstyp !== "wohnung")  acc[w.liegenschaft_id].n++;
    if (w.status === "vermietet" && w.wohnungstyp === "wohnung") acc[w.liegenschaft_id].belegt++;
    return acc;
  }, {});

  const isVerwalter = role === "admin" || role === "verwalter";

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{gruss}{vorname ? `, ${vorname}` : ""} 👋</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPIs */}
      {isVerwalter && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground mb-1">Wohnungen</p>
            <p className="text-2xl font-bold text-foreground">{totalW}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="badge-green">{belegteW} vermietet</span>
              {nebenobjekte.length > 0 && <span className="text-xs text-muted-foreground">+{nebenobjekte.length} Nebenobj.</span>}
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
              {jahresEinnahmen > 0 ? `CHF ${Math.round(jahresEinnahmen / 1000)}k` : "—"}
            </p>
            {sollMonat > 0 && <p className="text-xs text-muted-foreground mt-1">Soll/Mo: CHF {sollMonat.toLocaleString("de-CH")}</p>}
          </div>

          <div className="stat-card">
            <p className="text-xs text-muted-foreground mb-1">Offene Tickets</p>
            <p className={`text-2xl font-bold ${tickets.length > 0 ? "text-amber-600" : "text-green-600"}`}>{tickets.length}</p>
            {tickets.filter(t => t.prioritaet === "notfall").length > 0 && (
              <span className="badge-red mt-1">{tickets.filter(t => t.prioritaet === "notfall").length}× Notfall</span>
            )}
          </div>
        </div>
      )}

      {/* Alerts row */}
      {isVerwalter && (mahnCount > 0 || nachrichtenCount > 0) && (
        <div className="flex gap-3 flex-wrap">
          {mahnCount > 0 && (
            <Link href="/dashboard/mahnungen" className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
              <span className="text-red-500">⚠️</span>
              <span className="text-sm font-semibold text-red-700">{mahnCount} offene Mahnung{mahnCount > 1 ? "en" : ""}</span>
            </Link>
          )}
          {nachrichtenCount > 0 && (
            <Link href="/dashboard/nachrichten" className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
              <span className="text-[hsl(214,76%,49%)]">💬</span>
              <span className="text-sm font-semibold text-[hsl(214,76%,49%)]">{nachrichtenCount} neue Nachricht{nachrichtenCount > 1 ? "en" : ""}</span>
            </Link>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Liegenschaften */}
        {isVerwalter && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-gray-900">
                Meine Liegenschaften
                <span className="ml-2 text-sm font-normal text-muted-foreground">({liegenschaften?.length ?? 0})</span>
              </h3>
              <Link href="/dashboard/objekte" className="text-sm text-[hsl(214,76%,49%)] font-medium hover:underline">Alle →</Link>
            </div>

            {!liegenschaften?.length ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">🏢</p>
                <p className="text-sm text-muted-foreground">Noch keine Liegenschaften erfasst</p>
                <Link href="/dashboard/objekte" className="btn-primary mt-4 inline-flex">+ Erste Liegenschaft</Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {liegenschaften.map(l => {
                  const counts = wByLg[l.id] ?? { w: 0, n: 0, belegt: 0 };
                  const lgTickets = tickets.filter(t => t.liegenschaft_id === l.id).length;
                  const belegung = counts.w > 0 ? Math.round(counts.belegt / counts.w * 100) : 0;
                  return (
                    <div key={l.id} className="flex items-center px-5 py-3.5 hover:bg-gray-50/60 transition-colors group">
                      <div className="w-8 h-8 rounded-xl bg-[hsl(214,100%,97%)] flex items-center justify-center text-sm flex-shrink-0 mr-3">🏢</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.ort} · <span className="text-foreground font-medium">{counts.w}</span> Whg.
                          {counts.n > 0 && <> · <span className="text-foreground font-medium">{counts.n}</span> Nebenobj.</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {lgTickets > 0 && <span className="badge-amber">{lgTickets}T</span>}
                        <span className={`text-xs font-bold ${belegung === 100 ? "text-green-600" : belegung >= 80 ? "text-amber-600" : "text-red-600"}`}>
                          {belegung}%
                        </span>
                      </div>
                      <Link href={`/dashboard/objekte/${l.id}`} className="ml-3 text-xs text-muted-foreground group-hover:text-[hsl(214,76%,49%)]">→</Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Right column */}
        <div className="space-y-4">
          {isVerwalter && (upcomingGVs?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 text-sm">Nächste GVs</h4>
                <Link href="/dashboard/stwe" className="text-xs text-[hsl(214,76%,49%)] hover:underline">Alle →</Link>
              </div>
              <div className="divide-y divide-border">
                {(upcomingGVs ?? []).map(gv => {
                  const g = gv.gemeinschaft as unknown as { name: string } | null;
                  return (
                    <div key={gv.id} className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-900">{g?.name ?? "—"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(gv.datum).toLocaleDateString("de-CH", { day: "2-digit", month: "short" })}
                        {" "}um{" "}
                        {new Date(gv.datum).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                        {gv.ort && ` · ${gv.ort}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
            <h4 className="font-semibold text-gray-900 text-sm mb-3">Schnellaktionen</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/dashboard/tickets/neu",            icon: "🎫", label: "Ticket" },
                { href: "/dashboard/nachrichten",            icon: "💬", label: "Nachricht" },
                { href: "/dashboard/uebergabe/neu",          icon: "🔑",  label: "Übergabe" },
                { href: "/dashboard/mahnungen",              icon: "⚠️",  label: "Mahnwesen" },
                { href: "/dashboard/qr-rechnung",            icon: "📄",  label: "QR-Rechnung" },
                { href: "/dashboard/kalender",               icon: "📅",  label: "Kalender" },
              ].map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 border border-border transition-all hover:border-[hsl(214,76%,49%)] group"
                >
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-xs font-medium text-gray-600 group-hover:text-[hsl(214,76%,49%)]">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
