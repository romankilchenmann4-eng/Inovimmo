"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Row = {
  liegenschaft: string;
  ort: string;
  bezeichnung: string;
  etage: string;
  zimmer: string;
  flaeche_m2: string;
  netto_miete: string;
  nebenkosten: string;
  mieter_name: string;
  mieter_email: string;
};

const EXAMPLE_CSV = `liegenschaft,ort,bezeichnung,etage,zimmer,flaeche_m2,netto_miete,nebenkosten,mieter_name,mieter_email
Musterstrasse 1,Zürich,Whg 01,EG,3.5,75,1800,200,Max Muster,max@muster.ch
Musterstrasse 1,Zürich,Whg 02,"1. OG",4.5,90,2200,250,Anna Beispiel,anna@beispiel.ch
Musterstrasse 1,Zürich,Whg 03,2. OG,2,50,1400,150,,`;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj as Row;
  });
}

function etageToNumber(etage: string): number {
  const s = etage.trim().toLowerCase();
  if (s === "eg" || s === "0" || s === "e" || s === "erdgeschoss" || s === "parterre") return 0;
  if (s === "1. og" || s === "1. stock" || s === "1" || s === "1. stockwerk") return 1;
  if (s === "2. og" || s === "2. stock" || s === "2" || s === "2. stockwerk") return 2;
  if (s === "3. og" || s === "3. stock" || s === "3" || s === "3. stockwerk") return 3;
  if (s === "dg" || s === "dachgeschoss") return 4;
  const num = parseInt(s, 10);
  return isNaN(num) ? 0 : num;
}

function splitName(full: string): { vorname: string; nachname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { vorname: full.trim(), nachname: "" };
  return { vorname: parts[0], nachname: parts.slice(1).join(" ") };
}

