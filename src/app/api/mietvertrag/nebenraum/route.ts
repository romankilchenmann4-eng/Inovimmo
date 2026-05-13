import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";

export interface MietvertragNebenraumInput {
  vermieter_name: string;
  vermieter_adresse?: string;
  mieter_namen: string[];
  liegenschaft_strasse: string;
  liegenschaft_plz_ort: string;
  raumbezeichnung: string;   // z.B. "Bastelraum", "Hobbyraum"
  raum_nr?: string;
  stockwerk?: string;
  flaeche_m2?: number;
  mietbeginn: string;
  kuendigungsfrist_monate: number;
  kuendigungstermine: string;
  mindestdauer_bis?: string;
  mietzins_monat: number;
  besondere_vereinbarungen?: string;
  ort_datum_vermieter: string;
  ort_datum_mieter: string;
}

const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0, 0, 0);
const DARK = rgb(0.1, 0.1, 0.1);
const NAVY = rgb(0.08, 0.18, 0.35);
const LINE_GRAY = rgb(0.75, 0.75, 0.75);
const FILL_BG = rgb(0.95, 0.97, 1.0);
const LIGHT = rgb(0.97, 0.97, 0.97);

function chf(n?: number): string {
  if (!n) return "";
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2 });
}

function drawLine(page: PDFPage, x1: number, y: number, x2: number, thickness = 0.5, color = LINE_GRAY) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function drawBox(page: PDFPage, x: number, y: number, w: number, h: number, fill = FILL_BG) {
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: fill, borderColor: LINE_GRAY, borderWidth: 0.5 });
}

function lbl(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 8, color = GRAY) {
  page.drawText(text, { x, y, size, font, color });
}

function val(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9.5, color = DARK) {
  page.drawText(text, { x, y, size, font, color });
}

// Wraps text at maxWidth, returns array of lines
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    const w = font.widthOfTextAtSize(test, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number, lineH: number, color = DARK): number {
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, i) => {
    page.drawText(line, { x, y: y - i * lineH, size, font, color });
  });
  return lines.length * lineH;
}

