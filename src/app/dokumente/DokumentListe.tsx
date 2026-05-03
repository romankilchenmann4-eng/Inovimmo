"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Dokument = {
  id: string; bezeichnung: string; typ: string; dateiname: string;
  public_url: string; mime_type: string; groesse_bytes: number; created_at: string;
  liegenschaft?: { name: string }; wohnung?: { bezeichnung: string };
};

export default function DokumentListe({ dokumente, typen }: {
  dokumente: Dokument[];
  typen: Record<string, { label: string; icon: string; cls: string }>;
}) {
  const [search, setSearch] = useState("");
  const [filterTyp, setFilterTyp] = useState("alle");
  const router = useRouter();
  const supabase = createClient();

  const filtered = dokumente.filter(d => {
    const matchSearch = d.bezeichnung.toLowerCase().includes(search.toLowerCase()) ||
      d.dateiname.toLowerCase().includes(search.toLowerCase());
    const matchTyp = filterTyp === "alle" || d.typ === filterTyp;
    return matchSearch && matchTyp;
  });

  function formatSize(bytes: number) {
    if (bytes < 1000) return `${bytes} B`;
    if (bytes < 1e6) return `${(bytes / 1000).toFixed(0)} KB`;
    return `${(bytes / 1e6).toFixed(1)} MB`;
  }

  async function deleteDoc(id: string, path: string) {
    if (!confirm("Dokument löschen?")) return;
    await supabase.storage.from("dokumente").remove([path]);
    await supabase.from("dokumente").delete().eq("id", id);
    toast.success("Dokument gelöscht");
    router.refresh();
  }

  async function shareDoc(url: string, name: string) {
    try {
      await navigator.share({ title: name, url });
    } catch {
      await navigator.clipboard.writeText(url);
      toast.success("Link kopiert!");
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + Filter */}
      <div className="flex gap-3">
        <input
          type="text" placeholder="Suchen…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
        />
        <select
          value={filterTyp} onChange={e => setFilterTyp(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
        >
          <option value="alle">Alle Typen</option>
          {Object.entries(typen).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* List */}
      {!filtered.length ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-gray-400">
          <p className="text-3xl mb-2">📄</p>
          <p className="text-sm">{search ? "Keine Treffer" : "Noch keine Dokumente"}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Dokument</th>
                <th className="table-header">Liegenschaft</th>
                <th className="table-header">Grösse</th>
                <th className="table-header">Datum</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const typ = typen[d.typ] ?? { label: d.typ, icon: "📄", cls: "badge-gray" };
                const isPDF = d.mime_type === "application/pdf";
                return (
                  <tr key={d.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{typ.icon}</span>
                        <div>
                          <p className="font-medium text-sm text-gray-900 truncate max-w-[200px]">{d.bezeichnung}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`${typ.cls} text-xs`}>{typ.label}</span>
                            <span className="text-xs text-gray-400 truncate max-w-[120px]">{d.dateiname}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-sm text-gray-600">
                      {d.liegenschaft?.name ?? "—"}
                    </td>
                    <td className="table-cell text-sm text-gray-400">{formatSize(d.groesse_bytes)}</td>
                    <td className="table-cell text-xs text-gray-400">
                      {new Date(d.created_at).toLocaleDateString("de-CH")}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <a
                          href={d.public_url} target="_blank" rel="noopener noreferrer"
                          className="px-2 py-1 text-xs text-[hsl(214,76%,49%)] hover:bg-blue-50 rounded"
                        >
                          {isPDF ? "Ansehen" : "Download"}
                        </a>
                        <button
                          onClick={() => shareDoc(d.public_url, d.bezeichnung)}
                          className="px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 rounded"
                        >
                          Teilen
                        </button>
                        <button
                          onClick={() => deleteDoc(d.id, d.public_url)}
                          className="px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
