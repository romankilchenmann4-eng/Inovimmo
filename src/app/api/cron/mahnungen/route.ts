import { NextRequest, NextResponse } from "next/server";
import { sendMahnung } from "@/lib/email";
import {
  finishAutomationRun,
  getAutomationAdminClient,
  getAutomationTrigger,
  isCronAuthorized,
  startAutomationRun,
} from "@/lib/automation/server";

export const dynamic = "force-dynamic";

/**
 * Automatisches tägliches Mahnwesen
 *
 * Läuft täglich um 09:00 Uhr.
 * Findet alle unbezahlten miete_soll-Buchungen und eskaliert Mahnungen automatisch:
 *  ≥10 Tage überfällig → 1. Mahnung (Zahlungserinnerung)
 *  ≥20 Tage überfällig → 2. Mahnung
 *  ≥30 Tage überfällig → 3. (Letzte) Mahnung vor Betreibung
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAutomationAdminClient();
  const run = await startAutomationRun(supabase, "mahnungen", getAutomationTrigger(req));

  try {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all overdue miete_soll buchungen (valuta at least 10 days ago)
  const cutoff10 = new Date(today);
  cutoff10.setDate(cutoff10.getDate() - 10);

  const { data: sollBuchungen, error: sollErr } = await supabase
    .from("buchungen")
    .select(`
      id, wohnung_id, betrag, valuta, periode_monat, periode_jahr,
      wohnung:wohnungen(
        id, bezeichnung,
        liegenschaft:liegenschaften(name, verwalter_id),
        mietverhaeltnisse(
          mieter_id,
          mieter:mieter(id, vorname, nachname, email)
        )
      )
    `)
    .eq("typ", "miete_soll")
    .lte("valuta", cutoff10.toISOString().split("T")[0])
    .not("wohnung_id", "is", null);

  if (sollErr) {
    await finishAutomationRun(supabase, run, "failed", {}, sollErr.message);
    return NextResponse.json({ error: sollErr.message }, { status: 500 });
  }

  if (!sollBuchungen?.length) {
    const summary = { message: "Keine überfälligen Sollbuchungen", verarbeitet: 0 };
    await finishAutomationRun(supabase, run, "success", summary);
    return NextResponse.json(summary);
  }

  // Get all corresponding zahlungen for those wohnungen+perioden
  const wohnungIds = Array.from(new Set(sollBuchungen.map(b => b.wohnung_id).filter(Boolean)));
  const { data: zahlungen } = await supabase
    .from("buchungen")
    .select("wohnung_id, periode_monat, periode_jahr, betrag")
    .eq("typ", "miete_zahlung")
    .in("wohnung_id", wohnungIds);

  // Get existing mahnungen for those wohnungen
  const { data: existingMahnungen } = await supabase
    .from("mahnungen")
    .select("wohnung_id, stufe, periode, status")
    .in("wohnung_id", wohnungIds)
    .neq("status", "storniert");

  let erstellt = 0;
  let übersprungen = 0;

  const mahnungenToInsert: Array<{
    verwalter_id: string;
    wohnung_id: string;
    mieter_id: string | null;
    stufe: 1 | 2 | 3;
    offener_betrag: number;
    periode: string;
    versendet_at: string;
    auto_erstellt: boolean;
    status: string;
  }> = [];

  const emailsToSend: Array<{
    to: string;
    mieterName: string;
    wohnung: string;
    liegenschaft: string;
    offenerBetrag: number;
    offeneMonate: string[];
    mahnstufe: 1 | 2 | 3;
  }> = [];

  for (const soll of sollBuchungen) {
    if (!soll.wohnung_id) { übersprungen++; continue; }

    const wohnung = soll.wohnung as unknown as {
      id: string;
      bezeichnung: string;
      liegenschaft: { name: string; verwalter_id: string } | null;
      mietverhaeltnisse: Array<{
        mieter_id: string;
        mieter: { id: string; vorname: string; nachname: string; email: string | null } | null;
      }>;
    } | null;

    if (!wohnung?.liegenschaft?.verwalter_id) { übersprungen++; continue; }

    // Check if payment covers the full amount for this wohnung+periode
    const zahlungenFuerPeriode = (zahlungen ?? []).filter(
      z =>
        z.wohnung_id === soll.wohnung_id &&
        z.periode_monat === soll.periode_monat &&
        z.periode_jahr === soll.periode_jahr
    );
    const totalBezahlt = zahlungenFuerPeriode.reduce((sum, z) => sum + Number(z.betrag), 0);
    const sollBetrag = Number(soll.betrag);
    const bezahlt = totalBezahlt >= sollBetrag * 0.99; // Allow minor rounding differences
    if (bezahlt) { übersprungen++; continue; }

    // Calculate days overdue
    const valutaDate = new Date(soll.valuta);
    const daysOverdue = Math.floor((today.getTime() - valutaDate.getTime()) / 86400000);

    const targetStufe =
      daysOverdue >= 30 ? 3 :
      daysOverdue >= 20 ? 2 :
      daysOverdue >= 10 ? 1 : 0;

    if (targetStufe === 0) { übersprungen++; continue; }

    const periode = `${soll.periode_jahr}-${String(soll.periode_monat).padStart(2, "0")}`;

    // Find highest existing mahnstufe for this wohnung+periode
    const periodeMahnungen = (existingMahnungen ?? []).filter(
      m => m.wohnung_id === soll.wohnung_id && m.periode === periode
    );
    const highestStufe = periodeMahnungen.length
      ? Math.max(...periodeMahnungen.map(m => m.stufe))
      : 0;

    if (targetStufe <= highestStufe) { übersprungen++; continue; }

    const nextStufe = (highestStufe + 1) as 1 | 2 | 3;

    // Get active mieter
    const aktiverMV = wohnung.mietverhaeltnisse?.[0];
    const mieter = aktiverMV?.mieter;

    // Collect for batch insert
    mahnungenToInsert.push({
      verwalter_id: wohnung.liegenschaft.verwalter_id,
      wohnung_id: soll.wohnung_id!,
      mieter_id: aktiverMV?.mieter_id ?? null,
      stufe: nextStufe,
      offener_betrag: Number(soll.betrag),
      periode,
      versendet_at: new Date().toISOString(),
      auto_erstellt: true,
      status: "offen",
    });

    // Collect email for sending after batch insert
    if (mieter?.email) {
      emailsToSend.push({
        to: mieter.email,
        mieterName: `${mieter.vorname} ${mieter.nachname}`,
        wohnung: wohnung.bezeichnung,
        liegenschaft: wohnung.liegenschaft!.name,
        offenerBetrag: Number(soll.betrag),
        offeneMonate: [periode],
        mahnstufe: nextStufe,
      });
    }
  }

  // Batch insert all mahnungen at once
  if (mahnungenToInsert.length > 0) {
    const { error: batchErr } = await supabase
      .from("mahnungen")
      .insert(mahnungenToInsert);

    if (batchErr) {
      console.error("Mahnung batch insert error:", batchErr.message);
      await finishAutomationRun(supabase, run, "failed", {}, batchErr.message);
      return NextResponse.json({ error: batchErr.message }, { status: 500 });
    }

    erstellt = mahnungenToInsert.length;
  }

  // Send emails (still one-by-one, but after batch insert)
  for (const emailData of emailsToSend) {
    try {
      await sendMahnung(emailData);
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
    }
  }

  const summary = {
    message: `Mahnlauf abgeschlossen`,
    erstellt,
    übersprungen,
    timestamp: new Date().toISOString(),
  };

  await finishAutomationRun(supabase, run, "success", summary);
  return NextResponse.json(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Mahnlauf fehlgeschlagen";
    await finishAutomationRun(supabase, run, "failed", {}, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
