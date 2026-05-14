"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import SubNav from "@/components/ui/SubNav";

const FINANZEN_NAV = [
  { href: "/dashboard/buchhaltung",  label: "Buchhaltung" },
  { href: "/dashboard/nebkosten",    label: "Nebenkosten" },
  { href: "/dashboard/mahnungen",    label: "Mahnwesen" },
  { href: "/dashboard/qr-rechnung",  label: "QR-Rechnung" },
];

type Liegenschaft = { id: string; name: string; ort: string };
type Wohnung = { id: string; bezeichnung: string; flaeche_m2: number; nebenkosten_akonto: number };
type NKPosition = { id?: string; bezeichnung: string; kategorie: string; betrag_total: number; verteilschluessel: string };
type Abrechnung = {
  id: string;
  liegenschaft_id: string;
  wohnung_id: string;
  jahr: number;
  akonto_total: number;
  kosten_total: number;
  differenz: number;
  status: string;
  erstellt_at: string;
  wohnung?: { bezeichnung: string };
};

const KATEGORIEN: Record<string, string> = {
  heizung: "Heizung",
  warmwasser: "Warmwasser",
  wasser_abwasser: "Wasser / Abwasser",
  kehricht: "Kehricht",
  allgemeinstrom: "Allgemeinstrom",
  hauswart: "Hauswart",
  versicherung: "Versicherung",
  sonstiges: "Sonstiges",
};

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

