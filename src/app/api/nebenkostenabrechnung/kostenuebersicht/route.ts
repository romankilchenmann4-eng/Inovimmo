import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  NAVY, DARK, GRAY, LINE_GRAY, FILL_BG, GREEN, RED, WHITE, LIGHT_BLUE,
  PAGE_W, PAGE_H, ML, MR, BW,
  drawHR, txt, box, drawAbrechnungHeader, drawFooter, drawSeitennummer,
} from "@/lib/nebenkostenabrechnung/pdf-helpers";
import { formatCHF } from "@/lib/nebenkostenabrechnung/calc";

export const dynamic = "force-dynamic";

const KATEGORIE_LABELS: Record<string, string> = {
  heizung: "Heizung",
  warmwasser: "Warmwasser",
  wasser_abwasser: "Wasser/Abwasser",
  kehricht: "Kehricht",
  allgemeinstrom: "Allgemeinstrom",
  hauswart: "Hauswart",
  versicherung: "Versicherung",
  sonstiges: "Sonstiges",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { liegenschaft_id, jahr } = await req.json() as { liegenschaft_id: string; jahr: number };
  if (!liegenschaft_id || !jahr) {
    return NextResponse.json({ error: "liegenschaft_id und jahr erforderlich" }, { status: 400 });
  }

  // Load data
  const [{ data: positionen }, { data: liegenschaft }, { data: abrechnungen }, { data: profile }] = await Promise.all([
    supabase.from("nebenkostenpositionen").select("*").eq("liegenschaft_id", liegenschaft_id).eq("jahr", jahr),
    supabase.from("liegenschaften").select("id, name, strasse, hausnummer, plz, ort").eq("id", liegenschaft_id).single(),
    supabase.from("nebenkostenabrechnungen").select("id, wohnung_id, kosten_total, akonto_total, differenz, status").eq("liegenschaft_id", liegenschaft_id).eq("jahr", jahr),
    supabase.from("profiles").select("full_name, firma, adresse, plz, ort").eq("id", user.id).single(),
  ]) as any[];

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  // Header
  page.drawRectangle({ x: 0, y: y - 80, width: PAGE_W, height: 80, color: NAVY });
  txt(page, "KOSTENÜBERSICHT", ML, y - 30, fontB, 9, WHITE);
  txt(page, liegenschaft?.name ?? "", ML, y - 50, fontB, 18, WHITE);
  txt(page, `Jahr ${jahr}`, ML, y - 68, fontR, 9, rgb(0.75, 0.82, 0.95));
  y -= 95;

  // Category totals table
  txt(page, "Kosten nach Kategorie", ML, y, fontB, 11, NAVY);
  y -= 18;

  const catColW = [BW * 0.4, BW * 0.3, BW * 0.3];
  box(page, ML, y, BW, 14, LIGHT_BLUE);
  txt(page, "Kategorie", ML + 6, y - 4, fontB, 8, NAVY);
  txt(page, "Total CHF", ML + catColW[0], y - 4, fontB, 8, NAVY);
  txt(page, "Anteil %", ML + catColW[0] + catColW[1], y - 4, fontB, 8, NAVY);
  y -= 14;

  const totalBetrag = (positionen ?? []).reduce((s: number, p: any) => s + Number(p.betrag_total || 0), 0);

  const kategorienMap = new Map<string, number>();
  for (const p of positionen ?? []) {
    const kat = p.kategorie ?? "sonstiges";
    kategorienMap.set(kat, (kategorienMap.get(kat) ?? 0) + Number(p.betrag_total || 0));
  }

  let idx = 0;
  for (const [kat, betrag] of kategorienMap) {
    const bg = idx % 2 === 0 ? FILL_BG : WHITE;
    box(page, ML, y, BW, 12, bg);
    txt(page, KATEGORIE_LABELS[kat] ?? kat, ML + 6, y - 3, fontR, 8, DARK);
    txt(page, formatCHF(betrag), ML + catColW[0], y - 3, fontR, 8, DARK);
    const pct = totalBetrag > 0 ? (betrag / totalBetrag * 100).toFixed(1) : "0.0";
    txt(page, `${pct}%`, ML + catColW[0] + catColW[1], y - 3, fontR, 8, GRAY);
    y -= 12;
    idx++;
  }

  // Total
  box(page, ML, y, BW, 14, rgb(0.9, 0.93, 0.98));
  txt(page, "Total", ML + 6, y - 4, fontB, 8.5, NAVY);
  txt(page, formatCHF(totalBetrag), ML + catColW[0], y - 4, fontB, 8.5, NAVY);
  y -= 24;

  // Per-apartment summary
  txt(page, "Abrechnungen pro Wohnung", ML, y, fontB, 11, NAVY);
  y -= 18;

  const aptColW = [BW * 0.3, BW * 0.2, BW * 0.2, BW * 0.15, BW * 0.15];
  box(page, ML, y, BW, 14, LIGHT_BLUE);
  txt(page, "Wohnung", ML + 4, y - 4, fontB, 7.5, NAVY);
  txt(page, "Kosten", ML + aptColW[0], y - 4, fontB, 7.5, NAVY);
  txt(page, "Akonto", ML + aptColW[0] + aptColW[1], y - 4, fontB, 7.5, NAVY);
  txt(page, "Saldo", ML + aptColW[0] + aptColW[1] + aptColW[2], y - 4, fontB, 7.5, NAVY);
  txt(page, "Status", ML + aptColW[0] + aptColW[1] + aptColW[2] + aptColW[3], y - 4, fontB, 7.5, NAVY);
  y -= 14;

  // Load wohnung names for abrechnungen
  const wohnungIds = (abrechnungen ?? []).map((a: any) => a.wohnung_id);
  const { data: wohnungen } = await supabase
    .from("wohnungen")
    .select("id, bezeichnung")
    .in("id", wohnungIds);

  const wohnungMap = new Map((wohnungen ?? []).map((w: any) => [w.id, w.bezeichnung]));

  for (let i = 0; i < (abrechnungen ?? []).length; i++) {
    const a = abrechnungen![i];
    const bg = i % 2 === 0 ? FILL_BG : WHITE;
    box(page, ML, y, BW, 12, bg);

    const saldo = Number(a.differenz ?? 0);
    const saldoColor = saldo >= 0 ? GREEN : RED;
    const statusLabels: Record<string, string> = {
      entwurf: "Entwurf", berechnet: "Berechnet", versendet: "Versendet",
      teilweise_bezahlt: "Teilw.", bezahlt: "Bezahlt", angefochten: "Angefochten",
    };

    txt(page, wohnungMap.get(a.wohnung_id) ?? "–", ML + 4, y - 3, fontR, 7.5, DARK);
    txt(page, formatCHF(Number(a.kosten_total || 0)), ML + aptColW[0], y - 3, fontR, 7.5, DARK);
    txt(page, formatCHF(Number(a.akonto_total || 0)), ML + aptColW[0] + aptColW[1], y - 3, fontR, 7.5, DARK);
    txt(page, `${saldo >= 0 ? "+" : ""}${formatCHF(saldo)}`, ML + aptColW[0] + aptColW[1] + aptColW[2], y - 3, fontB, 7.5, saldoColor);
    txt(page, statusLabels[a.status] ?? a.status, ML + aptColW[0] + aptColW[1] + aptColW[2] + aptColW[3], y - 3, fontR, 7.5, GRAY);
    y -= 12;
  }

  // Footer
  drawFooter(page, `Kostenübersicht ${jahr} · ${liegenschaft?.name ?? ""} · Erstellt ${new Date().toLocaleDateString("de-CH")}`, fontR);

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Kostenuebersicht_${jahr}_${liegenschaft?.name?.replace(/\s/g, "_") ?? "Liegenschaft"}.pdf"`,
    },
  });
}