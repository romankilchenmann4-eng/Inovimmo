"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import SubNav from "@/components/ui/SubNav";

const OBJEKTE_NAV = [
  { href: "/dashboard/objekte", label: "Liegenschaften" },
  { href: "/dashboard/mieterspiegel", label: "Mieterspiegel" },
];

type Liegenschaft = {
  id: string;
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  anzahl_wohnungen: number;
};

type Wohnung = {
  id: string;
  bezeichnung: string;
  whg_nr: string | null;
  etage: number;
  zimmer: number;
  flaeche_m2: number | null;
  nettomiete: number;
  nebenkosten_akonto: number;
  status: string;
  wohnungstyp: string;
  beheizt: boolean;
  verteilschluessel_prozent: number | null;
  position: string | null;
  mietverhaeltnisse: {
    mieter_id: string;
    ist_hauptperson: boolean;
    mieter: { vorname: string; nachname: string; email: string | null; telefon_mobil: string | null } | null;
  }[];
};

const WOHNUNGSTYP_LABELS: Record<string, string> = {
  wohnung: "Wohnung",
  einstellgarage: "Garage",
  parkplatz_aussen: "Parkplatz",
  bastelraum: "Bastelraum",
  gewerbe: "Gewerbe",
  lager: "Lager",
  sonstiges: "Sonstiges",
};

