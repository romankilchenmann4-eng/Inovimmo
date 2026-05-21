import { NextRequest, NextResponse } from "next/server";
import * as ftp from "basic-ftp";
import { Readable } from "stream";
import { createClient } from "@/lib/supabase/server";

// Erlaubte MIME-Types für Uploads
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

// Maximale Dateigrösse: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Gefährliche Dateiendungen blockieren
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".js", ".vbs", ".ps1", ".msi", ".jar"];

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hasDangerousExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return BLOCKED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const wohnungId = formData.get("wohnungId") as string | null;
  const dateityp = (formData.get("dateityp") as string) || "sonstiges";

  // Datei-Validierung
  if (!file) {
    return NextResponse.json({ error: "Keine Datei angegeben" }, { status: 400 });
  }

  // Dateigrösse prüfen
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Datei ist zu gross (max. 10 MB)" }, { status: 400 });
  }

  // Dateityp prüfen
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return NextResponse.json({
      error: `Dateityp nicht erlaubt. Erlaubt sind: ${ALLOWED_MIME_TYPES.join(", ")}`
    }, { status: 400 });
  }

  // Gefährliche Erweiterungen blockieren
  if (hasDangerousExtension(file.name)) {
    return NextResponse.json({ error: "Dieser Dateityp ist aus Sicherheitsgründen nicht erlaubt" }, { status: 400 });
  }

  // Dateinamen sanitieren
  const safeOriginalName = sanitizeFilename(file.name);
  const timestamp = Date.now();
  const fileName = `${timestamp}_${safeOriginalName}`;

  const remotePath = process.env.HOSTPOINT_FTP_PATH;
  if (!remotePath) {
    return NextResponse.json({ error: "Server-Konfiguration unvollständig" }, { status: 500 });
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_DOKUMENTE_URL}/${fileName}`;

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    // FTPS mit Verschlüsselung
    await client.access({
      host: process.env.HOSTPOINT_FTP_HOST,
      user: process.env.HOSTPOINT_FTP_USER,
      password: process.env.HOSTPOINT_FTP_PASS,
      secure: true,
      secureOptions: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });

    // Remote-Verzeichnis sicherstellen
    await client.ensureDir(remotePath);

    // Buffer erstellen und uploaden
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);
    await client.uploadFrom(stream, fileName);

    client.close();

    // Dokument in Datenbank erfassen
    if (wohnungId) {
      // Berechtigung prüfen: User muss Zugriff auf Wohnung haben
      const { data: wohnung } = await supabase
        .from("wohnungen")
        .select("liegenschaft_id")
        .eq("id", wohnungId)
        .single();

      if (!wohnung) {
        return NextResponse.json({ error: "Wohnung nicht gefunden" }, { status: 404 });
      }

      await supabase.from("dokumente").insert({
        wohnung_id: wohnungId,
        hochgeladen_von: user.id,
        dateiname: safeOriginalName,
        dateityp,
        storage_path: publicUrl,
        groesse_bytes: file.size,
        mime_type: file.type,
      });
    }

    return NextResponse.json({ url: publicUrl, name: safeOriginalName });
  } catch (err: any) {
    try { client.close(); } catch {}
    console.error("FTPS Upload Fehler:", err.message);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}
