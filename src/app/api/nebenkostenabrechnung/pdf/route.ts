import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  NAVY, DARK, GRAY, LINE_GRAY, FILL_BG, GREEN, RED, WHITE,
  PAGE_W, PAGE_H, ML, MR, BW,
  ADDR_X, ADDR_Y,
  drawHR, txt, box, drawWrappedText,
  drawKuvertfensterAdresse, drawAbsenderzeile,
  drawAbrechnungHeader, drawKostenTabelle,
  drawZusammenfassung, drawZahlungshinweis,
  drawRechtlicheHinweise, drawFooter, drawDatumszeile, drawSeitennummer,
} from "@/lib/nebenkostenabrechnung/pdf-helpers";
import { formatCHF } from "@/lib/nebenkostenabrechnung/calc";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { abrechnung_id } = await req.json();
  if (!abrechnung_id) {
    return NextResponse.json({ error: "abrechnung_id erforderlich" }, { status: 400 });
  }

  // Load abrechnung
  const { data: abrechnung, error: abrError } = await supabase
    .from("nebenkostenabrechnungen")
    .select("*")
    .eq("id", abrechnung_id)
    .single();
  if (abrError || !abrechnung) {
    return NextResponse.json({ error: "Abrechnung nicht gefunden" }, { status: 404 });
  }

  // Load related data in parallel
  const [
    { data: positionen },
    { data: liegenschaft },
    { data: wohnung },
    { data: profile },
    { data: bankkonto },
  ] = await Promise.all([
    supabase
      .from("nk_abrechnung_positionen")
      .select("*")
      .eq("abrechnung_id", abrechnung_id),
    supabase
      .from("liegenschaften")
      .select("id, name, strasse, hausnummer, plz, ort, kanton")
      .eq("id", abrechnung.liegenschaft_id)
      .single(),
    supabase
      .from("wohnungen")
      .select("id, bezeichnung, whg_nr, etage, flaeche_m2")
      .eq("id", abrechnung.wohnung_id)
      .single(),
    supabase
      .from("profiles")
      .select("full_name, firma, adresse, plz, ort")
      .eq("id", abrechnung.verwalter_id ?? user.id)
      .single(),
    abrechnung.bankkonto_id
      ? supabase.from("bankkonten").select("id, iban, qr_iban, bank_name").eq("id", abrechnung.bankkonto_id).single()
      : Promise.resolve({ data: null }),
  ]);

  // Load mieter for this wohnung
  const { data: mietverhaeltnisse } = await supabase
    .from("mietverhaeltnisse")
    .select("ist_hauptperson, mieter:mieter!inner(vorname, nachname, strasse, plz, ort)")
    .eq("wohnung_id", abrechnung.wohnung_id)
    .is("mietende", null);

  const hauptMieterData = mietverhaeltnisse?.find((mv: any) => mv.ist_hauptperson) ?? mietverhaeltnisse?.[0];
  const hauptMieter = hauptMieterData ? (Array.isArray(hauptMieterData.mieter) ? hauptMieterData.mieter[0] : hauptMieterData.mieter) : null;
  const mieterName = hauptMieter ? `${hauptMieter.vorname} ${hauptMieter.nachname}` : "Mieter";
  const mieterAdressLines = hauptMieter
    ? [hauptMieter.strasse, `${hauptMieter.plz} ${hauptMieter.ort}`]
    : ["Adresse unbekannt"];

  // Verwalter info
  const verwalterName = profile?.firma ?? profile?.full_name ?? "Verwaltung";
  const absenderLine = [verwalterName, profile?.adresse, profile?.plz && profile?.ort ? `${profile.plz} ${profile.ort}` : ""]
    .filter(Boolean)
    .join(" · ");

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Abrechnung
  const p1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = drawAbrechnungHeader(
    p1,
    liegenschaft ?? { name: "", strasse: "", hausnummer: "", plz: "", ort: "" },
    abrechnung.jahr,
    abrechnung.periode_von ?? "",
    abrechnung.periode_bis ?? "",
    fontB,
    fontR
  );

  // Absenderzeile above address window
  drawAbsenderzeile(p1, absenderLine, fontR);

  // Address window
  drawKuvertfensterAdresse(p1, mieterName, mieterAdressLines, fontB, fontR);

  // Date line
  y = drawDatumszeile(p1, fontR, fontB, y);

  // Subject
  txt(p1, `Nebenkostenabrechnung ${abrechnung.jahr}`, ML, y, fontB, 11, NAVY);
  y -= 8;
  txt(p1, `Wohnung: ${wohnung?.bezeichnung ?? "–"}`, ML, y, fontR, 8.5, GRAY);
  y -= 20;

  // Cost table
  y = drawKostenTabelle(
    p1,
    (positionen ?? []).map((p: any) => ({
      bezeichnung: p.bezeichnung,
      kategorie: p.kategorie,
      betrag_total: Number(p.betrag_total || 0),
      anteil_prozent: Number(p.anteil_prozent || 0),
      betrag_anteil: Number(p.betrag_anteil || 0),
      verteilschluessel_typ: p.verteilschluessel_typ ?? "flaeche",
      umlagefaehig: true,
    })),
    y,
    fontR,
    fontB
  );

  // Summary
  y = drawZusammenfassung(
    p1,
    Number(abrechnung.kosten_total || 0),
    Number(abrechnung.akonto_total || 0),
    Number(abrechnung.differenz ?? 0),
    y,
    fontR,
    fontB
  );

  // Payment instructions
  y = drawZahlungshinweis(
    p1,
    bankkonto ? { iban: bankkonto.iban, bank_name: bankkonto.bank_name } : null,
    abrechnung.zahlungsfrist ? new Date(abrechnung.zahlungsfrist).toLocaleDateString("de-CH") : "–",
    Number(abrechnung.differenz ?? 0),
    y,
    fontR,
    fontB
  );

  // Legal notices
  y = drawRechtlicheHinweise(
    p1,
    abrechnung.periode_von ?? "",
    abrechnung.periode_bis ?? "",
    y,
    fontR,
    fontB
  );

  // Footer
  drawFooter(p1, `Nebenkostenabrechnung ${abrechnung.jahr} · ${liegenschaft?.name ?? ""} · ${mieterName} · Erstellt ${new Date().toLocaleDateString("de-CH")}`, fontR);
  drawSeitennummer(p1, 1, 1, fontR);

  const pdfBytes = await pdfDoc.save();

  // Track document
  const dateiname = `NK_Abrechnung_${abrechnung.jahr}_${wohnung?.bezeichnung ?? "Unbekannt"}_${mieterName.replace(/\s/g, "_")}.pdf`;
  try {
    await supabase.from("nk_abrechnung_dokumente").insert({
      abrechnung_id,
      dokument_typ: "abrechnung",
      dateiname,
    });
  } catch {
    // Document tracking is non-critical
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dateiname}"`,
    },
  });
}