import { NextRequest, NextResponse } from "next/server";
import * as ftp from "basic-ftp";
import { Readable } from "stream";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const wohnungId = formData.get("wohnungId") as string | null;
  const dateityp = (formData.get("dateityp") as string) || "sonstiges";

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${timestamp}_${safeName}`;
  const remotePath = process.env.HOSTPOINT_FTP_PATH!;
  const publicUrl = `${process.env.NEXT_PUBLIC_DOKUMENTE_URL}/${fileName}`;

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: process.env.HOSTPOINT_FTP_HOST,
      user: process.env.HOSTPOINT_FTP_USER,
      password: process.env.HOSTPOINT_FTP_PASS,
      secure: false,
    });

    // Ensure remote directory exists
    await client.ensureDir(remotePath);

    // Upload from buffer via readable stream
    const stream = Readable.from(buffer);
    await client.uploadFrom(stream, fileName);

    client.close();

    if (wohnungId) {
      await supabase.from("dokumente").insert({
        wohnung_id: wohnungId,
        hochgeladen_von: user.id,
        dateiname: file.name,
        dateityp,
        storage_path: publicUrl,
        groesse_bytes: file.size,
      });
    }

    return NextResponse.json({ url: publicUrl, name: file.name });
  } catch (err: any) {
    client.close();
    console.error("FTP Upload Fehler:", err.message);
    return NextResponse.json({ error: err.message ?? "Upload fehlgeschlagen" }, { status: 500 });
  }
}
