import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  NAVY, DARK, GRAY, LINE_GRAY, FILL_BG,
  PAGE_W, PAGE_H, ML, MR, BW,
  ADDR_X, ADDR_Y,
  drawHR, txt, box, drawWrappedText,
  drawKuvertfensterAdresse, drawAbsenderzeile,
  drawFooter, drawSeitennummer,
} from "@/lib/nebenkostenabrechnung/pdf-helpers";
import { generiereBegleitschreiben, buildPlatzhalter, DEFAULT_ABSNDER } from "@/lib/nebenkostenabrechnung/templates";
import type { BegleitschreibenTon } from "@/lib/nebenkostenabrechnung/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { abrechnung_id, ton } = await req.json() as { abrechnung_id: string; ton?: BegleitschreibenTon };
  if (!abrechnung_id) {
    return NextResponse.json({ error: "abrechnung_id erforderlich" }, { status: 400 });
  }

  const begleitschreibenTon: BegleitschreibenTon = ton ?? "neutral";

  // Load abrechnung
  const { data: abrechnung, error: abrError } = await supabase
    .from("nebenkostenabrechnungen")
    .select("*")
    .eq("id", abrechnung_id)
    .single();
  if (abrError || !abrechnung) {
    return NextResponse.json({ error: "Abrechnung nicht gefunden" }, { status: 404 });
  }

  // Load related data
  const [
    { data: liegenschaft },
    { data: wohnung },
    { data: profile },
    { data: bankkonto },
  ] = await Promise.all([
    supabase.from("liegenschaften").select("id, name, strasse, hausnummer, plz, ort").eq("id", abrechnung.liegenschaft_id).single(),
    supabase.from("wohnungen").select("id, bezeichnung, whg_nr").eq("id", abrechnung.wohnung_id).single(),
    supabase.from("profiles").select("full_name, firma, adresse, plz, ort").eq("id", abrechnung.verwalter_id ?? user.id).single(),
    abrechnung.bankkonto_id
      ? supabase.from("bankkonten").select("id, iban, qr_iban, bank_name").eq("id", abrechnung.bankkonto_id).single()
      : Promise.resolve({ data: null }),
  ]);

  // Load mieter
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

  const verwalterName = profile?.firma ?? profile?.full_name ?? DEFAULT_ABSNDER.name;
  const absenderLine = [verwalterName, profile?.adresse ?? DEFAULT_ABSNDER.strasse, `${profile?.plz ?? DEFAULT_ABSNDER.plz} ${profile?.ort ?? DEFAULT_ABSNDER.ort}`]
    .filter(Boolean)
    .join(" · ");

  // Build placeholder data
  const platzhalter = buildPlatzhalter({
    mieter_namen: mieterName,
    mieter_adresse: mieterAdressLines.join("\n"),
    wohnung_bezeichnung: wohnung?.bezeichnung ?? "–",
    liegenschaft_name: liegenschaft?.name ?? "",
    liegenschaft_strasse: liegenschaft?.strasse,
    liegenschaft_hausnummer: liegenschaft?.hausnummer,
    liegenschaft_plz: liegenschaft?.plz,
    liegenschaft_ort: liegenschaft?.ort,
    periode_von: abrechnung.periode_von ?? "",
    periode_bis: abrechnung.periode_bis ?? "",
    kosten_total: Number(abrechnung.kosten_total || 0),
    akonto_total: Number(abrechnung.akonto_total || 0),
    saldo: Number(abrechnung.differenz ?? 0),
    saldo_gerundet: Math.abs(Number(abrechnung.differenz ?? 0)),
    saldo_typ: Number(abrechnung.differenz ?? 0) >= 0 ? "Guthaben" : "Nachzahlung",
    zahlungsfrist: abrechnung.zahlungsfrist ?? "",
    bank_iban: bankkonto?.iban,
    bank_name: bankkonto?.bank_name,
    verwalter_name: verwalterName,
    verwalter_adresse: `${verwalterName}\n${profile?.adresse ?? DEFAULT_ABSNDER.strasse}\n${profile?.plz ?? DEFAULT_ABSNDER.plz} ${profile?.ort ?? DEFAULT_ABSNDER.ort}`,
  });

  // Generate cover letter text
  const briefText = generiereBegleitschreiben(begleitschreibenTon, platzhalter);

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 20;

  // Absenderzeile
  drawAbsenderzeile(page, absenderLine, fontR);

  // Address window
  drawKuvertfensterAdresse(page, mieterName, mieterAdressLines, fontB, fontR);

  // Date (right-aligned)
  y = ADDR_Y - 20;
  const datumStr = `Oetwil an der Limmat, ${new Date().toLocaleDateString("de-CH")}`;
  const datumW = fontR.widthOfTextAtSize(datumStr, 9);
  txt(page, datumStr, MR - datumW, y, fontR, 9, DARK);
  y -= 30;

  // Subject line
  txt(page, platzhalter.liegenschaft_adresse ? `${platzhalter.liegenschaft_adresse}` : "", ML, y, fontR, 8, GRAY);
  y -= 20;

  // Render cover letter text
  const lines = briefText.split("\n");
  for (const line of lines) {
    if (y < 80) {
      drawFooter(page, `Begleitschreiben · ${platzhalter.liegenschaft_name} · ${mieterName}`, fontR);
      const newPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 40;
    }
    y = drawWrappedText(page, line, ML, y, BW, fontR, 9.5, 14, DARK);
  }

  // Signature area
  y -= 30;
  txt(page, verwalterName, ML, y, fontB, 10, DARK);
  y -= 14;
  txt(page, profile?.firma ?? "", ML, y, fontR, 9, GRAY);

  // Footer
  drawFooter(page, `Begleitschreiben Nebenkostenabrechnung ${abrechnung.jahr} · ${liegenschaft?.name ?? ""} · ${mieterName}`, fontR);

  const pdfBytes = await pdfDoc.save();

  const dateiname = `Begleitschreiben_${begleitschreibenTon}_${abrechnung.jahr}_${wohnung?.bezeichnung ?? "Unbekannt"}_${mieterName.replace(/\s/g, "_")}.pdf`;
  try {
    await supabase.from("nk_abrechnung_dokumente").insert({
      abrechnung_id,
      dokument_typ: "begleitschreiben",
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