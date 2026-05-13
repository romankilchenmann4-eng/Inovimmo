"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Dokument = {
  id: string;
  dateiname: string;
  dateityp: string;
  created_at: string;
  storage_path: string;
};

export default function MietvertragPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const wohnungId = params.wohnungId as string;
  const objektId = params.id as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [typ, setTyp] = useState("mietvertrag");
  const [progress, setProgress] = useState<string | null>(null);

  async function loadDokumente() {
    const { data } = await supabase
      .from("dokumente")
      .select("id, dateiname, dateityp, created_at, storage_path")
      .eq("wohnung_id", wohnungId)
      .order("created_at", { ascending: false });
    setDokumente((data as any) || []);
  }

  useEffect(() => { loadDokumente(); }, [wohnungId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress("Verbindung zu Hostpoint…");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("wohnungId", wohnungId);
      fd.append("dateityp", typ);

      setProgress("Datei wird hochgeladen…");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen");

      toast.success(`«${file.name}» erfolgreich hochgeladen`);
      setProgress(null);
      await loadDokumente();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Hochladen");
      setProgress(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const typLabels: Record<string, string> = {
    mietvertrag: "Mietvertrag",
    nachtrag: "Nachtrag",
    kuendigung: "Kündigung",
    sonstiges: "Sonstiges",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-6">
      <button
        onClick={() => router.back()}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        ← Zurück
      </button>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mietvertrag & Dokumente</h1>
        <p className="text-sm text-gray-400 mt-1">
          Dateien werden auf <span className="font-medium text-gray-600">inovimmo.ch/dokumente</span> gespeichert.
        </p>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Dokument hochladen</h2>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Dokumenttyp</label>
          <select
            value={typ}
            onChange={e => setTyp(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {Object.entries(typLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <label className={`flex flex-col items-center justify-center gap-2 w-full py-10 border-2 border-dashed rounded-lg transition-colors ${
          uploading ? "border-blue-200 bg-blue-50 cursor-wait" : "border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50"
        }`}>
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-blue-600">{progress}</span>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-500">PDF oder Word-Dokument auswählen</span>
              <span className="text-xs text-gray-400">Wird auf inovimmo.ch gespeichert</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Dokumentenliste */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Gespeicherte Dokumente
          </h2>
        </div>
        {dokumente.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">
            Noch keine Dokumente hinterlegt.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {dokumente.map(d => (
              <div key={d.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.dateiname}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {typLabels[d.dateityp] ?? d.dateityp}
                    {" · "}
                    {new Date(d.created_at).toLocaleDateString("de-CH")}
                  </p>
                </div>
                <a
                  href={d.storage_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[hsl(214,76%,49%)] hover:underline"
                >
                  Öffnen →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