export default function MieterspiegelPage() {
  const supabase = createClient();
  const [liegenschaften, setLiegenschaften] = useState<Liegenschaft[]>([]);
  const [selectedLieg, setSelectedLieg] = useState("");
  const [wohnungen, setWohnungen] = useState<Wohnung[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);

  const loadLiegenschaften = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const admin = profile?.role === "admin";
    setIsAdmin(admin);

    let query = supabase
      .from("liegenschaften")
      .select("id, name, strasse, hausnummer, plz, ort, anzahl_wohnungen")
      .order("name");

    if (!admin) query = query.eq("verwalter_id", user.id);

    const { data } = await query;
    setLiegenschaften(data ?? []);
    if (data?.length) setSelectedLieg(data[0].id);
    setLoading(false);
  }, [supabase]);

  const loadWohnungen = useCallback(async (liegId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("wohnungen")
      .select(`
        id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete,
        nebenkosten_akonto, status, wohnungstyp, beheizt,
        verteilschluessel_prozent, position,
        mietverhaeltnisse!inner(
          mieter_id, ist_hauptperson,
          mieter:mieter!inner(vorname, nachname, email, telefon_mobil)
        )
      `)
      .eq("liegenschaft_id", liegId)
      .order("whg_nr");

    setWohnungen((data ?? []) as unknown as Wohnung[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadLiegenschaften(); }, [loadLiegenschaften]);
  useEffect(() => { if (selectedLieg) loadWohnungen(selectedLieg); }, [selectedLieg, loadWohnungen]);

  const lieg = liegenschaften.find(l => l.id === selectedLieg);

  const apartments = wohnungen.filter(w => w.wohnungstyp === "wohnung");
  const externals = wohnungen.filter(w => w.wohnungstyp !== "wohnung");

  const totalFlaeche = apartments.reduce((s, w) => s + (Number(w.flaeche_m2) || 0), 0);
  const totalMiete = apartments.reduce((s, w) => s + (Number(w.nettomiete) || 0), 0);
  const totalNK = apartments.reduce((s, w) => s + (Number(w.nebenkosten_akonto) || 0), 0);
  const totalVS = apartments.reduce((s, w) => s + (Number(w.verteilschluessel_prozent) || 0), 0);
  const leerstand = apartments.filter(w => w.status === "leer").length;

  function mieterNamen(w: Wohnung): string {
    const haupt = w.mietverhaeltnisse?.find(mv => mv.ist_hauptperson);
    if (haupt?.mieter) return `${haupt.mieter.vorname} ${haupt.mieter.nachname}`;
    const first = w.mietverhaeltnisse?.[0];
    if (first?.mieter) return `${first.mieter.vorname} ${first.mieter.nachname}`;
    return "—";
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={OBJEKTE_NAV} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mieterspiegel</h2>
          <p className="text-sm text-gray-500">Mieter- und Verteilschlüssel-Übersicht nach Liegenschaft</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedLieg}
            onChange={e => setSelectedLieg(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
          >
            {liegenschaften.map(l => (
              <option key={l.id} value={l.id}>{l.name}, {l.plz} {l.ort}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <div className="w-6 h-6 border-2 border-[hsl(214,76%,49%)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Laden...
        </div>
      ) : !lieg ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-gray-400">
          <p className="text-3xl mb-3">🏘</p>
          <p className="font-medium text-gray-600">Keine Liegenschaften gefunden</p>
          <p className="text-sm mt-1">Erstellen Sie zuerst eine Liegenschaft unter &quot;Objekte&quot;.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Wohnungen", value: String(apartments.length), color: "text-gray-900" },
              { label: "Fläche", value: `${totalFlaeche} m²`, color: "text-gray-900" },
              { label: "Miete total", value: `CHF ${totalMiete.toLocaleString("de-CH")}`, color: "text-[hsl(214,76%,49%)]" },
              { label: "NK Akonto", value: `CHF ${totalNK.toLocaleString("de-CH")}`, color: "text-gray-700" },
              { label: "Leerstand", value: `${leerstand} / ${apartments.length}`, color: leerstand > 0 ? "text-red-600" : "text-green-600" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-border p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Verteilschlüssel Summary */}
          {apartments.some(w => w.verteilschluessel_prozent) && (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Verteilschlüssel</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Prozentuale Verteilung pro Wohnung</p>
                </div>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${Math.abs(totalVS - 100) < 0.5 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                  {totalVS.toFixed(2)}% total
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Whg-Nr</th>
                      <th className="table-header">Bezeichnung</th>
                      <th className="table-header">Zimmer</th>
                      <th className="table-header">Fläche</th>
                      <th className="table-header">Anteil</th>
                      <th className="table-header">Vis.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apartments.map(w => {
                      const vs = Number(w.verteilschluessel_prozent) || 0;
                      return (
                        <tr key={w.id} className="table-row">
                          <td className="table-cell font-medium text-sm">{w.whg_nr || "—"}</td>
                          <td className="table-cell text-sm">{w.bezeichnung}</td>
                          <td className="table-cell text-sm">{w.zimmer}-ZWG</td>
                          <td className="table-cell text-sm">{w.flaeche_m2 || "—"} m²</td>
                          <td className="table-cell font-semibold text-sm">{vs.toFixed(2)}%</td>
                          <td className="table-cell">
                            <div className="w-24 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[hsl(214,76%,49%)] rounded-full"
                                style={{ width: `${Math.min(vs, 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Main Tenant Table */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Mieter-Übersicht — {lieg?.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {apartments.length} Wohnungen{externals.length > 0 ? ` · ${externals.length} Nebenräume/Garagen` : ""}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Whg-Nr</th>
                    <th className="table-header">Bezeichnung</th>
                    <th className="table-header">Mieter</th>
                    <th className="table-header">Typ</th>
                    <th className="table-header text-right">Fläche</th>
                    <th className="table-header text-right">Miete</th>
                    <th className="table-header text-right">NK Akonto</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header text-right">VS %</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {apartments.map(w => {
                    const miete = Number(w.nettomiete) || 0;
                    const nk = Number(w.nebenkosten_akonto) || 0;
                    const total = miete + nk;
                    const vs = Number(w.verteilschluessel_prozent) || 0;
                    return (
                      <tr key={w.id} className="table-row">
                        <td className="table-cell font-medium text-sm">{w.whg_nr || "—"}</td>
                        <td className="table-cell text-sm">{w.bezeichnung}</td>
                        <td className="table-cell text-sm">{mieterNamen(w)}</td>
                        <td className="table-cell text-sm">{w.zimmer}-ZWG</td>
                        <td className="table-cell text-sm text-right">{w.flaeche_m2 || "—"} m²</td>
                        <td className="table-cell text-sm text-right font-medium">
                          {miete > 0 ? `CHF ${miete.toLocaleString("de-CH", { minimumFractionDigits: 0 })}` : "—"}
                        </td>
                        <td className="table-cell text-sm text-right">
                          {nk > 0 ? `CHF ${nk.toLocaleString("de-CH", { minimumFractionDigits: 0 })}` : "—"}
                        </td>
                        <td className="table-cell text-sm text-right font-semibold">
                          {total > 0 ? `CHF ${total.toLocaleString("de-CH", { minimumFractionDigits: 0 })}` : "—"}
                        </td>
                        <td className="table-cell text-sm text-right font-semibold text-[hsl(214,76%,49%)]">
                          {vs > 0 ? `${vs.toFixed(2)}%` : "—"}
                        </td>
                        <td className="table-cell">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            w.status === "vermietet" ? "bg-green-50 text-green-700" :
                            w.status === "leer" ? "bg-red-50 text-red-700" :
                            "bg-yellow-50 text-yellow-700"
                          }`}>
                            {w.status === "vermietet" ? "vermietet" :
                             w.status === "leer" ? "leer" : "Kündigung"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-gray-700">Total Wohnungen</td>
                    <td className="px-3 py-3 text-sm text-right font-semibold">{totalFlaeche} m²</td>
                    <td className="px-3 py-3 text-sm text-right font-semibold">CHF {totalMiete.toLocaleString("de-CH")}</td>
                    <td className="px-3 py-3 text-sm text-right font-semibold">CHF {totalNK.toLocaleString("de-CH")}</td>
                    <td className="px-3 py-3 text-sm text-right font-bold">CHF {(totalMiete + totalNK).toLocaleString("de-CH")}</td>
                    <td className="px-3 py-3 text-sm text-right font-semibold">{totalVS.toFixed(2)}%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* External units (garages, parking, workshops) */}
          {externals.length > 0 && (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Nebenräume & Garagen</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Nr</th>
                      <th className="table-header">Bezeichnung</th>
                      <th className="table-header">Mieter</th>
                      <th className="table-header">Typ</th>
                      <th className="table-header text-right">NK Akonto</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externals.map(w => {
                      const nk = Number(w.nebenkosten_akonto) || 0;
                      return (
                        <tr key={w.id} className="table-row">
                          <td className="table-cell font-medium text-sm">{w.whg_nr || "—"}</td>
                          <td className="table-cell text-sm">{w.bezeichnung}</td>
                          <td className="table-cell text-sm">{mieterNamen(w)}</td>
                          <td className="table-cell text-sm">{WOHNUNGSTYP_LABELS[w.wohnungstyp] || w.wohnungstyp}</td>
                          <td className="table-cell text-sm text-right">
                            {nk > 0 ? `CHF ${nk.toLocaleString("de-CH")}` : "—"}
                          </td>
                          <td className="table-cell">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              w.status === "vermietet" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                            }`}>
                              {w.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}