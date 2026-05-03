"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const TYPEN = [
  { value: "mietvertrag",        label: "📝 Mietvertrag" },
  { value: "nk_abrechnung",      label: "📑 NK-Abrechnung" },
  { value: "uebergabeprotokoll", label: "🏠 Übergabeprotokoll" },
  { value: "versicherung",       label: "🛡 Versicherung" },
  { value: "wartung",            label: "🔧 Wartungsprotokoll" },
  { value: "korrespondenz",      label: "✉️ Korrespondenz" },
  { value: "sonstiges",          label: "📄 Sonstiges" },
];

export default function DokumentUpload({ liegenschaften }: { liegenschaften: { id: string; name: string }[] }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState({ liegenschaft_id: "", typ: "sonstiges", bezeichnung: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (!form.liegenschaft_id) { toast.error("Bitte zuerst Liegenschaft wählen"); return; }
    setUploading(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `${user!.id}/${form.liegenschaft_id}/${Date.now()}_${file.name}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("dokumente")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage.from("dokumente").getPublicUrl(path);

        // Save metadata to DB
        await supabase.from("dokumente").insert({
          eigentümer_id: user!.id,
          liegenschaft_id: form.liegenschaft_id,
          bezeichnung: form.bezeichnung || file.name.replace(`.${ext}`, ""),
          typ: form.typ,
          dateiname: file.name,
          storage_path: path,
          public_url: publicUrl,
          mime_type: file.type,
          groesse_bytes: file.size,
        });

        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      toast.success(`${files.length} Dokument${files.length > 1 ? "e" : ""} hochgeladen!`);
      setForm(f => ({ ...f, bezeichnung: "" }));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm">Dokument hochladen</h3>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Liegenschaft *</label>
        <select
          value={form.liegenschaft_id}
          onChange={e => setForm(f => ({ ...f, liegenschaft_id: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
        >
          <option value="">Bitte wählen…</option>
          {liegenschaften.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Typ</label>
          <select
            value={form.typ}
            onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
          >
            {TYPEN.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Bezeichnung</label>
          <input
            type="text"
            value={form.bezeichnung}
            onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))}
            placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragging ? "border-[hsl(214,76%,49%)] bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <input
          ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
          className="hidden" onChange={e => upload(e.target.files)}
        />
        {uploading ? (
          <div>
            <div className="w-8 h-8 border-2 border-[hsl(214,76%,49%)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600">{progress}% hochgeladen…</p>
          </div>
        ) : (
          <>
            <p className="text-2xl mb-2">📁</p>
            <p className="text-sm font-medium text-gray-700">Drag & Drop oder klicken</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, JPG, PNG · Max. 50 MB</p>
          </>
        )}
      </div>

      {uploading && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[hsl(214,76%,49%)] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
