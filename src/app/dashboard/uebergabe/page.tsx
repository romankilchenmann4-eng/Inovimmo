"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import SubNav from "@/components/ui/SubNav";

const TOOLS_NAV = [
  { href: "/dashboard/screening", label: "Screening" },
  { href: "/dashboard/uebergabe", label: "Übergabe" },
  { href: "/dashboard/kalender",  label: "Kalender" },
];

type Protokoll = {
  id: string;
  typ: "einzug" | "auszug";
  wohnung_bezeichnung: string;
  mieter_name: string;
  datum: string;
  maengel_anzahl: number;
  anzahl_schluessel: number;
  unterschrift_mieter: boolean;
  status: string;
  created_at: string;
};

export default function UebergabePage() {
  const supabase = createClient();
  const [protokolle, setProtokolle] = useState<Protokoll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("uebergabeprotokolle")
        .select("id, typ, wohnung_bezeichnung, mieter_name, datum, maengel_anzahl, anzahl_schluessel, unterschrift_mieter, status, created_at")
        .order("created_at", { ascending: false });
      setProtokolle((data as Protokoll[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const einzug = protokolle.filter(p => p.typ === "einzug").length;
  const auszug = protokolle.filter(p => p.typ === "auszug").length;
  const mitMaengeln = protokolle.filter(p => p.maengel_anzahl > 0).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={TOOLS_NAV} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Übergabeprotokolle</h2>
          <p className="text-sm text-gray-500">Digitale Ein- und Auszugskontrollen</p>
        </div>
        <Link
          href="/dashboard/uebergabe/neu"
          className="flex items-center gap-2 px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl hover:bg-[hsl(214,76%,44%)] transition-colors"
        >
          + Neue Übergabe
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Einzüge</p>
          <p className="text-2xl font-bold text-green-600">{einzug}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Auszüge</p>
          <p className="text-2xl font-bold text-[hsl(214,76%,49%)]">{auszug}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Mit Mängeln</p>
          <p className={`text-2xl font-bold ${mitMaengeln > 0 ? "text-amber-600" : "text-green-600"}`}>{mitMaengeln}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Laden…</div>
        ) : protokolle.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🔑</p>
            <p className="font-semibold text-gray-700">Noch keine Übergaben erfasst</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Erstellen Sie das erste digitale Übergabeprotokoll.</p>
            <Link
              href="/dashboard/uebergabe/neu"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl"
            >
              + Erste Übergabe erfassen
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Typ</th>
                  <th className="table-header">Wohnung</th>
                  <th className="table-header">Mieter/in</th>
                  <th className="table-header">Datum</th>
                  <th className="table-header">Mängel</th>
                  <th className="table-header">Schlüssel</th>
                  <th className="table-header">Unterschrift</th>
                </tr>
              </thead>
              <tbody>
                {protokolle.map(p => (
                  <tr key={p.id} className="table-row">
                    <td className="table-cell">
                      <span className={p.typ === "einzug" ? "badge-green" : "badge-blue"}>
                        {p.typ === "einzug" ? "🔑 Einzug" : "🚪 Auszug"}
                      </span>
                    </td>
                    <td className="table-cell">
                      <p className="font-medium text-sm text-gray-900">{p.wohnung_bezeichnung}</p>
                    </td>
                    <td className="table-cell text-sm text-gray-700">{p.mieter_name}</td>
                    <td className="table-cell text-sm text-gray-500">
                      {new Date(p.datum).toLocaleDateString("de-CH")}
                    </td>
                    <td className="table-cell">
                      {p.maengel_anzahl > 0 ? (
                        <span className="badge-amber">⚠ {p.maengel_anzahl}</span>
                      ) : (
                        <span className="badge-green">✓ Keine</span>
                      )}
                    </td>
                    <td className="table-cell text-sm text-gray-700">{p.anzahl_schluessel}×</td>
                    <td className="table-cell">
                      {p.unterschrift_mieter ? (
                        <span className="badge-green">✓ Bestätigt</span>
                      ) : (
                        <span className="badge-gray">Ausstehend</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
