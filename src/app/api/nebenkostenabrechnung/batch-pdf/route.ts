import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  NAVY, DARK, GRAY, WHITE,
  PAGE_W, PAGE_H, ML, MR, BW,
  drawHR, txt, box,
  drawAbrechnungHeader, drawKostenTabelle,
  drawZusammenfassung, drawZahlungshinweis,
  drawRechtlicheHinweise, drawFooter,
} from "@/lib/nebenkostenabrechnung/pdf-helpers";
import { formatCHF } from "@/lib/nebenkostenabrechnung/calc";
import { generiereBegleitschreiben, buildPlatzhalter, DEFAULT_ABSNDER } from "@/lib/nebenkostenabrechnung/templates";
import type { BegleitschreibenTon } from "@/lib/nebenkostenabrechnung/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { liegenschaft_id, jahr, ton } = await req.json() as {
    liegenschaft_id: string;
    jahr: number;
    ton?: BegleitschreibenTon;
  };

  if (!liegenschaft_id || !jahr) {
    return NextResponse.json({ error: "liegenschaft_id und jahr erforderlich" }, { status: 400 });
  }

  const begleitschreibenTon: BegleitschreibenTon = ton ?? "neutral";

  // Load all abrechnungen for this property/year
  const { data: abrechnungen, error: abrError } = await supabase
    .from("nebenkostenabrechnungen")
    .select("*")
    .eq("liegenschaft_id", liegenschaft_id)
    .eq("jahr", jahr);

  if (abrError || !abrechnungen || abrechnungen.length === 0) {
    return NextResponse.json({ error: "Keine Abrechnungen gefunden" }, { status: 404 });
  }

  // Load liegenschaft
  const { data: liegenschaft } = await supabase
    .from("liegenschaften")
    .select("id, name, strasse, hausnummer, plz, ort")
    .eq("id", liegenschaft_id)
    .single();

  // Load profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, firma, adresse, plz, ort")
    .eq("id", user.id)
    .single();

  const verwalterName = profile?.firma ?? profile?.full_name ?? DEFAULT_ABSNDER.name;

  // Generate individual PDFs for each tenant and merge
  const batchDoc = await PDFDocument.create();
  const fontR = await batchDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await batchDoc.embedFont(StandardFonts.HelveticaBold);

  let totalPages = 0;

  for (const abrechnung of abrechnungen) {
    // Load positionen
    const { data: positionen } = await supabase
      .from("nk_abrechnung_positionen")
      .select("*")
      .eq("abrechnung_id", abrechnung.id);

    // Load wohnung
    const { data: wohnung } = await supabase
      .from("wohnungen")
      .select("id, bezeichnung, whg_nr")
      .eq("id", abrechnung.wohnung_id)
      .single();

    // Load mieter
    const { data: mietverhaeltnisse } = await supabase
      .from("mietverhaeltnisse")
      .select("ist_hauptperson, mieter:mieter!inner(vorname, nachname, strasse, plz, ort)")
      .eq("wohnung_id", abrechnung.wohnung_id)
      .is("mietende", null);

    const hauptMieterData = mietverhaeltnisse?.find((mv: any) => mv.ist_hauptperson) ?? mietverhaeltnisse?.[0];
    const hauptMieter = hauptMieterData ? (Array.isArray(hauptMieterData.mieter) ? hauptMieterData.mieter[0] : hauptMieterData.mieter) : null;
    const mieterName = hauptMieter ? `${hauptMieter.vorname} ${hauptMieter.nachname}` : "Mieter";

    // Load bankkonto
    let bankkonto: { iban: string; bank_name: string; qr_iban?: string } | null = null;
    if (abrechnung.bankkonto_id) {
      const { data: bk } = await supabase.from("bankkonten").select("id, iban, qr_iban, bank_name").eq("id", abrechnung.bankkonto_id).single();
      bankkonto = bk ? { iban: bk.iban, bank_name: bk.bank_name, qr_iban: bk.qr_iban } : null;
    }

    // Separator page between tenants (except first)
    if (totalPages > 0) {
      const sepPage = batchDoc.addPage([PAGE_W, PAGE_H]);
      sepPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.95, 0.95, 0.97) });
      txt(sepPage, "— Trennseite —", PAGE_W / 2 - 40, PAGE_H / 2, fontB, 14, GRAY);
      txt(sepPage, mieterName, PAGE_W / 2 - 50, PAGE_H / 2 - 25, fontR, 11, DARK);
      txt(sepPage, wohnung?.bezeichnung ?? "", PAGE_W / 2 - 30, PAGE_H / 2 - 42, fontR, 9, GRAY);
      totalPages++;
    }

    // Abrechnung page
    const page = batchDoc.addPage([PAGE_W, PAGE_H]);
    let y = drawAbrechnungHeader(
      page,
      liegenschaft ?? { name: "", strasse: "", hausnummer: "", plz: "", ort: "" },
      jahr,
      abrechnung.periode_von ?? "",
      abrechnung.periode_bis ?? "",
      fontB,
      fontR
    );

    txt(page, mieterName, ML, y, fontB, 11, DARK);
    y -= 16;

    y = drawKostenTabelle(
      page,
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

    y = drawZusammenfassung(
      page,
      Number(abrechnung.kosten_total || 0),
      Number(abrechnung.akonto_total || 0),
      Number(abrechnung.differenz ?? 0),
      y,
      fontR,
      fontB
    );

    y = drawZahlungshinweis(
      page,
      bankkonto ? { iban: bankkonto.iban, bank_name: bankkonto.bank_name } : null,
      abrechnung.zahlungsfrist ? new Date(abrechnung.zahlungsfrist).toLocaleDateString("de-CH") : "–",
      Number(abrechnung.differenz ?? 0),
      y,
      fontR,
      fontB
    );

    y = drawRechtlicheHinweise(page, abrechnung.periode_von ?? "", abrechnung.periode_bis ?? "", y, fontR, fontB);

    drawFooter(page, `Nebenkostenabrechnung ${jahr} · ${liegenschaft?.name ?? ""} · ${mieterName}`, fontR);
    totalPages++;

    // Track batch document
    const dateiname = `NK_Abrechnung_${jahr}_${wohnung?.bezeichnung ?? ""}_${mieterName.replace(/\s/g, "_")}.pdf`;
    try {
      await supabase.from("nk_abrechnung_dokumente").insert({
        abrechnung_id: abrechnung.id,
        dokument_typ: "batch_pdf",
        dateiname,
      });
    } catch {
      // Non-critical
    }
  }

  const pdfBytes = await batchDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="NK_Abrechnungen_${jahr}_${liegenschaft?.name?.replace(/\s/g, "_") ?? "Sammel"}.pdf"`,
    },
  });
}

function rgb(r: number, g: number, b: number) {
  return { r: r / 255, g: g / 255, b: b / 255 }; // approximate for separator
}