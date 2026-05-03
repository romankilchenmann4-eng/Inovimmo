"use client";

import { toast } from "sonner";

export default function BuchhaltungExport({ escrows, nebkosten }: { escrows: unknown[]; nebkosten: unknown[] }) {

  function exportCSV() {
    const rows = [
      ["Datum", "Auftrag", "Dienstleister", "Betrag CHF", "Provision CHF", "Netto CHF", "MWST CHF", "Status"],
      ...(escrows as {freigegeben_at:string;betrag:number;provision_betrag:number;ticket:{titel:string};dienstleister:{firma:string;full_name:string}}[]).map(e => {
        const netto = e.betrag / 1.081;
        return [
          e.freigegeben_at ? new Date(e.freigegeben_at).toLocaleDateString("de-CH") : "",
          e.ticket?.titel ?? "",
          e.dienstleister?.firma ?? e.dienstleister?.full_name ?? "",
          e.betrag.toFixed(2),
          e.provision_betrag.toFixed(2),
          netto.toFixed(2),
          (e.betrag - netto).toFixed(2),
          "Abgeschlossen",
        ];
      })
    ];

    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inovimmo_transaktionen_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV exportiert — bereit für Excel / Abacus / Bexio");
  }

  function exportBexio() {
    // Bexio CSV format (Buchungssatz)
    const rows = [
      ["Datum", "Belegnummer", "Buchungstext", "Soll-Konto", "Haben-Konto", "Betrag CHF", "MWST-Code"],
      ...(escrows as {freigegeben_at:string;betrag:number;ticket:{titel:string}}[]).map((e, i) => [
        e.freigegeben_at ? new Date(e.freigegeben_at).toLocaleDateString("de-CH") : "",
        `IV-${String(i + 1).padStart(4, "0")}`,
        e.ticket?.titel ?? "Handwerkerauftrag",
        "6200",  // Aufwand
        "1020",  // Bank
        e.betrag.toFixed(2),
        "MWS",
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inovimmo_bexio_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Bexio-Format exportiert!");
  }

  function exportJSON() {
    const data = { transaktionen: escrows, nebkosten, export_datum: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inovimmo_data_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    toast.success("JSON exportiert — für API-Integration");
  }

  const exports = [
    { icon: "📊", label: "Excel / Abacus", desc: "Universelles CSV-Format", fn: exportCSV, color: "border-green-200 hover:border-green-400" },
    { icon: "🔵", label: "Bexio", desc: "Buchungssatz-Format", fn: exportBexio, color: "border-blue-200 hover:border-blue-400" },
    { icon: "⚙️", label: "JSON (API)", desc: "Für eigene Integrationen", fn: exportJSON, color: "border-gray-200 hover:border-gray-400" },
  ];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <h3 className="font-semibold text-gray-700 mb-4">Export</h3>
      <div className="grid grid-cols-3 gap-3">
        {exports.map(e => (
          <button key={e.label} onClick={e.fn}
            className={`p-4 rounded-xl border-2 text-left hover:shadow-md transition-all ${e.color}`}>
            <span className="text-2xl block mb-2">{e.icon}</span>
            <p className="font-semibold text-sm text-gray-900">{e.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{e.desc}</p>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">Alle Exporte sind MWST-konform (8.1% Schweiz). Daten bleiben auf Ihrem Gerät.</p>
    </div>
  );
}
