import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  NAVY, DARK, GRAY, LINE_GRAY, FILL_BG, LIGHT_BLUE, WHITE,
  PAGE_W, PAGE_H, ML, MR, BW,
  drawHR, txt, box, drawFooter, drawSeitennummer,
} from "@/lib/nebenkostenabrechnung/pdf-helpers";
import { formatCHF } from "@/lib/nebenkostenabrechnung/calc";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { abrechnung_id } = await req.json() as { abrechnung_id: string };
  if (!abrechnung_id) {
    return NextResponse.json({ error: "abrechnung_id erforderlich" }, { status: 400 });
  }

  // Load abrechnung
  const { data: abrechnung, error } = await supabase
    .from("nebenkostenabrechnungen")
    .select("*")
    .eq("id", abrechnung_id)
    .single();
  if (error || !abrechnung) {
    return NextResponse.json({ error: "Abrechnung nicht gefunden" }, { status: 404 });
  }

  // Load related data
  const [
    { data: positionen },
    { data: liegenschaft },
    { data: wohnung },
    { data: zaehler },
  ] = await Promise.all([
    supabase.from("nk_abrechnung_positionen").select("*").eq("abrechnung_id", abrechnung_id),
    supabase.from("liegenschaften").select("id, name, strasse, hausnummer, plz, ort").eq("id", abrechnung.liegenschaft_id).single(),
    supabase.from("wohnungen").select("id, bezeichnung, whg_nr, flaeche_m2").eq("id", abrechnung.wohnung_id).single(),
    supabase.from("nk_zaehler").select("*").eq("liegenschaft_id", abrechnung.liegenschaft_id),
  ]);

  // Load mieter
  const { data: mietverhaeltnisse } = await supabase
    .from("mietverhaeltnisse")
    .select("ist_hauptperson, mieter:mieter!inner(vorname, nachname)")
    .eq("wohnung_id", abrechnung.wohnung_id)
    .is("mietende", null);

  const mieterName = mietverhaeltnisse?.find((mv: any) => mv.ist_hauptperson)?.mieter
    ? `${mietverhaeltnisse.find((mv: any) => mv.ist_hauptperson).mieter.vorname} ${mietverhaeltnisse.find((mv: any) => mv.ist_hauptperson).mieter.nachname}`
    : "Mieter";

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 40;

  // Title
  txt(page, "Detailbeilage zur Nebenkostenabrechnung", ML, y, fontB, 14, NAVY);
  y -= 20;
  txt(page, `${liegenschaft?.name ?? ""} · Wohnung ${wohnung?.bezeichnung ?? "–"} · ${mieterName}`, ML, y, fontR, 9, GRAY);
  y -= 16;
  txt(page, `Abrechnungsperiode: ${new Date(abrechnung.periode_von ?? "").toLocaleDateString("de-CH")} – ${new Date(abrechnung.periode_bis ?? "").toLocaleDateString("de-CH")}`, ML, y, fontR, 9, GRAY);
  y -= 24;

  // Meter readings section (if any)
  const wohnungZaehler = (zaehler ?? []).filter((z: any) =>
    z.wohnung_id === abrechnung.wohnung_id || z.wohnung_id === null
  );

  if (wohnungZaehler.length > 0) {
    txt(page, "Zählerstände", ML, y, fontB, 11, NAVY);
    y -= 16;

    const zColW = [BW * 0.25, BW * 0.15, BW * 0.15, BW * 0.15, BW * 0.15, BW * 0.15];
    box(page, ML, y, BW, 14, LIGHT_BLUE);
    txt(page, "Bezeichnung", ML + 4, y - 5, fontB, 7.5, NAVY);
    txt(page, "Typ", ML + zColW[0], y - 5, fontB, 7.5, NAVY);
    txt(page, "Vorjahr", ML + zColW[0] + zColW[1], y - 5, fontB, 7.5, NAVY);
    txt(page, "Endjahr", ML + zColW[0] + zColW[1] + zColW[2], y - 5, fontB, 7.5, NAVY);
    txt(page, "Verbrauch", ML + zColW[0] + zColW[1] + zColW[2] + zColW[3], y - 5, fontB, 7.5, NAVY);
    txt(page, "Einheit", ML + zColW[0] + zColW[1] + zColW[2] + zColW[3] + zColW[4], y - 5, fontB, 7.5, NAVY);
    y -= 14;

    const zaehlerTypLabels: Record<string, string> = {
      heizung: "Heizung", warmwasser: "Warmwasser", wasser: "Wasser",
      abwasser: "Abwasser", strom: "Strom",
    };

    for (let i = 0; i < wohnungZaehler.length; i++) {
      const z = wohnungZaehler[i] as any;
      const bg = i % 2 === 0 ? FILL_BG : WHITE;
      box(page, ML, y, BW, 12, bg);

      const verbrauch = z.stand_endjahr && z.stand_vorjahr
        ? (Number(z.stand_endjahr) - Number(z.stand_vorjahr)) * Number(z.faktor ?? 1)
        : null;

      txt(page, z.bezeichnung, ML + 4, y - 3, fontR, 7.5, DARK);
      txt(page, zaehlerTypLabels[z.zaehler_typ] ?? z.zaehler_typ, ML + zColW[0], y - 3, fontR, 7.5, DARK);
      txt(page, z.stand_vorjahr ? Number(z.stand_vorjahr).toLocaleString("de-CH") : "–", ML + zColW[0] + zColW[1], y - 3, fontR, 7.5, DARK);
      txt(page, z.stand_endjahr ? Number(z.stand_endjahr).toLocaleString("de-CH") : "–", ML + zColW[0] + zColW[1] + zColW[2], y - 3, fontR, 7.5, DARK);
      txt(page, verbrauch !== null ? formatCHF(verbrauch) : "–", ML + zColW[0] + zColW[1] + zColW[2] + zColW[3], y - 3, fontR, 7.5, DARK);
      txt(page, z.einheit ?? "kWh", ML + zColW[0] + zColW[1] + zColW[2] + zColW[3] + zColW[4], y - 3, fontR, 7.5, GRAY);
      y -= 12;
    }
    y -= 16;
  }

  // Detailed position breakdown
  txt(page, "Detaillierte Kostenaufschlüsselung", ML, y, fontB, 11, NAVY);
  y -= 16;

  const VS_LABELS: Record<string, string> = {
    flaeche: "Fläche", kopf: "Kopf", gleich: "gleich", verbrauch: "Verbrauch", gemischt: "gemischt",
  };

  const pColW = [BW * 0.28, BW * 0.16, BW * 0.13, BW * 0.13, BW * 0.13, BW * 0.10, BW * 0.07];
  box(page, ML, y, BW, 14, LIGHT_BLUE);
  txt(page, "Bezeichnung", ML + 4, y - 5, fontB, 7, NAVY);
  txt(page, "Kategorie", ML + pColW[0], y - 5, fontB, 7, NAVY);
  txt(page, "Total CHF", ML + pColW[0] + pColW[1], y - 5, fontB, 7, NAVY);
  txt(page, "Anteil %", ML + pColW[0] + pColW[1] + pColW[2], y - 5, fontB, 7, NAVY);
  txt(page, "Ihr Anteil", ML + pColW[0] + pColW[1] + pColW[2] + pColW[3], y - 5, fontB, 7, NAVY);
  txt(page, "VS-Typ", ML + pColW[0] + pColW[1] + pColW[2] + pColW[3] + pColW[4], y - 5, fontB, 7, NAVY);
  txt(page, "Zähler", ML + pColW[0] + pColW[1] + pColW[2] + pColW[3] + pColW[4] + pColW[5], y - 5, fontB, 7, NAVY);
  y -= 14;

  for (let i = 0; i < (positionen ?? []).length; i++) {
    const p = positionen![i] as any;
    const bg = i % 2 === 0 ? FILL_BG : WHITE;
    box(page, ML, y, BW, 12, bg);

    const KAT_LABELS: Record<string, string> = {
      heizung: "Heizung", warmwasser: "Warmwasser", wasser_abwasser: "Wasser/Abw.",
      kehricht: "Kehricht", allgemeinstrom: "Strom", hauswart: "Hauswart",
      versicherung: "Versicherung", sonstiges: "Sonstiges",
    };

    txt(page, p.bezeichnung?.length > 24 ? p.bezeichnung.substring(0, 23) + "…" : p.bezeichnung, ML + 4, y - 3, fontR, 7, DARK);
    txt(page, KAT_LABELS[p.kategorie] ?? p.kategorie, ML + pColW[0], y - 3, fontR, 7, DARK);
    txt(page, formatCHF(Number(p.betrag_total || 0)), ML + pColW[0] + pColW[1], y - 3, fontR, 7, DARK);
    txt(page, Number(p.anteil_prozent || 0).toFixed(1) + "%", ML + pColW[0] + pColW[1] + pColW[2], y - 3, fontR, 7, DARK);
    txt(page, formatCHF(Number(p.betrag_anteil || 0)), ML + pColW[0] + pColW[1] + pColW[2] + pColW[3], y - 3, fontB, 7.5, DARK);
    txt(page, VS_LABELS[p.verteilschluessel_typ] ?? "Fläche", ML + pColW[0] + pColW[1] + pColW[2] + pColW[3] + pColW[4], y - 3, fontR, 7, GRAY);

    const zaehlerInfo = p.zaehlerstand_start && p.zaehlerstand_end
      ? `${Number(p.zaehlerstand_start).toLocaleString("de-CH")} → ${Number(p.zaehlerstand_end).toLocaleString("de-CH")}`
      : "–";
    txt(page, zaehlerInfo, ML + pColW[0] + pColW[1] + pColW[2] + pColW[3] + pColW[4] + pColW[5], y - 3, fontR, 6.5, GRAY);
    y -= 12;
  }

  // Footer
  drawFooter(page, `Detailbeilage · ${liegenschaft?.name ?? ""} · ${mieterName} · ${new Date().toLocaleDateString("de-CH")}`, fontR);

  const pdfBytes = await pdfDoc.save();

  try {
    await supabase.from("nk_abrechnung_dokumente").insert({
      abrechnung_id,
      dokument_typ: "detailbeilage",
      dateiname: `Detailbeilage_${abrechnung.jahr}_${wohnung?.bezeichnung ?? ""}_${mieterName.replace(/\s/g, "_")}.pdf`,
    });
  } catch {
    // Non-critical
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Detailbeilage_${abrechnung.jahr}_${wohnung?.bezeichnung ?? "Unbekannt"}.pdf"`,
    },
  });
}