function sectionHeading(page: PDFPage, nr: string, title: string, x: number, y: number, fontB: PDFFont, fontR: PDFFont): number {
  page.drawText(`${nr}  ${title}`, { x, y, size: 8.5, font: fontB, color: NAVY });
  return 13;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const d: MietvertragNebenraumInput = await req.json();

  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595;
  const ML = 30;
  const MR = W - 30;
  const BW = MR - ML;

  // ═══════════════════════════════════════════════════════
  // SEITE 1 — Formular
  // ═══════════════════════════════════════════════════════
  const p1 = pdfDoc.addPage([W, 842]);
  let y = 820;

  // Header
  p1.drawRectangle({ x: ML, y: y - 40, width: 70, height: 40, color: NAVY });
  p1.drawText("HEV", { x: ML + 8, y: y - 20, size: 14, font: fontB, color: rgb(1,1,1) });
  p1.drawText("Schweiz", { x: ML + 8, y: y - 33, size: 9, font: fontR, color: rgb(0.8,0.9,1) });

  p1.drawText("Zusatzvereinbarung Nebenräume", { x: 110, y: y - 12, size: 15, font: fontB, color: NAVY });
  p1.drawText("zum Mietvertrag / à compléter au contrat de bail / al contratto di locazione", { x: 110, y: y - 24, size: 7.5, font: fontR, color: GRAY });
  p1.drawText("Ausgabe 2025  ·  HEV Schweiz", { x: 110, y: y - 34, size: 7, font: fontR, color: GRAY });

  y -= 52;
  drawLine(p1, ML, y, MR, 1, NAVY);
  y -= 14;

  // Intro text
  p1.drawText("Die Unterzeichnenden schliessen folgenden Mietvertrag für Nebenräume:", { x: ML, y, size: 8.5, font: fontR, color: DARK });
  y -= 18;

  // Vermieter row
  drawBox(p1, ML, y, BW, 17);
  lbl(p1, "Vermieter:", ML + 4, y - 5, fontR, 8);
  val(p1, d.vermieter_name, ML + 58, y - 5, fontB, 9.5);
  if (d.vermieter_adresse) lbl(p1, d.vermieter_adresse, ML + 58 + fontB.widthOfTextAtSize(d.vermieter_name, 9.5) + 8, y - 5, fontR, 8);
  y -= 17;

  // Mieter row
  const mieterH = Math.max(17, d.mieter_namen.length * 13 + 6);
  drawBox(p1, ML, y, BW, mieterH);
  lbl(p1, "Mieter:", ML + 4, y - 5, fontR, 8);
  d.mieter_namen.forEach((m, i) => {
    val(p1, m, ML + 58, y - 5 - i * 13, i === 0 ? fontB : fontR, 9.5);
  });
  if (d.mieter_namen.length > 1) {
    lbl(p1, "(Solidarhaftung)", ML + 58, y - mieterH + 3, fontR, 7, GRAY);
  }
  y -= mieterH;

  // Liegenschaft row
  drawBox(p1, ML, y, BW, 17);
  lbl(p1, "Liegenschaft:", ML + 4, y - 5, fontR, 8);
  val(p1, `${d.liegenschaft_strasse}, ${d.liegenschaft_plz_ort}`, ML + 68, y - 5, fontB, 9.5);
  y -= 17;

  y -= 6;

  // Mietobjekt Box
  drawBox(p1, ML, y, BW, 13, NAVY);
  p1.drawText("Mietobjekt", { x: ML + 4, y: y - 9, size: 8.5, font: fontB, color: rgb(1,1,1) });
  y -= 13;

  // Raumbezeichnung / Raum-Nr. / Stockwerk
  drawBox(p1, ML, y, BW * 0.55, 17);
  lbl(p1, "Bezeichnung des Nebenraumes:", ML + 4, y - 5, fontR, 8);
  val(p1, d.raumbezeichnung, ML + 148, y - 5, fontB, 9.5);

  drawBox(p1, ML + BW * 0.55, y, BW * 0.22, 17);
  lbl(p1, "Raum-Nr.:", ML + BW * 0.55 + 4, y - 5, fontR, 8);
  val(p1, d.raum_nr ?? "–", ML + BW * 0.55 + 48, y - 5, fontB, 9.5);

  drawBox(p1, ML + BW * 0.77, y, BW * 0.23, 17);
  lbl(p1, "Stockwerk:", ML + BW * 0.77 + 4, y - 5, fontR, 8);
  val(p1, d.stockwerk ?? "–", ML + BW * 0.77 + 50, y - 5, fontB, 9.5);
  y -= 17;

  // Fläche row
  drawBox(p1, ML, y, BW, 17);
  lbl(p1, "Fläche:", ML + 4, y - 5, fontR, 8);
  val(p1, d.flaeche_m2 ? `${d.flaeche_m2} m²` : "–", ML + 40, y - 5, fontB, 9.5);
  lbl(p1, "(Angabe fakultativ, nicht massgebend für Mietzins)", ML + 120, y - 5, fontR, 7, GRAY);
  y -= 17;

  y -= 6;

  // Vertragsdaten Box
  drawBox(p1, ML, y, BW, 13, NAVY);
  p1.drawText("Vertragsdaten", { x: ML + 4, y: y - 9, size: 8.5, font: fontB, color: rgb(1,1,1) });
  y -= 13;

  // Mietbeginn
  drawBox(p1, ML, y, BW * 0.5, 17);
  lbl(p1, "Mietbeginn:", ML + 4, y - 5, fontR, 8);
  val(p1, d.mietbeginn, ML + 56, y - 5, fontB, 9.5);

  if (d.mindestdauer_bis) {
    drawBox(p1, ML + BW * 0.5, y, BW * 0.5, 17);
    lbl(p1, "Mindestdauer bis:", ML + BW * 0.5 + 4, y - 5, fontR, 8);
    val(p1, d.mindestdauer_bis, ML + BW * 0.5 + 85, y - 5, fontB, 9.5);
  } else {
    drawBox(p1, ML + BW * 0.5, y, BW * 0.5, 17, LIGHT);
    lbl(p1, "Mindestdauer bis: –", ML + BW * 0.5 + 4, y - 5, fontR, 8, GRAY);
  }
  y -= 17;

  // Kündigung
  drawBox(p1, ML, y, BW, 17);
  lbl(p1, "Kündigung:", ML + 4, y - 5, fontR, 8);
  lbl(p1, `${d.kuendigungsfrist_monate}-monatlich im Voraus auf:`, ML + 50, y - 5, fontR, 8.5, DARK);
  val(p1, d.kuendigungstermine, ML + 175, y - 5, fontB, 9);
  y -= 17;

  y -= 6;

  // Mietzins Box
  drawBox(p1, ML, y, BW, 13, NAVY);
  p1.drawText("Mietzins", { x: ML + 4, y: y - 9, size: 8.5, font: fontB, color: rgb(1,1,1) });
  y -= 13;

  drawBox(p1, ML, y, BW, 17, rgb(0.88, 0.92, 0.98));
  lbl(p1, "Mietzins pro Monat:", ML + 4, y - 5, fontB, 8.5, NAVY);
  p1.drawText("CHF", { x: ML + BW - 90, y: y - 5, size: 8, font: fontR, color: GRAY });
  p1.drawText(chf(d.mietzins_monat), { x: ML + BW - 68, y: y - 5, size: 10, font: fontB, color: NAVY });
  lbl(p1, "(zahlbar im Voraus auf den Ersten eines Monats)", ML + 110, y - 5, fontR, 7, GRAY);
  y -= 17;

  y -= 8;

  // Besondere Vereinbarungen
  lbl(p1, "Besondere Vereinbarungen:", ML, y, fontB, 8.5, DARK);
  y -= 14;
  const vereinText = d.besondere_vereinbarungen || "–";
  const vereinLines = vereinText.split("\n");
  const vereinH = Math.max(vereinLines.length * 13 + 16, 80);
  drawBox(p1, ML, y, BW, vereinH, rgb(0.99, 0.99, 0.99));
  vereinLines.forEach((line, i) => {
    p1.drawText(line, { x: ML + 5, y: y - 10 - i * 13, size: 8.5, font: fontR, color: DARK });
  });
  y -= vereinH + 8;

  // Abschlussklausel
  const abschluss = "Die «Vertragsbestimmungen für Nebenräume», Ausgabe 2025 (HEV Schweiz), bilden einen integrierenden Bestandteil dieser Vereinbarung.";
  lbl(p1, abschluss, ML, y, fontR, 7.5, GRAY);
  y -= 22;

  // Unterschriften
  drawLine(p1, ML, y, W / 2 - 10);
  drawLine(p1, W / 2 + 10, y, MR);
  lbl(p1, "Ort und Datum, Vermieter:", ML, y + 5, fontR, 7.5, GRAY);
  lbl(p1, "Ort und Datum, Mieter:", W / 2 + 10, y + 5, fontR, 7.5, GRAY);
  y -= 4;
  val(p1, d.ort_datum_vermieter, ML, y, fontB, 9.5);
  val(p1, d.ort_datum_mieter, W / 2 + 10, y, fontB, 9.5);
  y -= 28;

  drawLine(p1, ML, y, W / 2 - 10);
  drawLine(p1, W / 2 + 10, y, MR);
  lbl(p1, "Unterschrift Vermieter", ML, y + 4, fontR, 7, GRAY);
  lbl(p1, "Unterschrift Mieter/Mitmieter", W / 2 + 10, y + 4, fontR, 7, GRAY);

  y -= 30;
  lbl(p1, "Ausgabe 2025 · HEV Schweiz · Seite 1/3", ML, y, fontR, 7, GRAY);
  lbl(p1, "1/3", MR - 15, y, fontR, 7, GRAY);

  // ═══════════════════════════════════════════════════════
  // SEITE 2 — Vertragsbestimmungen (Klauseln 1–7)
  // ═══════════════════════════════════════════════════════
  const p2 = pdfDoc.addPage([W, 842]);
  y = 820;

  p2.drawText("Vertragsbestimmungen für Nebenräume", { x: ML, y, size: 12, font: fontB, color: NAVY });
  p2.drawText(`Mieter: ${d.mieter_namen.join(", ")}  ·  ${d.raumbezeichnung}  ·  ${d.liegenschaft_strasse}`, { x: ML, y: y - 13, size: 7.5, font: fontR, color: GRAY });
  y -= 26;
  drawLine(p2, ML, y, MR, 1, NAVY);
  y -= 14;

  const TW = BW - 10;

  interface Clause { nr: string; title: string; text: string }

  const clauses: Clause[] = [
    {
      nr: "1.",
      title: "Übergabe",
      text: "Der Nebenraum wird dem Mieter im Zustand übergeben, in dem er sich bei Vertragsabschluss befindet. Über den Zustand bei der Übergabe wird ein Protokoll erstellt, das von beiden Parteien zu unterzeichnen ist. Mängel, die bei der Übergabe nicht protokolliert wurden, sind bei der Rückgabe als bestehend anzunehmen.",
    },
    {
      nr: "2.",
      title: "Gebrauch",
      text: "Der Mieter darf den Nebenraum nur zum vereinbarten Zweck benützen. Er hat dabei alle einschlägigen Gesetze, Verordnungen und behördlichen Vorschriften zu beachten. Die Verwendung für gewerbliche oder industrielle Zwecke ist ohne ausdrückliche schriftliche Zustimmung des Vermieters untersagt. Der Mieter ist verpflichtet, auf benachbarte Mieter und die Hausgemeinschaft Rücksicht zu nehmen und störende Immissionen zu unterlassen.",
    },
    {
      nr: "3.",
      title: "Unterhalt",
      text: "Der Mieter hat den Nebenraum pfleglich zu behandeln und alle Schäden, die durch seinen Gebrauch entstehen, auf eigene Kosten zu beheben. Er trägt die Kosten des laufenden Unterhalts. Für Mängel, die nicht auf sein Verschulden zurückzuführen sind und den vertragsgemässen Gebrauch beeinträchtigen, hat er den Vermieter unverzüglich zu benachrichtigen. Unterlässt er die Anzeige, kann er für den daraus entstehenden Mehrschaden haftbar gemacht werden.",
    },
    {
      nr: "4.",
      title: "Umbauten",
      text: "Bauliche Veränderungen darf der Mieter nur mit ausdrücklicher schriftlicher Zustimmung des Vermieters vornehmen. Bei der Rückgabe ist der Nebenraum, sofern der Vermieter nichts anderes verlangt, in den ursprünglichen Zustand zurückzuversetzen. Allfällige Verbesserungen gehen entschädigungslos an den Vermieter über, sofern nicht schriftlich etwas anderes vereinbart wurde.",
    },
    {
      nr: "5.",
      title: "Untermiete",
      text: "Die Untermiete oder sonstige Überlassung des Nebenraumes an Dritte ist ohne vorgängige schriftliche Zustimmung des Vermieters untersagt. Erteilt der Vermieter die Zustimmung, so haftet der Mieter gegenüber dem Vermieter für die Erfüllung aller Pflichten aus dem Mietverhältnis auch durch den Untermieter.",
    },
    {
      nr: "6.",
      title: "Verantwortung",
      text: "Der Mieter haftet für Schäden, die er, seine Familienangehörigen, seine Angestellten oder von ihm eingeladene Personen verursachen. Er ist verpflichtet, für sich und die von ihm in den Räumlichkeiten tätigen Personen eine ausreichende Haftpflichtversicherung abzuschliessen. Der Nachweis einer gültigen Haftpflichtversicherung ist dem Vermieter auf Verlangen vorzulegen.",
    },
    {
      nr: "7.",
      title: "Beendigung des Mietverhältnisses",
      text: "Das Mietverhältnis wird auf unbestimmte Zeit abgeschlossen und kann unter Einhaltung der vereinbarten Frist auf die vereinbarten Termin gekündigt werden. Die Kündigung hat schriftlich zu erfolgen. Für die Kündigung des Mietverhältnisses durch den Vermieter gegenüber dem Mieter gelten die Bestimmungen des Obligationenrechts (insbesondere Art. 271–271a OR). Der Mieter kann gegen eine missbräuchliche Kündigung die zuständige Schlichtungsbehörde anrufen.",
    },
  ];

  for (const clause of clauses) {
    const dy = sectionHeading(p2, clause.nr, clause.title, ML, y, fontB, fontR);
    y -= dy;
    const h = drawWrapped(p2, clause.text, ML + 10, y, TW, fontR, 8, 11);
    y -= h + 10;
    if (y < 60) break; // safety
  }

  lbl(p2, "Ausgabe 2025 · HEV Schweiz", ML, 30, fontR, 7, GRAY);
  lbl(p2, "2/3", MR - 15, 30, fontR, 7, GRAY);

  // ═══════════════════════════════════════════════════════
  // SEITE 3 — Vertragsbestimmungen (Klauseln 8–13)
  // ═══════════════════════════════════════════════════════
  const p3 = pdfDoc.addPage([W, 842]);
  y = 820;

  p3.drawText("Vertragsbestimmungen für Nebenräume (Fortsetzung)", { x: ML, y, size: 10, font: fontB, color: NAVY });
  p3.drawText(`Mieter: ${d.mieter_namen.join(", ")}  ·  ${d.raumbezeichnung}`, { x: ML, y: y - 12, size: 7.5, font: fontR, color: GRAY });
  y -= 25;
  drawLine(p3, ML, y, MR, 1, NAVY);
  y -= 14;

  const clauses2: Clause[] = [
    {
      nr: "8.",
      title: "Dringliche Mängelbehebung",
      text: "Bei dringenden Mängeln, die einer sofortigen Behebung bedürfen, ist der Mieter berechtigt, die notwendigen Massnahmen auf Kosten des Vermieters zu treffen, wenn er den Vermieter nicht rechtzeitig erreichen kann. Er hat dabei die geringstmöglichen Kosten zu verursachen und den Vermieter unverzüglich über die ergriffenen Massnahmen zu unterrichten.",
    },
    {
      nr: "9.",
      title: "Besichtigung",
      text: "Der Vermieter und seine Beauftragten sind berechtigt, den Nebenraum nach rechtzeitiger Ankündigung (in der Regel mindestens 24 Stunden im Voraus) zu besichtigen, soweit dies zur Prüfung des Zustandes oder zur Vorbereitung von Reparaturen notwendig ist. Bei dringenden Notfällen kann die Besichtigung ohne Voranmeldung erfolgen.",
    },
    {
      nr: "10.",
      title: "Informationspflicht",
      text: "Der Mieter hat den Vermieter unverzüglich zu informieren, wenn er seinen Wohnsitz oder seine Wohnadresse ändert, wenn er längere Zeit (mehr als 4 Wochen) abwesend ist, wenn behördliche Massnahmen ergriffen werden, die den Nebenraum betreffen, oder wenn sich der Zustand des Nebenraumes wesentlich verschlechtert.",
    },
    {
      nr: "11.",
      title: "Rückgabe",
      text: "Bei Beendigung des Mietverhältnisses hat der Mieter den Nebenraum in sauberem Zustand und mit allen zugehörigen Schlüsseln zurückzugeben. Allfällig notwendige Reparaturen, die auf Schäden zurückzuführen sind, für die der Mieter haftet, sind zu Lasten des Mieters durch den Vermieter oder beauftragte Dritte auszuführen. Ein Rückgabeprotokoll wird erstellt und von beiden Parteien unterzeichnet.",
    },
    {
      nr: "12.",
      title: "Ausfertigung und Änderung",
      text: "Diese Vereinbarung wird in zwei gleichlautenden Exemplaren ausgefertigt; jede Partei erhält ein Exemplar. Jede Änderung oder Ergänzung dieser Vereinbarung bedarf zu ihrer Gültigkeit der schriftlichen Form und muss von beiden Parteien unterzeichnet werden. Diese Vereinbarung hat erst Gültigkeit, wenn alle Vertragsparteien unterzeichnet haben.",
    },
    {
      nr: "13.",
      title: "Gerichtsstand",
      text: "Für Streitigkeiten aus diesem Mietverhältnis ist der Gerichtsstand am Ort der gelegenen Sache. Vor Einleitung eines Gerichtsverfahrens haben die Parteien die zuständige Schlichtungsbehörde in Mietsachen anzurufen. Die Parteien sind berechtigt, bei der Schlichtungsbehörde das Verfahren auch auf Deutsch, Französisch oder Italienisch zu führen.",
    },
  ];

  for (const clause of clauses2) {
    const dy = sectionHeading(p3, clause.nr, clause.title, ML, y, fontB, fontR);
    y -= dy;
    const h = drawWrapped(p3, clause.text, ML + 10, y, TW, fontR, 8, 11);
    y -= h + 10;
  }

  // Schlussklausel
  y -= 10;
  drawLine(p3, ML, y, MR, 0.5, LINE_GRAY);
  y -= 12;
  const schluss = "Diese Vertragsbestimmungen gelten für alle Mietverhältnisse, die unter dieser Zusatzvereinbarung abgeschlossen werden. Sie sind verbindlich und können nur durch ausdrückliche schriftliche Vereinbarung abgeändert werden.";
  drawWrapped(p3, schluss, ML, y, TW, fontR, 7.5, 10, GRAY);

  lbl(p3, "Ausgabe 2025 · HEV Schweiz", ML, 30, fontR, 7, GRAY);
  lbl(p3, "3/3", MR - 15, 30, fontR, 7, GRAY);

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Nebenraum_${d.mieter_namen[0].replace(/\s/g, "_")}_${d.raumbezeichnung.replace(/\s/g, "_")}.pdf"`,
    },
  });
}
