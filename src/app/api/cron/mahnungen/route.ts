import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendMahnung } from "@/lib/email";

export const dynamic = "force-dynamic";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function checkAuth(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return token === secret;
}

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
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();
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
    return NextResponse.json({ error: sollErr.message }, { status: 500 });
  }

  if (!sollBuchungen?.length) {
    return NextResponse.json({ message: "Keine überfälligen Sollbuchungen", verarbeitet: 0 });
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

    // Check if payment exists for this wohnung+periode
    const bezahlt = (zahlungen ?? []).some(
      z =>
        z.wohnung_id === soll.wohnung_id &&
        z.periode_monat === soll.periode_monat &&
        z.periode_jahr === soll.periode_jahr
    );
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

    // Create mahnung
    const { error: insertErr } = await supabase.from("mahnungen").insert({
      verwalter_id: wohnung.liegenschaft.verwalter_id,
      wohnung_id: soll.wohnung_id,
      mieter_id: aktiverMV?.mieter_id ?? null,
      stufe: nextStufe,
      offener_betrag: Number(soll.betrag),
      periode,
      versendet_at: new Date().toISOString(),
      auto_erstellt: true,
      status: "offen",
    });

    if (insertErr) {
      console.error("Mahnung insert error:", insertErr.message);
      übersprungen++;
      continue;
    }

    // Send email to mieter
    if (mieter?.email) {
      try {
        await sendMahnung({
          to: mieter.email,
          mieterName: `${mieter.vorname} ${mieter.nachname}`,
          wohnung: wohnung.bezeichnung,
          liegenschaft: wohnung.liegenschaft.name,
          offenerBetrag: Number(soll.betrag),
          offeneMonate: [periode],
          mahnstufe: nextStufe,
        });
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    }

    erstellt++;
  }

  return NextResponse.json({
    message: `Mahnlauf abgeschlossen`,
    erstellt,
    übersprungen,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();
  const { count: offeneMahnungen } = await supabase
    .from("mahnungen")
    .select("id", { count: "exact", head: true })
    .eq("status", "offen");

  const { count: autoErstellt } = await supabase
    .from("mahnungen")
    .select("id", { count: "exact", head: true })
    .eq("auto_erstellt", true)
    .eq("status", "offen");

  return NextResponse.json({
    offene_mahnungen: offeneMahnungen ?? 0,
    davon_automatisch: autoErstellt ?? 0,
    timestamp: new Date().toISOString(),
  });
}