export default function NebenkostenPage() {
  const supabase = createClient();
  const [liegenschaften, setLiegenschaften] = useState<Liegenschaft[]>([]);
  const [wohnungen, setWohnungen] = useState<Wohnung[]>([]);
  const [abrechnungen, setAbrechnungen] = useState<Abrechnung[]>([]);
  const [selectedLieg, setSelectedLieg] = useState("");
  const [jahr, setJahr] = useState(new Date().getFullYear() - 1);
  const [positionen, setPositionen] = useState<NKPosition[]>([
    { bezeichnung: "Heizkosten", kategorie: "heizung", betrag_total: 0, verteilschluessel: "flaeche" },
    { bezeichnung: "Warmwasser", kategorie: "warmwasser", betrag_total: 0, verteilschluessel: "flaeche" },
    { bezeichnung: "Wasser / Abwasser", kategorie: "wasser_abwasser", betrag_total: 0, verteilschluessel: "kopf" },
    { bezeichnung: "Kehrichttaxen", kategorie: "kehricht", betrag_total: 0, verteilschluessel: "kopf" },
    { bezeichnung: "Allgemeinstrom", kategorie: "allgemeinstrom", betrag_total: 0, verteilschluessel: "gleich" },
    { bezeichnung: "Hauswart", kategorie: "hauswart", betrag_total: 0, verteilschluessel: "gleich" },
  ]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"erfassen" | "abrechnungen">("erfassen");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectedLieg) loadWohnungen(selectedLieg);
  }, [selectedLieg]);

  useEffect(() => {
    if (selectedLieg) loadAbrechnungen(selectedLieg);
  }, [selectedLieg, jahr]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("liegenschaften")
      .select("id,name,ort")
      .eq("verwalter_id", user!.id)
      .order("name");
    setLiegenschaften(data ?? []);
    if (data?.length) setSelectedLieg(data[0].id);
  }

  async function loadWohnungen(liegId: string) {
    const { data } = await supabase
      .from("wohnungen")
      .select("id,bezeichnung,flaeche_m2,nebenkosten_akonto")
      .eq("liegenschaft_id", liegId)
      .order("bezeichnung");
    setWohnungen(data ?? []);
  }

  async function loadAbrechnungen(liegId: string) {
    const { data } = await supabase
      .from("nebenkostenabrechnungen")
      .select("*, wohnung:wohnungen(bezeichnung)")
      .eq("liegenschaft_id", liegId)
      .order("jahr", { ascending: false })
      .order("erstellt_at", { ascending: false });
    setAbrechnungen(data ?? []);
  }

  function updatePosition(i: number, field: keyof NKPosition, value: string | number) {
    setPositionen(p => p.map((pos, idx) => idx === i ? { ...pos, [field]: value } : pos));
  }

  function addPosition() {
    setPositionen(p => [...p, { bezeichnung: "", kategorie: "sonstiges", betrag_total: 0, verteilschluessel: "gleich" }]);
  }

  function removePosition(i: number) {
    setPositionen(p => p.filter((_, idx) => idx !== i));
  }

  function berechneAnteil(wohnung: Wohnung, pos: NKPosition): number {
    if (pos.betrag_total <= 0) return 0;
    const aktiveWohnungen = wohnungen.filter(w => w.flaeche_m2 > 0 || pos.verteilschluessel === "gleich");
    if (aktiveWohnungen.length === 0) return 0;

    if (pos.verteilschluessel === "flaeche") {
      const totalFlaeche = aktiveWohnungen.reduce((s, w) => s + (Number(w.flaeche_m2) || 0), 0);
      if (totalFlaeche === 0) return pos.betrag_total / aktiveWohnungen.length;
      return (pos.betrag_total * (Number(wohnung.flaeche_m2) || 0)) / totalFlaeche;
    }
    if (pos.verteilschluessel === "gleich") {
      return pos.betrag_total / aktiveWohnungen.length;
    }
    // kopf — gleich wie gleich für jetzt
    return pos.betrag_total / aktiveWohnungen.length;
  }

  function totalKostenFuerWohnung(wohnung: Wohnung): number {
    return positionen
      .filter(p => p.betrag_total > 0)
      .reduce((sum, pos) => sum + berechneAnteil(wohnung, pos), 0);
  }

  const gesamtKosten = positionen.reduce((s, p) => s + (Number(p.betrag_total) || 0), 0);

  async function erstelleAbrechnungen() {
    if (!selectedLieg) { toast.error("Liegenschaft wählen"); return; }
    if (wohnungen.length === 0) { toast.error("Keine Wohnungen in dieser Liegenschaft"); return; }
    const aktivPos = positionen.filter(p => p.betrag_total > 0 && p.bezeichnung);
    if (aktivPos.length === 0) { toast.error("Mindestens eine Kostenstelle erfassen"); return; }

    setLoading(true);
    try {
      // Kostenpositionen speichern
      await supabase.from("nebenkostenpositionen").delete()
        .eq("liegenschaft_id", selectedLieg).eq("jahr", jahr);

      for (const pos of aktivPos) {
        await supabase.from("nebenkostenpositionen").insert({
          liegenschaft_id: selectedLieg,
          jahr,
          bezeichnung: pos.bezeichnung,
          betrag_total: pos.betrag_total,
          verteilschluessel: pos.verteilschluessel,
          kategorie: pos.kategorie,
        });
      }

      // Abrechnung pro Wohnung erstellen
      await supabase.from("nebenkostenabrechnungen").delete()
        .eq("liegenschaft_id", selectedLieg).eq("jahr", jahr);

      for (const wohnung of wohnungen) {
        const kostenTotal = totalKostenFuerWohnung(wohnung);
        const akontoTotal = Number(wohnung.nebenkosten_akonto) * 12;

        const { data: abr } = await supabase.from("nebenkostenabrechnungen").insert({
          wohnung_id: wohnung.id,
          liegenschaft_id: selectedLieg,
          jahr,
          akonto_total: akontoTotal,
          kosten_total: Math.round(kostenTotal * 100) / 100,
          status: "entwurf",
        }).select().single();

        if (abr) {
          const posRows = aktivPos.map(pos => {
            const anteilProzent = pos.betrag_total > 0
              ? (berechneAnteil(wohnung, pos) / pos.betrag_total) * 100
              : 0;
            return {
              abrechnung_id: abr.id,
              bezeichnung: pos.bezeichnung,
              kategorie: pos.kategorie,
              betrag_total: pos.betrag_total,
              anteil_prozent: Math.round(anteilProzent * 10000) / 10000,
              betrag_anteil: Math.round(berechneAnteil(wohnung, pos) * 100) / 100,
            };
          });
          await supabase.from("nk_abrechnung_positionen").insert(posRows);
        }
      }

      toast.success(`${wohnungen.length} Abrechnungen für ${jahr} erstellt`);
      setTab("abrechnungen");
      loadAbrechnungen(selectedLieg);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function statusAendern(id: string, status: string) {
    await supabase.from("nebenkostenabrechnungen").update({ status, versendet_at: status === "versendet" ? new Date().toISOString() : null }).eq("id", id);
    loadAbrechnungen(selectedLieg);
    toast.success(status === "versendet" ? "Als versendet markiert" : "Status aktualisiert");
  }

  const STATUS: Record<string, { label: string; cls: string }> = {
    entwurf:  { label: "Entwurf",   cls: "badge-gray" },
    versendet: { label: "Versendet", cls: "badge-blue" },
    bezahlt:  { label: "Bezahlt",   cls: "badge-green" },
  };

  const lieg = liegenschaften.find(l => l.id === selectedLieg);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={FINANZEN_NAV} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Nebenkostenabrechnung</h2>
          <p className="text-sm text-gray-500">Jährliche NK-Abrechnung nach Schweizer Mietrecht</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select value={selectedLieg} onChange={e => setSelectedLieg(e.target.value)} className={inp + " w-auto"}>
            {liegenschaften.map(l => <option key={l.id} value={l.id}>{l.name}, {l.ort}</option>)}
          </select>
          <select value={jahr} onChange={e => setJahr(Number(e.target.value))} className={inp + " w-32"}>
            {[0, 1, 2, 3].map(offset => {
              const y = new Date().getFullYear() - offset;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["erfassen", "abrechnungen"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "erfassen" ? "Kosten erfassen" : `Abrechnungen ${abrechnungen.filter(a => a.jahr === jahr).length > 0 ? `(${abrechnungen.filter(a => a.jahr === jahr).length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "erfassen" && (
        <div className="space-y-5">
          <div className="info-box-blue text-sm text-blue-700">
            Erfassen Sie die Gesamtkosten pro Kategorie für <strong>{lieg?.name ?? "—"}</strong> im Jahr <strong>{jahr}</strong>. Die Verteilung auf die Wohnungen wird automatisch berechnet.
          </div>

          {/* Kostenpositionen */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Kostenpositionen {jahr}</h3>
              <button onClick={addPosition} className="text-xs text-[hsl(214,76%,49%)] font-medium hover:underline">+ Position hinzufügen</button>
            </div>
            <div className="divide-y divide-gray-50">
              {positionen.map((pos, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                  <input
                    value={pos.bezeichnung}
                    onChange={e => updatePosition(i, "bezeichnung", e.target.value)}
                    placeholder="Bezeichnung"
                    className="flex-1 min-w-[160px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
                  />
                  <select value={pos.kategorie} onChange={e => updatePosition(i, "kategorie", e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none">
                    {Object.entries(KATEGORIEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={pos.verteilschluessel} onChange={e => updatePosition(i, "verteilschluessel", e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none">
                    <option value="flaeche">nach Fläche</option>
                    <option value="kopf">nach Köpfen</option>
                    <option value="gleich">zu gleichen Teilen</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">CHF</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pos.betrag_total || ""}
                      onChange={e => updatePosition(i, "betrag_total", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] text-right"
                    />
                  </div>
                  <button onClick={() => removePosition(i)} className="text-gray-300 hover:text-red-400 transition-colors text-sm">✕</button>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total Gesamtkosten</span>
              <span className="text-lg font-bold text-gray-900">CHF {gesamtKosten.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Vorschau Verteilung */}
          {wohnungen.length > 0 && gesamtKosten > 0 && (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Verteilungsvorschau</h3>
                <p className="text-xs text-gray-400 mt-0.5">{wohnungen.length} Wohnungen · Total CHF {gesamtKosten.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Wohnung</th>
                      <th className="table-header">Fläche m²</th>
                      <th className="table-header">NK-Kosten {jahr}</th>
                      <th className="table-header">NK Akonto (12 Mt.)</th>
                      <th className="table-header">Differenz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wohnungen.map(w => {
                      const kosten = totalKostenFuerWohnung(w);
                      const akonto = Number(w.nebenkosten_akonto) * 12;
                      const diff = akonto - kosten;
                      return (
                        <tr key={w.id} className="table-row">
                          <td className="table-cell font-medium text-sm">{w.bezeichnung}</td>
                          <td className="table-cell text-sm">{w.flaeche_m2 || "—"}</td>
                          <td className="table-cell font-semibold">CHF {kosten.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</td>
                          <td className="table-cell text-sm">CHF {akonto.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</td>
                          <td className={`table-cell font-semibold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-500"}`}>
                            {diff > 0 ? "+" : ""}CHF {diff.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                            <span className="text-xs font-normal ml-1 text-gray-400">{diff > 0 ? "Rückerstattung" : diff < 0 ? "Nachzahlung" : ""}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={erstelleAbrechnungen}
            disabled={loading || !selectedLieg || positionen.filter(p => p.betrag_total > 0).length === 0}
            className="w-full py-3 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl disabled:opacity-50 text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Abrechnungen werden erstellt…
              </span>
            ) : `${wohnungen.length} Abrechnungen für ${jahr} erstellen`}
          </button>
        </div>
      )}

      {tab === "abrechnungen" && (
        <div className="space-y-4">
          {abrechnungen.filter(a => a.jahr === jahr).length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-12 text-center text-gray-400">
              <p className="text-3xl mb-3">📑</p>
              <p className="font-medium text-gray-600">Keine Abrechnungen für {jahr}</p>
              <p className="text-sm mt-1">Erfassen Sie die Kosten im Tab "Kosten erfassen" und erstellen Sie die Abrechnungen.</p>
              <button onClick={() => setTab("erfassen")} className="mt-4 px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-xl text-sm font-semibold">
                Kosten erfassen
              </button>
            </div>
          ) : (
            <>
              {/* Zusammenfassung */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Entwurf",
                    value: abrechnungen.filter(a => a.jahr === jahr && a.status === "entwurf").length,
                    color: "text-gray-600",
                  },
                  {
                    label: "Versendet",
                    value: abrechnungen.filter(a => a.jahr === jahr && a.status === "versendet").length,
                    color: "text-blue-600",
                  },
                  {
                    label: "Bezahlt",
                    value: abrechnungen.filter(a => a.jahr === jahr && a.status === "bezahlt").length,
                    color: "text-green-600",
                  },
                ].map(k => (
                  <div key={k.label} className="stat-card">
                    <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                    <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="table-header">Wohnung</th>
                        <th className="table-header">NK-Kosten</th>
                        <th className="table-header">Akonto</th>
                        <th className="table-header">Differenz</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abrechnungen.filter(a => a.jahr === jahr).map(a => {
                        const diff = Number(a.akonto_total) - Number(a.kosten_total);
                        const s = STATUS[a.status] ?? { label: a.status, cls: "badge-gray" };
                        return (
                          <tr key={a.id} className="table-row">
                            <td className="table-cell font-medium text-sm">
                              {(a.wohnung as any)?.bezeichnung ?? "—"}
                            </td>
                            <td className="table-cell font-semibold text-sm">
                              CHF {Number(a.kosten_total).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="table-cell text-sm">
                              CHF {Number(a.akonto_total).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`table-cell font-semibold text-sm ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-500"}`}>
                              {diff > 0 ? "+" : ""}CHF {diff.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="table-cell"><span className={s.cls}>{s.label}</span></td>
                            <td className="table-cell">
                              <div className="flex gap-2 flex-wrap">
                                {a.status === "entwurf" && (
                                  <button
                                    onClick={() => statusAendern(a.id, "versendet")}
                                    className="text-xs text-[hsl(214,76%,49%)] font-medium hover:underline"
                                  >
                                    Als versendet markieren
                                  </button>
                                )}
                                {a.status === "versendet" && (
                                  <button
                                    onClick={() => statusAendern(a.id, "bezahlt")}
                                    className="text-xs text-green-600 font-medium hover:underline"
                                  >
                                    Als bezahlt markieren
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
