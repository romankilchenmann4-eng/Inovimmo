"use client";

import { toast } from "sonner";

type Escrow = { freigegeben_at?: string; betrag: number; provision_betrag: number; ticket: { titel: string } | unknown; dienstleister: { firma: string; full_name: string } | unknown };
type Nebkosten = { jahr: number; bezeichnung: string; betrag_total: number; liegenschaft: { name: string } | unknown };

export default function BuchhaltungExport({ escrows, nebkosten }: { escrows: Escrow[]; nebkosten: Nebkosten[] }) {

  function exportCSV() {
    const rows = [
      ["Datum", "Auftrag", "Dienstleister", "Betrag CHF", "Provision CHF", "Netto CHF", "MWST CHF"],
      ...escrows.map(e => {
        const dl = e.dienstleister as { firma: string; full_name: string };
        const ticket = e.ticket as { titel: string };
        const netto = e.betrag / 1.081;
        return [
          e.freigegeben_at ? new Date(e.freigegeben_at).toLocaleDateString("de-CH") : "",
          ticket?.titel ?? "",
          dl?.firma ?? dl?.full_name ?? "",
          e.betrag.toFixed(2),
          e.provision_betrag.toFixed(2),
          netto.toFixed(2),
          (e.betrag - netto).toFixed(2),
        ];
      })
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inovimmo_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportiert — bereit für Excel / Abacus / Bexio");
  }

  function exportBexio() {
    const rows = [
      ["Datum", "Belegnummer", "Buchungstext", "Soll-Konto", "Haben-Konto", "Betrag CHF", "MWST-Code"],
      ...escrows.map((e, i) => {
        const ticket = e.ticket as { titel: string };
        return [
          e.freigegeben_at ? new Date(e.freigegeben_at).toLocaleDateString("de-CH") : "",
          `IV-${String(i + 1).padStart(4, "0")}`,
          ticket?.titel ?? "Handwerkerauftrag",
          "6200", "1020",
          e.betrag.toFixed(2),
          "MWS",
        ];
      })
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inovimmo_bexio_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Bexio-Format exportiert!");
  }

  function exportJSON() {
    const data = { transaktionen: escrows, nebkosten, export_datum: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inovimmo_data_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exportiert!");
  }

  const exports = [
    { icon: "📊", label: "Excel / Abacus", desc: "Universelles CSV-Format", fn: exportCSV },
    { icon: "🔵", label: "Bexio",           desc: "Buchungssatz-Format",   fn: exportBexio },
    { icon: "⚙️", label: "JSON (API)",      desc: "Für eigene Integrationen", fn: exportJSON },
  ];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <h3 className="font-semibold text-gray-700 mb-4">Export</h3>
      <div className="grid grid-cols-3 gap-3">
        {exports.map(e => (
          <button key={e.label} onClick={e.fn}
            className="p-4 rounded-xl border-2 border-gray-200 text-left hover:border-[hsl(214,76%,49%)] hover:shadow-md transition-all">
            <span className="text-2xl block mb-2">{e.icon}</span>
            <p className="font-semibold text-sm text-gray-900">{e.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{e.desc}</p>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">Alle Exporte sind MWST-konform (8.1% Schweiz).</p>
    </div>
  );
}
