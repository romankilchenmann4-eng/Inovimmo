"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Dokument = {
  id: string;
  bezeichnung: string;
  typ: string;
  dateiname: string;
  storage_path: string;
  public_url: string;
  mime_type?: string;
  groesse_bytes: number;
  created_at: string;
  liegenschaft?: { name: string } | null;
  wohnung?: { bezeichnung: string } | null;
};

type Liegenschaft = { id: string; name: string; ort: string };
type Wohnung = { id: string; bezeichnung: string };

const DOK_TYPEN: Record<string, string> = {
  mietvertrag: "Mietvertrag",
  nachtrag: "Nachtrag",
  nk_abrechnung: "NK-Abrechnung",
  uebergabeprotokoll: "Übergabeprotokoll",
  rechnung: "Rechnung",
  versicherung: "Versicherung",
  korrespondenz: "Korrespondenz",
  sonstiges: "Sonstiges",
};

const TYPE_ICONS: Record<string, string> = {
  mietvertrag: "📝",
  nachtrag: "📄",
  nk_abrechnung: "📑",
  uebergabeprotokoll: "🔑",
  rechnung: "🧾",
  versicherung: "🛡️",
  korrespondenz: "✉️",
  sonstiges: "📁",
};

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DokumentePage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [liegenschaften, setLiegenschaften] = useState<Liegenschaft[]>([]);
  const [wohnungen, setWohnungen] = useState<Wohnung[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterTyp, setFilterTyp] = useState("alle");
  const [filterLieg, setFilterLieg] = useState("alle");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    bezeichnung: "",
    typ: "sonstiges",
    liegenschaft_id: "",
    wohnung_id: "",
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (form.liegenschaft_id) loadWohnungen(form.liegenschaft_id);
    else setWohnungen([]);
  }, [form.liegenschaft_id]);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const [{ data: docs }, { data: liegs }] = await Promise.all([
      supabase
        .from("dokumente")
        .select("*, liegenschaft:liegenschaften(name), wohnung:wohnungen(bezeichnung)")
        .eq("eigentümer_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("liegenschaften")
        .select("id,name,ort")
        .eq("verwalter_id", user!.id)
        .order("name"),
    ]);

    setDokumente(docs ?? []);
    setLiegenschaften(liegs ?? []);
    setLoading(false);
  }

  async function loadWohnungen(liegId: string) {
    const { data } = await supabase
      .from("wohnungen")
      .select("id,bezeichnung")
      .eq("liegenschaft_id", liegId)
      .order("bezeichnung");
    setWohnungen(data ?? []);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Datei wählen"); return; }
    if (!form.bezeichnung) { toast.error("Bezeichnung eingeben"); return; }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop();
      const storagePath = `${user!.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { error: upErr } = await supabase.storage
        .from("dokumente")
        .upload(storagePath, file, { contentType: file.type });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("dokumente").getPublicUrl(storagePath);

      await supabase.from("dokumente").insert({
        eigentümer_id: user!.id,
        liegenschaft_id: form.liegenschaft_id || null,
        wohnung_id: form.wohnung_id || null,
        bezeichnung: form.bezeichnung,
        typ: form.typ,
        dateiname: file.name,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        mime_type: file.type,
        groesse_bytes: file.size,
      });

      toast.success("Dokument hochgeladen");
      setShowUpload(false);
      setFile(null);
      setForm({ bezeichnung: "", typ: "sonstiges", liegenschaft_id: "", wohnung_id: "" });
      loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDokument(dok: Dokument) {
    if (!confirm(`"${dok.bezeichnung}" wirklich löschen?`)) return;
    await supabase.storage.from("dokumente").remove([dok.storage_path]);
    await supabase.from("dokumente").delete().eq("id", dok.id);
    toast.success("Dokument gelöscht");
    setDokumente(d => d.filter(x => x.id !== dok.id));
  }

  const filtered = dokumente.filter(d => {
    if (filterTyp !== "alle" && d.typ !== filterTyp) return false;
    if (filterLieg !== "alle" && d.liegenschaft_id !== filterLieg) return false;
    if (search && !d.bezeichnung.toLowerCase().includes(search.toLowerCase()) && !d.dateiname.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalBytes = dokumente.reduce((s, d) => s + (d.groesse_bytes || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dokumentenarchiv</h2>
          <p className="text-sm text-gray-500">{dokumente.length} Dokumente · {formatBytes(totalBytes)} belegt</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl hover:bg-[hsl(214,76%,44%)] transition-colors"
        >
          + Dokument hochladen
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche…"
          className={inp + " max-w-xs"}
        />
        <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} className={inp + " w-auto"}>
          <option value="alle">Alle Typen</option>
          {Object.entries(DOK_TYPEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterLieg} onChange={e => setFilterLieg(e.target.value)} className={inp + " w-auto"}>
          <option value="alle">Alle Liegenschaften</option>
          {liegenschaften.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Dokumente Liste */}
      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-gray-400">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📁</p>
          <p className="font-medium text-gray-600">
            {dokumente.length === 0 ? "Noch keine Dokumente" : "Keine Treffer"}
          </p>
          <p className="text-sm mt-1">
            {dokumente.length === 0
              ? "Laden Sie Mietverträge, NK-Abrechnungen und weitere Dokumente hoch."
              : "Filter anpassen oder andere Suchbegriffe verwenden."}
          </p>
          {dokumente.length === 0 && (
            <button onClick={() => setShowUpload(true)} className="mt-4 px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-xl text-sm font-semibold">
              Erstes Dokument hochladen
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Dokument</th>
                  <th className="table-header">Typ</th>
                  <th className="table-header">Liegenschaft / Wohnung</th>
                  <th className="table-header">Grösse</th>
                  <th className="table-header">Datum</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{TYPE_ICONS[d.typ] ?? "📄"}</span>
                        <div>
                          <p className="font-medium text-sm text-gray-900">{d.bezeichnung}</p>
                          <p className="text-xs text-gray-400">{d.dateiname}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="badge-gray text-xs">{DOK_TYPEN[d.typ] ?? d.typ}</span>
                    </td>
                    <td className="table-cell text-sm text-gray-600">
                      {(d.liegenschaft as any)?.name && (
                        <p>{(d.liegenschaft as any).name}</p>
                      )}
                      {(d.wohnung as any)?.bezeichnung && (
                        <p className="text-xs text-gray-400">{(d.wohnung as any).bezeichnung}</p>
                      )}
                      {!(d.liegenschaft as any)?.name && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-cell text-sm text-gray-500">{formatBytes(d.groesse_bytes)}</td>
                    <td className="table-cell text-xs text-gray-400">
                      {new Date(d.created_at).toLocaleDateString("de-CH")}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-3">
                        <a
                          href={d.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[hsl(214,76%,49%)] font-medium hover:underline"
                        >
                          Öffnen
                        </a>
                        <a
                          href={d.public_url}
                          download={d.dateiname}
                          className="text-xs text-gray-500 font-medium hover:underline"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => deleteDokument(d)}
                          className="text-xs text-red-400 font-medium hover:underline"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Dokument hochladen</h3>
              <button onClick={() => { setShowUpload(false); setFile(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* Datei-Drop */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? "border-[hsl(214,76%,49%)] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                {file ? (
                  <div>
                    <p className="text-2xl mb-1">📄</p>
                    <p className="font-medium text-sm text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl mb-1">📂</p>
                    <p className="text-sm text-gray-600">Datei auswählen oder hier ablegen</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Bilder — max. 50 MB</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      if (!form.bezeichnung) setForm(x => ({ ...x, bezeichnung: f.name.replace(/\.[^.]+$/, "") }));
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Bezeichnung *</label>
                <input
                  required
                  value={form.bezeichnung}
                  onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))}
                  placeholder="z.B. Mietvertrag Müller 2024"
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Typ</label>
                <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))} className={inp}>
                  {Object.entries(DOK_TYPEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Liegenschaft</label>
                  <select value={form.liegenschaft_id} onChange={e => setForm(f => ({ ...f, liegenschaft_id: e.target.value, wohnung_id: "" }))} className={inp}>
                    <option value="">— keine —</option>
                    {liegenschaften.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Wohnung</label>
                  <select value={form.wohnung_id} onChange={e => setForm(f => ({ ...f, wohnung_id: e.target.value }))} className={inp} disabled={!form.liegenschaft_id}>
                    <option value="">— keine —</option>
                    {wohnungen.map(w => <option key={w.id} value={w.id}>{w.bezeichnung}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => { setShowUpload(false); setFile(null); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Abbrechen</button>
                <button type="submit" disabled={!file || !form.bezeichnung || uploading} className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Hochladen…
                    </span>
                  ) : "Hochladen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
