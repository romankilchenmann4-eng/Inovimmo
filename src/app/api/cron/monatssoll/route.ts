import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Automatische monatliche Mietsollstellung
 *
 * Trigger: Railway CRON / Vercel CRON am 1. des Monats um 06:00 Uhr
 * Schutz: CRON_SECRET Header muss mit process.env.CRON_SECRET übereinstimmen
 *
 * Was passiert:
 * 1. Alle vermieteten Wohnungen werden abgefragt
 * 2. Pro Wohnung wird geprüft ob für den aktuellen Monat bereits ein miete_soll existiert
 * 3. Falls nicht: neue Buchung miete_soll wird erstellt
 * 4. Gleichzeitig: NK-Soll-Buchung falls nebenkosten_akonto > 0
 *
 * Kann auch manuell via POST mit Authorization: Bearer <CRON_SECRET> aufgerufen werden.
 */
export async function POST(req: NextRequest) {
  // Auth check
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createClient();

  const now = new Date();
  const monat = now.getMonth() + 1;
  const jahr = now.getFullYear();

  // Get all currently rented wohnungen with their liegenschaft
  const { data: wohnungen, error: wErr } = await supabase
    .from("wohnungen")
    .select("id, bezeichnung, nettomiete, nebenkosten_akonto, liegenschaft_id, mieter_id")
    .eq("status", "vermietet")
    .not("mieter_id", "is", null);

  if (wErr) {
    return NextResponse.json({ error: wErr.message }, { status: 500 });
  }

  if (!wohnungen || wohnungen.length === 0) {
    return NextResponse.json({ message: "Keine vermieteten Wohnungen gefunden", erstellt: 0 });
  }

  // Check which wohnungen already have a miete_soll for this month
  const { data: existingBuchungen } = await supabase
    .from("buchungen")
    .select("wohnung_id")
    .eq("typ", "miete_soll")
    .eq("periode_monat", monat)
    .eq("periode_jahr", jahr);

  const alreadyBooked = new Set((existingBuchungen ?? []).map(b => b.wohnung_id));

  // Create Soll-Buchungen for wohnungen that don't have one yet
  const toInsert: {
    wohnung_id: string;
    liegenschaft_id: string;
    typ: string;
    betrag: number;
    valuta: string;
    periode_monat: number;
    periode_jahr: number;
    notiz: string;
  }[] = [];

  for (const w of wohnungen) {
    if (alreadyBooked.has(w.id)) continue;

    const valuta = `${jahr}-${String(monat).padStart(2, "0")}-01`;

    // Miete Soll
    if (Number(w.nettomiete) > 0) {
      toInsert.push({
        wohnung_id: w.id,
        liegenschaft_id: w.liegenschaft_id,
        typ: "miete_soll",
        betrag: Number(w.nettomiete),
        valuta,
        periode_monat: monat,
        periode_jahr: jahr,
        notiz: `Automatische Sollstellung ${String(monat).padStart(2, "0")}/${jahr}`,
      });
    }

    // NK Soll
    if (Number(w.nebenkosten_akonto) > 0) {
      toInsert.push({
        wohnung_id: w.id,
        liegenschaft_id: w.liegenschaft_id,
        typ: "nk_soll",
        betrag: Number(w.nebenkosten_akonto),
        valuta,
        periode_monat: monat,
        periode_jahr: jahr,
        notiz: `NK-Akonto automatisch ${String(monat).padStart(2, "0")}/${jahr}`,
      });
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      message: `Sollstellung ${monat}/${jahr} bereits vollständig`,
      erstellt: 0,
      monat,
      jahr,
    });
  }

  // Batch insert in chunks of 100
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error: insErr } = await supabase.from("buchungen").insert(chunk);
    if (insErr) {
      return NextResponse.json({
        error: insErr.message,
        teilweise_erstellt: inserted,
      }, { status: 500 });
    }
    inserted += chunk.length;
  }

  const wohnungenCount = toInsert.filter(b => b.typ === "miete_soll").length;

  return NextResponse.json({
    message: `Sollstellung ${monat}/${jahr} erfolgreich`,
    erstellt: inserted,
    wohnungen: wohnungenCount,
    monat,
    jahr,
  });
}

// GET: status check (wie viele Wohnungen haben noch keine Sollstellung für den aktuellen Monat)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createClient();
  const now = new Date();
  const monat = now.getMonth() + 1;
  const jahr = now.getFullYear();

  const { count: totalVermietet } = await supabase
    .from("wohnungen")
    .select("id", { count: "exact", head: true })
    .eq("status", "vermietet");

  const { count: mitSoll } = await supabase
    .from("buchungen")
    .select("id", { count: "exact", head: true })
    .eq("typ", "miete_soll")
    .eq("periode_monat", monat)
    .eq("periode_jahr", jahr);

  return NextResponse.json({
    monat,
    jahr,
    vermietet_total: totalVermietet ?? 0,
    soll_erstellt: mitSoll ?? 0,
    offen: (totalVermietet ?? 0) - (mitSoll ?? 0),
  });
}