export default function MieterspiegelImportPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setPreview([]);
      setError(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleParse() {
    setError(null);
    const rows = parseCsv(csvText);
    if (!rows.length) {
      setError("Keine gültigen Zeilen gefunden. Bitte prüfe das Format.");
      return;
    }
    setPreview(rows);
  }

  async function handleImport() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      let imported = 0;
      const liegenschaftCache = new Map<string, string>();

      for (const row of preview) {
        // Find or create Liegenschaft
        const liegKey = `${row.liegenschaft}|${row.ort}`;
        let liegId = liegenschaftCache.get(liegKey);

        if (!liegId) {
          const { data: lieg } = await supabase
            .from("liegenschaften")
            .select("id")
            .eq("name", row.liegenschaft)
            .eq("ort", row.ort)
            .eq("verwalter_id", user.id)
            .maybeSingle();

          if (lieg) {
            liegId = lieg.id;
          } else {
            const { data: newLieg, error: liegErr } = await supabase
              .from("liegenschaften")
              .insert({
                name: row.liegenschaft,
                ort: row.ort,
                verwalter_id: user.id,
                anzahl_wohnungen: 0,
              })
              .select("id")
              .single();
            if (liegErr) throw liegErr;
            liegId = newLieg!.id;
          }
          liegenschaftCache.set(liegKey, liegId!);
        }

        // Create Mieter if name provided
        let mieterId: string | null = null;
        if (row.mieter_name?.trim()) {
          const { vorname, nachname } = splitName(row.mieter_name);
          const { data: newMieter, error: mieterErr } = await supabase
            .from("mieter")
            .insert({
              verwalter_id: user.id,
              vorname,
              nachname,
              email: row.mieter_email?.trim() || null,
            })
            .select("id")
            .single();
          if (mieterErr) throw mieterErr;
          mieterId = newMieter!.id;
        }

        // Create Wohnung
        const netto = parseFloat(row.netto_miete) || 0;
        const nk = parseFloat(row.nebenkosten) || 0;
        const flaeche = parseFloat(row.flaeche_m2) || null;

        const wohnungData: Record<string, unknown> = {
          liegenschaft_id: liegId,
          bezeichnung: row.bezeichnung,
          etage: etageToNumber(row.etage),
          position: row.etage || null,
          zimmer: parseFloat(row.zimmer) || 3.5,
          flaeche_m2: flaeche,
          nettomiete: netto,
          nebenkosten_akonto: nk,
          status: mieterId ? "vermietet" : "leer",
        };

        const { data: newWohnung, error: wErr } = await supabase
          .from("wohnungen")
          .insert(wohnungData)
          .select("id")
          .single();
        if (wErr) throw wErr;

        // Create Mietverhältnis linking mieter to wohnung
        if (mieterId && newWohnung) {
          const { error: mvErr } = await supabase
            .from("mietverhaeltnisse")
            .insert({
              wohnung_id: newWohnung.id,
              mieter_id: mieterId,
              mietbeginn: new Date().toISOString().slice(0, 10),
              ist_hauptperson: true,
              ist_vertragspartner: true,
            });
          if (mvErr) throw mvErr;
        }

        imported++;
      }

      // Update anzahl_wohnungen for all touched liegenschaften
      for (const liegId of liegenschaftCache.values()) {
        const { count } = await supabase
          .from("wohnungen")
          .select("id", { count: "exact", head: true })
          .eq("liegenschaft_id", liegId);
        await supabase
          .from("liegenschaften")
          .update({ anzahl_wohnungen: count ?? 0 })
          .eq("id", liegId);
      }

      setResult(`✅ ${imported} Wohnungen erfolgreich importiert.`);
      setPreview([]);
      setCsvText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Mieterspiegel importieren</h2>
        <p className="text-sm text-gray-500 mt-1">
          Lade deinen bestehenden Mieterspiegel als CSV hoch. Liegenschaften, Wohnungen und Mieter werden automatisch angelegt.
        </p>
      </div>

      {/* Format-Hilfe */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">📄 Erwartetes CSV-Format</p>
        <pre className="text-xs text-blue-700 overflow-x-auto whitespace-pre">{EXAMPLE_CSV}</pre>
        <button
          onClick={() => setCsvText(EXAMPLE_CSV)}
          className="mt-2 text-xs text-blue-600 underline"
        >
          Beispiel laden
        </button>
      </div>

      {/* Upload oder einfügen */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">CSV-Datei hochladen</label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors border border-gray-200">
              📁 Datei auswählen
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {csvText && (
              <span className="text-xs text-green-600 font-medium">✓ Datei geladen</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">oder direkt einfügen</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <label className="block text-sm font-medium text-gray-700">CSV einfügen</label>
        <textarea
          value={csvText}
          onChange={e => { setCsvText(e.target.value); setPreview([]); }}
          rows={6}
          placeholder={`liegenschaft,ort,bezeichnung,etage,zimmer,flaeche_m2,netto_miete,nebenkosten,mieter_name,mieter_email\n...`}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]"
        />
        <button
          onClick={handleParse}
          disabled={!csvText.trim()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors"
        >
          Vorschau anzeigen
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          {result}
          <button onClick={() => router.push("/dashboard/objekte")} className="ml-4 underline">
            Zu den Objekten →
          </button>
        </div>
      )}

      {preview.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <p className="font-semibold text-gray-900">{preview.length} Zeilen gefunden</p>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-4 py-2 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors"
            >
              {loading ? "Importiere…" : `${preview.length} Wohnungen importieren`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Liegenschaft", "Ort", "Bezeichnung", "Etage", "Zi.", "m²", "Nettomiete", "NK", "Mieter"].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-medium">{row.liegenschaft}</td>
                    <td className="table-cell text-gray-500">{row.ort}</td>
                    <td className="table-cell">{row.bezeichnung}</td>
                    <td className="table-cell">{row.etage}</td>
                    <td className="table-cell">{row.zimmer}</td>
                    <td className="table-cell">{row.flaeche_m2 || "—"}</td>
                    <td className="table-cell">CHF {row.netto_miete}</td>
                    <td className="table-cell">CHF {row.nebenkosten}</td>
                    <td className="table-cell">{row.mieter_name || <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}