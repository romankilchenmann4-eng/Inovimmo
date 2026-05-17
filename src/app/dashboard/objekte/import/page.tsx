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
  mieter_telefon: string;
  mieter_strasse: string;
  mieter_plz: string;
  mieter_ort_str: string;
  mietbeginn: string;
  personenzahl: string;
};

const EXAMPLE_CSV = `liegenschaft,ort,bezeichnung,etage,zimmer,netto_miete,nebenkosten,mieter_name,mieter_email,mieter_telefon,mieter_strasse,mieter_plz,mieter_ort,mietbeginn,personenzahl
Chilenaustrasse 15,Oetwil an der Limmat,Whg 01,EG,3,1800,200,Max Muster,max@muster.ch,078 123 45 67,Hauptstrasse 1,8955,Oetwil an der Limmat,01.01.2024,2
Chilenaustrasse 15,Oetwil an der Limmat,Whg 02,1. OG,4,2200,250,Anna Beispiel,anna@beispiel.ch,079 987 65 43,Dorfstrasse 5,8955,Oetwil an der Limmat,01.03.2023,3
Chilenaustrasse 17,Oetwil an der Limmat,Whg 01,EG,3.5,1900,220,;;,,076 555 11 22,Bahnhofstrasse 8,8955,Oetwil an der Limmat,01.06.2024,1`;

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    // Simple CSV parse (handles basic cases)
    const vals: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    vals.push(current.trim());

    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj as Row;
  });
}

