"use client";

import Link from "next/link";

interface Liegenschaft {
  id: string;
  name: string;
  ort: string;
  anzahl_wohnungen: number;
}

interface DashboardContentProps {
  profileName: string;
  liegenschaften: Liegenschaft[];
  totalWohnungen: number;
  belegteWohnungen: number;
  jahresErtrag: number;
  leerstandQuote: string;
}

export default function DashboardContent({
  profileName,
  liegenschaften,
  totalWohnungen,
  belegteWohnungen,
  jahresErtrag,
  leerstandQuote,
}: DashboardContentProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold">
          Guten Tag, {profileName} 👋
        </h2>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p>Wohnungen</p>
          <p className="text-2xl font-bold">{totalWohnungen}</p>
          <p>{belegteWohnungen} belegt</p>
        </div>

        <div className="stat-card">
          <p>Leerstand</p>
          <p className="text-2xl font-bold">{leerstandQuote}%</p>
        </div>

        <div className="stat-card">
          <p>Jahresertrag</p>
          <p className="text-2xl font-bold">
            CHF {jahresErtrag.toLocaleString("de-CH")}
          </p>
        </div>

        <div className="stat-card">
          <p>Liegenschaften</p>
          <p className="text-2xl font-bold">{liegenschaften.length}</p>
        </div>
      </div>

      {/* Liegenschaften Liste */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="flex justify-between p-4 border-b">
          <h3 className="font-semibold">Meine Liegenschaften</h3>
          <Link href="/dashboard/objekte">Alle anzeigen →</Link>
        </div>

        {liegenschaften.length === 0 ? (
          <div className="p-6 text-gray-400">Keine Daten</div>
        ) : (
          liegenschaften.map((l) => (
            <Link
              key={l.id}
              href={`/dashboard/objekte/${l.id}`}
              className="block p-4 border-b hover:bg-gray-50 transition"
            >
              <div className="font-medium">{l.name}</div>
              <div className="text-sm text-gray-400">
                {l.ort} · {l.anzahl_wohnungen} Wohnungen
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}