import { NextRequest, NextResponse } from "next/server";
import {
  finishAutomationRun,
  getAutomationAdminClient,
  getAutomationTrigger,
  isCronAuthorized,
  startAutomationRun,
} from "@/lib/automation/server";

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
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAutomationAdminClient();
  const run = await startAutomationRun(supabase, "monatssoll", getAutomationTrigger(req));

  try {
  const now = new Date();
  const monat = now.getMonth() + 1;
  const jahr = now.getFullYear();

  // Get all currently rented wohnungen with their liegenschaft
  const { data: wohnungen, error: wErr } = await supabase
    .from("wohnungen")
    .select(`
      id, bezeichnung, nettomiete, nebenkosten_akonto, liegenschaft_id, mieter_id,
      liegenschaft:liegenschaften(verwalter_id),
      mietverhaeltnisse(mieter_id)
    `)
    .eq("status", "vermietet")
    .not("mieter_id", "is", null);

  if (wErr) {
    await finishAutomationRun(supabase, run, "failed", {}, wErr.message);
    return NextResponse.json({ error: wErr.message }, { status: 500 });
  }

  if (!wohnungen || wohnungen.length === 0) {
    const summary = { message: "Keine vermieteten Wohnungen gefunden", erstellt: 0 };
    await finishAutomationRun(supabase, run, "success", summary);
    return NextResponse.json(summary);
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
    verwalter_id: string;
    wohnung_id: string;
    liegenschaft_id: string;
    mieter_id: string | null;
    typ: string;
    buchungstext: string;
    betrag: number;
    valuta: string;
    periode_monat: number;
    periode_jahr: number;
    notiz: string;
    manuell: boolean;
  }[] = [];

  for (const w of wohnungen) {
    if (alreadyBooked.has(w.id)) continue;

    const valuta = `${jahr}-${String(monat).padStart(2, "0")}-01`;
    const liegenschaft = Array.isArray(w.liegenschaft) ? w.liegenschaft[0] : w.liegenschaft;
    const verwalterId = liegenschaft?.verwalter_id;
    const aktivesMietverhaeltnis = Array.isArray(w.mietverhaeltnisse) ? w.mietverhaeltnisse[0] : null;
    const mieterId = w.mieter_id ?? aktivesMietverhaeltnis?.mieter_id ?? null;

    if (!verwalterId) continue;

    // Miete Soll
    if (Number(w.nettomiete) > 0) {
      toInsert.push({
        verwalter_id: verwalterId,
        wohnung_id: w.id,
        liegenschaft_id: w.liegenschaft_id,
        mieter_id: mieterId,
        typ: "miete_soll",
        buchungstext: `Mietzins ${w.bezeichnung} ${String(monat).padStart(2, "0")}/${jahr}`,
        betrag: Number(w.nettomiete),
        valuta,
        periode_monat: monat,
        periode_jahr: jahr,
        notiz: `Automatische Sollstellung ${String(monat).padStart(2, "0")}/${jahr}`,
        manuell: false,
      });
    }

    // NK Soll
    if (Number(w.nebenkosten_akonto) > 0) {
      toInsert.push({
        verwalter_id: verwalterId,
        wohnung_id: w.id,
        liegenschaft_id: w.liegenschaft_id,
        mieter_id: mieterId,
        typ: "nk_soll",
        buchungstext: `Nebenkosten-Akonto ${w.bezeichnung} ${String(monat).padStart(2, "0")}/${jahr}`,
        betrag: Number(w.nebenkosten_akonto),
        valuta,
        periode_monat: monat,
        periode_jahr: jahr,
        notiz: `NK-Akonto automatisch ${String(monat).padStart(2, "0")}/${jahr}`,
        manuell: false,
      });
    }
  }

  if (toInsert.length === 0) {
    const summary = {
      message: `Sollstellung ${monat}/${jahr} bereits vollständig`,
      erstellt: 0,
      monat,
      jahr,
    };
    await finishAutomationRun(supabase, run, "success", summary);
    return NextResponse.json(summary);
  }

  // Batch insert in chunks of 100
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error: insErr } = await supabase.from("buchungen").insert(chunk);
    if (insErr) {
      const summary = {
        error: insErr.message,
        teilweise_erstellt: inserted,
      };
      await finishAutomationRun(supabase, run, "failed", summary, insErr.message);
      return NextResponse.json(summary, { status: 500 });
    }
    inserted += chunk.length;
  }

  const wohnungenCount = toInsert.filter(b => b.typ === "miete_soll").length;

  const summary = {
    message: `Sollstellung ${monat}/${jahr} erfolgreich`,
    erstellt: inserted,
    wohnungen: wohnungenCount,
    monat,
    jahr,
  };
  await finishAutomationRun(supabase, run, "success", summary);
  return NextResponse.json(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sollstellung fehlgeschlagen";
    await finishAutomationRun(supabase, run, "failed", {}, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