function parseSwissDate(val: string): string | null {
  if (!val) return null;
  // Handle DD.MM.YYYY or YYYY-MM-DD
  if (val.includes(".")) {
    const [d, m, y] = val.split(".");
    if (d && m && y) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return null;
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
      setError("Keine gueltigen Zeilen gefunden. Bitte pruefe das Format.");
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

      let importedWohnungen = 0;
      let importedMieter = 0;
      let importedMietverhaeltnisse = 0;
      let skippedMieter = 0;

      // Cache for liegenschaften to avoid repeated lookups
      const liegCache = new Map<string, string>();
      // Cache for mieter by email to avoid duplicates
      const mieterCache = new Map<string, string>();

      for (const row of preview) {
        // ── 1. Find or create Liegenschaft ──────────────────────
        const liegKey = `${row.liegenschaft}|${user.id}`;
        let liegId = liegCache.get(liegKey);

        if (!liegId) {
          const { data: lieg } = await supabase
            .from("liegenschaften")
            .select("id")
            .eq("name", row.liegenschaft)
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
          liegCache.set(liegKey, liegId!);
        }

        // ── 2. Create Wohnung ───────────────────────────────────
        const netto = parseFloat(row.netto_miete) || 0;
        const nk = parseFloat(row.nebenkosten) || 0;
        const hasMieter = !!(row.mieter_email || row.mieter_name);

        const { data: newWohnung, error: wErr } = await supabase
          .from("wohnungen")
          .insert({
            liegenschaft_id: liegId,
            bezeichnung: row.bezeichnung,
            etage: parseInt(row.etage) || 0,
            zimmer: parseFloat(row.zimmer) || 3.5,
            nettomiete: netto,
            nebenkosten_akonto: nk,
            status: hasMieter ? "vermietet" : "leer",
          })
          .select("id")
          .single();

        if (wErr) throw wErr;
        importedWohnungen++;

        // ── 3. Create Mieter and Mietverhaeltnis ────────────────
        if (hasMieter) {
          const mieterEmail = row.mieter_email?.trim().toLowerCase() || "";
          const mieterName = row.mieter_name?.trim() || "";

          // Split name into vorname/nachname
          const nameParts = mieterName.split(/\s+/);
          const nachname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : mieterName;
          const vorname = nameParts.length > 1 ? nameParts[0] : "";

          let mieterId: string | null = null;

          // Check cache or DB for existing mieter by email
          if (mieterEmail) {
            const cachedMieter = mieterCache.get(mieterEmail);
            if (cachedMieter) {
              mieterId = cachedMieter;
              skippedMieter++;
            } else {
              const { data: existingMieter } = await supabase
                .from("mieter")
                .select("id")
                .eq("email", mieterEmail)
                .maybeSingle();

              if (existingMieter) {
                mieterId = existingMieter.id;
                mieterCache.set(mieterEmail, mieterId!);
                skippedMieter++;
              }
            }
          }

          // Create new mieter if not found
          if (!mieterId) {
            const mietbeginnDate = parseSwissDate(row.mietbeginn);
            const personenzahl = parseInt(row.personenzahl) || 1;

            const { data: newMieter, error: mErr } = await supabase
              .from("mieter")
              .insert({
                vorname,
                nachname,
                email: mieterEmail || null,
                telefon_mobil: row.mieter_telefon?.trim() || null,
                strasse: row.mieter_strasse?.trim() || null,
                plz: row.mieter_plz?.trim() || null,
                ort: row.mieter_ort_str?.trim() || null,
              })
              .select("id")
              .single();

            if (mErr) throw mErr;
            mieterId = newMieter.id;
            importedMieter++;

            if (mieterEmail) {
              mieterCache.set(mieterEmail, mieterId);
            }
          }

          // Create mietverhaeltnis
          if (mieterId) {
            const mietbeginnDate = parseSwissDate(row.mietbeginn);

            const { error: mvErr } = await supabase
              .from("mietverhaeltnisse")
              .insert({
                wohnung_id: newWohnung.id,
                mieter_id: mieterId,
                ist_vertragspartner: true,
                ist_hauptperson: true,
                mietbeginn: mietbeginnDate,
              });

            if (mvErr) throw mvErr;
            importedMietverhaeltnisse++;
          }
        }
      }

      const parts = [
        `✅ ${importedWohnungen} Wohnungen`,
      ];
      if (importedMieter > 0) parts.push(`${importedMieter} Mieter`);
      if (importedMietverhaeltnisse > 0) parts.push(`${importedMietverhaeltnisse} Mietverhaeltnisse`);
      if (skippedMieter > 0) parts.push(`${skippedMieter} Mieter bereits vorhanden (uebersprungen)`);

      setResult(parts.join(" · ") + " erfolgreich importiert.");
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Mieterspiegel importieren</h2>
        <p className="text-sm text-gray-500 mt-1">
          Lade deinen bestehenden Mieterspiegel als CSV hoch. Liegenschaften, Wohnungen, Mieter und Mietverhaeltnisse werden automatisch angelegt.
        </p>
      </div>

      {/* Format-Hilfe */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">Erwartetes CSV-Format</p>
        <pre className="text-xs text-blue-700 overflow-x-auto whitespace-pre">{EXAMPLE_CSV}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setCsvText(EXAMPLE_CSV)}
            className="text-xs text-blue-600 underline"
          >
            Beispiel laden
          </button>
        </div>
        <div className="mt-3 text-xs text-blue-600 space-y-1">
          <p><strong>Pflichtfelder:</strong> liegenschaft, ort, bezeichnung, etage, zimmer, netto_miete, nebenkosten</p>
          <p><strong>Mieter (optional):</strong> mieter_name, mieter_email, mieter_telefon, mieter_strasse, mieter_plz, mieter_ort, mietbeginn (DD.MM.YYYY), personenzahl</p>
          <p>Wohnungen mit mieter_name oder mieter_email werden automatisch als &quot;vermietet&quot; markiert und mit einem Mietverhaeltnis verknuepft.</p>
        </div>
      </div>

      {/* Upload oder einfuegen */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">CSV-Datei hochladen</label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors border border-gray-200">
              Datei auswaehlen
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {csvText && (
              <span className="text-xs text-green-600 font-medium">Datei geladen</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">oder direkt einfuegen</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <label className="block text-sm font-medium text-gray-700">CSV einfuegen</label>
        <textarea
          value={csvText}
          onChange={e => { setCsvText(e.target.value); setPreview([]); }}
          rows={6}
          placeholder={`liegenschaft,ort,bezeichnung,etage,zimmer,netto_miete,nebenkosten,mieter_name,mieter_email,...`}
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
            Zu den Objekten
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
              {loading ? "Importiere..." : `${preview.length} Zeilen importieren`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Liegenschaft", "Wohnung", "Nettomiete", "NK", "Mieter", "E-Mail", "Mietbeginn"].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-medium">{row.liegenschaft}</td>
                    <td className="table-cell">{row.bezeichnung}</td>
                    <td className="table-cell">CHF {row.netto_miete}</td>
                    <td className="table-cell">CHF {row.nebenkosten}</td>
                    <td className="table-cell">{row.mieter_name || <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell text-xs">{row.mieter_email || <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell text-xs">{row.mietbeginn || <span className="text-gray-300">—</span>}</td>
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