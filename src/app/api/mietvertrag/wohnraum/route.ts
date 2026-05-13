import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";

export interface MietvertragWohnraumInput {
  // Vermieter
  vermieter_name: string;
  vermieter_adresse?: string;
  ref_nr?: string;
  depot_chf: number;

  // Mieter (bis 3 Personen)
  mieter_namen: string[];

  // Liegenschaft
  liegenschaft_strasse: string;
  liegenschaft_plz_ort: string;
  mietobjekt_bezeichnung: string;  // "2.5 Zimmer Wohnung"
  stockwerk: string;               // "EG", "1.OG", etc.
  benutzung_als: string;           // "Wohnung"
  personenzahl_max: number;

  // Mitbenützung (true = angekreuzt)
  mitbenuetzung_waschkueche: boolean;
  mitbenuetzung_trockenraum: boolean;
  mitbenuetzung_einstellraum_velo: boolean;
  mitbenuetzung_garten: boolean;
  keller_nr?: string;
  autoabstellplatz_nr?: string;
  garage: boolean;

  // Vertragsdaten
  mietbeginn: string;              // "01.06.2026"
  kuendigungsfrist_monate: number; // 3
  kuendigungstermine: string;      // "Ende März/Ende Juni/Ende September"
  mindestdauer_bis?: string;       // "01.06.2029"

  // Mietzins
  nettomietzins: number;
  garage_mietzins?: number;
  nk_heizung?: number;
  nk_heizung_typ?: string;        // "akonto" | "pauschal"
  nk_warmwasser?: number;
  nk_warmwasser_typ?: string;
  nk_hauswart?: number;
  nk_hauswart_typ?: string;
  nk_allgemeinstrom?: number;
  nk_allgemeinstrom_typ?: string;
  nk_abwasser?: number;
  nk_wasser?: number;
  nk_kehricht?: number;
  nk_garten?: number;
  nk_schnee?: number;
  bruttomietzins: number;

  // Berechnungsgrundlagen
  referenzzinssatz?: string;
  landesindex?: string;
  kostenstand?: string;

  // Besondere Vereinbarungen
  besondere_vereinbarungen: string;

  // Unterschriften
  ort_datum_vermieter: string;
  ort_datum_mieter: string;
}

const GRAY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0, 0, 0);
const DARK = rgb(0.1, 0.1, 0.1);
const NAVY = rgb(0.08, 0.18, 0.35);
const LINE_GRAY = rgb(0.75, 0.75, 0.75);
const FILL_BG = rgb(0.95, 0.97, 1.0);

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

function label(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 8, color = GRAY) {
  page.drawText(text, { x, y, size, font, color });
}

function value(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9.5, color = DARK) {
  page.drawText(text, { x, y, size, font, color });
}

function checkbox(page: PDFPage, checked: boolean, x: number, y: number, font: PDFFont) {
  page.drawRectangle({ x, y: y - 8, width: 9, height: 9, borderColor: rgb(0.5,0.5,0.5), borderWidth: 0.8, color: rgb(1,1,1) });
  if (checked) {
    page.drawText("✕", { x: x + 1, y: y - 7, size: 8, font, color: BLACK });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const d: MietvertragWohnraumInput = await req.json();

  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ═══════════════════════════════════════════════
  // SEITE 1
  // ═══════════════════════════════════════════════
  const p1 = pdfDoc.addPage([595, 842]);
  const W = 595;
  let y = 820;

  // ── HEADER ─────────────────────────────────────
  // HEV Logo-Bereich (Rechteck + Text)
  p1.drawRectangle({ x: 30, y: y - 40, width: 70, height: 40, color: NAVY });
  p1.drawText("HEV", { x: 38, y: y - 20, size: 14, font: fontB, color: rgb(1,1,1) });
  p1.drawText("Zürich", { x: 38, y: y - 33, size: 9, font: fontR, color: rgb(0.8,0.9,1) });

  p1.drawText("Zürcher Mietvertrag für Wohnräume", { x: 110, y: y - 12, size: 15, font: fontB, color: NAVY });
  p1.drawText("Gemeinsam herausgegeben von: Hauseigentümerverband Zürich (HEV), Schweizerischer Verband der", { x: 110, y: y - 24, size: 6.5, font: fontR, color: GRAY });
  p1.drawText("Immobilienwirtschaft (SVIT), MO Zürich, Vereinigung Zürcher Immobilienunternehmen (VZI). Ausgabe 2023", { x: 110, y: y - 33, size: 6.5, font: fontR, color: GRAY });

  y -= 50;
  p1.drawText("Der Einfachheithalber wird in diesem Vertrag auf die weiblichen Formen «Mieterin, Vermieterin» etc. verzichtet und stattdessen «Mieter, Vermieter» etc. als Oberbegriff verwendet.", { x: 30, y, size: 7, font: fontR, color: GRAY });

  y -= 18;

  // ── HAUPTBOX (ganzer Vertragsblock) ─────────────
  const BOX_X = 30;
  const BOX_W = W - 60;
  const BOX_TOP = y;

  // Row 1: Vermieter / Ref-Nr / Depot
  drawBox(p1, BOX_X, y, BOX_W, 18);
  label(p1, "Vermieter:", BOX_X + 4, y - 4, fontR);
  value(p1, d.vermieter_name, BOX_X + 52, y - 4, fontB, 9.5);
  label(p1, "Ref.-Nr.", BOX_X + 320, y - 4, fontR);
  drawBox(p1, BOX_X + 370, y, 60, 18, rgb(0.88, 0.92, 0.98));
  label(p1, "Depot CHF", BOX_X + 435, y - 4, fontR);
  value(p1, chf(d.depot_chf), BOX_X + 490, y - 4, fontB, 9.5);
  y -= 18;

  // Row 2: vertreten durch
  drawBox(p1, BOX_X, y, BOX_W, 14);
  label(p1, "vertreten durch:", BOX_X + 4, y - 4, fontR);
  y -= 14;

  // Row 3: Mieter
  const mieterText = d.mieter_namen.join("\n");
  const mieterLines = d.mieter_namen.length;
  const mieterH = Math.max(22, mieterLines * 12 + 8);
  drawBox(p1, BOX_X, y, BOX_W, mieterH);
  label(p1, "Mieter:", BOX_X + 4, y - 4, fontR);
  d.mieter_namen.forEach((m, i) => {
    value(p1, m, BOX_X + 52, y - 4 - i * 12, i === 0 ? fontB : fontR, 9.5);
  });
  if (d.mieter_namen.length > 1) {
    p1.drawText("(Sind mehrere Personen Mieter, so haften diese für die Verbindlichkeiten aus diesem Vertrag solidarisch.)", { x: BOX_X + 4, y: y - mieterH + 3, size: 6.5, font: fontR, color: GRAY });
  }
  y -= mieterH;

  // Row 4: Liegenschaft / Ort
  drawBox(p1, BOX_X, y, BOX_W, 16);
  label(p1, "Liegenschaft:", BOX_X + 4, y - 4, fontR);
  value(p1, d.liegenschaft_strasse, BOX_X + 62, y - 4, fontB, 9.5);
  label(p1, "Ort:", BOX_X + 280, y - 4, fontR);
  value(p1, d.liegenschaft_plz_ort, BOX_X + 300, y - 4, fontB, 9.5);
  y -= 16;

  // Row 5: Mietobjekt / Stockwerk / Benützung / Personen
  drawBox(p1, BOX_X, y, BOX_W, 16);
  label(p1, "Mietobjekt:", BOX_X + 4, y - 4, fontR);
  value(p1, d.mietobjekt_bezeichnung, BOX_X + 55, y - 4, fontB, 9.5);
  label(p1, "Stockwerk:", BOX_X + 280, y - 4, fontR);
  value(p1, d.stockwerk, BOX_X + 325, y - 4, fontB, 9.5);
  y -= 16;

  drawBox(p1, BOX_X, y, BOX_W, 16);
  label(p1, "zur Benützung als", BOX_X + 4, y - 4, fontR);
  value(p1, d.benutzung_als, BOX_X + 90, y - 4, fontB, 9.5);
  label(p1, "Personenzahl: max.", BOX_X + 280, y - 4, fontR);
  value(p1, String(d.personenzahl_max), BOX_X + 365, y - 4, fontB, 9.5);
  y -= 16;

  // Row: Mitbenützung / Nebenräume
  drawBox(p1, BOX_X, y, BOX_W / 2, 14);
  label(p1, "Zur Mitbenützung:", BOX_X + 4, y - 4, fontB, 8);
  drawBox(p1, BOX_X + BOX_W / 2, y, BOX_W / 2, 14);
  label(p1, "Nebenräume:", BOX_X + BOX_W / 2 + 4, y - 4, fontB, 8);
  y -= 14;

  // Checkboxes
  const checkItems = [
    { label: "Waschküche", checked: d.mitbenuetzung_waschkueche, col: 0 },
    { label: "Trockenraum", checked: d.mitbenuetzung_trockenraum, col: 1 },
    { label: "Einstellraum für Fahrräder", checked: d.mitbenuetzung_einstellraum_velo, col: 0 },
    { label: "Garten", checked: d.mitbenuetzung_garten, col: 1 },
  ];

  const nebenItems = [
    { label: `Keller/Kellerabteil Nr. ${d.keller_nr || "___"}`, checked: !!d.keller_nr, col: 2 },
    { label: `Autoabstellplatz im Freien Nr. ${d.autoabstellplatz_nr || "___"}`, checked: !!d.autoabstellplatz_nr, col: 3 },
    { label: "Garage", checked: d.garage, col: 3 },
  ];

  const allItems = [...checkItems, ...nebenItems];
  const colW = BOX_W / 4;

  // 2 rows of checkboxes
  for (let row = 0; row < 2; row++) {
    drawBox(p1, BOX_X, y, BOX_W, 14);
    for (let col = 0; col < 4; col++) {
      const item = allItems.find(i => i.col === col && Math.floor(allItems.filter(x => x.col === col).indexOf(i)) === row);
      const items = allItems.filter(x => x.col === col);
      if (items[row]) {
        checkbox(p1, items[row].checked, BOX_X + col * colW + 4, y - 3, fontR);
        label(p1, items[row].label, BOX_X + col * colW + 16, y - 4, fontR, 7.5, DARK);
      }
    }
    y -= 14;
  }

  // EGID / aWN
  drawBox(p1, BOX_X, y, BOX_W, 14);
  label(p1, "Eidg. Gebäudeidentifikator (EGID):", BOX_X + 4, y - 4, fontR, 7.5);
  label(p1, "Amtliche Wohnungs-Nr. (aWN):", BOX_X + BOX_W / 2 + 4, y - 4, fontR, 7.5);
  y -= 14;

  // ── MIETBEGINN / KÜNDIGUNG ──────────────────────
  y -= 4;
  drawBox(p1, BOX_X, y, BOX_W, 14);
  label(p1, "Mietbeginn:", BOX_X + 4, y - 4, fontB, 8);
  value(p1, d.mietbeginn, BOX_X + 55, y - 4, fontB, 9.5);
  label(p1, d.kuendigungstermine, BOX_X + 240, y - 4, fontR, 8, GRAY);
  y -= 14;

  drawBox(p1, BOX_X, y, BOX_W, 14);
  label(p1, "Kündigung bei unbefristetem", BOX_X + 4, y - 4, fontR, 8);
  label(p1, `– ${d.kuendigungsfrist_monate}`, BOX_X + 145, y - 4, fontB, 9);
  label(p1, "-monatlich im Voraus auf:", BOX_X + 162, y - 4, fontR, 8);
  if (d.mindestdauer_bis) {
    label(p1, "– jedoch frühestens auf:", BOX_X + 300, y - 4, fontR, 8);
    value(p1, d.mindestdauer_bis, BOX_X + 395, y - 4, fontB, 9);
    label(p1, "(Mindestdauer)", BOX_X + 465, y - 4, fontR, 7, GRAY);
  }
  y -= 14;

  drawBox(p1, BOX_X, y, BOX_W, 12);
  label(p1, "Mietverhältnis:", BOX_X + 4, y - 4, fontR, 7);
  label(p1, "Mietende bei befristetem Mietverhältnis: Der Vertrag ist unkündbar und endet ohne Weiteres am:", BOX_X + 65, y - 4, fontR, 7, GRAY);
  y -= 12;

  y -= 6;

  // ── MIETZINS TABELLE ────────────────────────────
  drawBox(p1, BOX_X, y, BOX_W, 13, NAVY);
  p1.drawText("Mietzins", { x: BOX_X + 4, y: y - 9, size: 8.5, font: fontB, color: rgb(1,1,1) });
  p1.drawText("pro Monat", { x: BOX_X + BOX_W - 55, y: y - 9, size: 8, font: fontB, color: rgb(1,1,1) });
  y -= 13;

  const mietzinsRows: [string, string?, number?][] = [
    ["Nettomietzins", "", d.nettomietzins],
    ["Netto-Mietzins Garage/Einstell-/Abstellplatz", "", d.garage_mietzins],
    ["Nebenkosten", "", undefined],
    ["Heizkosten", d.nk_heizung_typ ?? "akonto", d.nk_heizung],
    ["Warmwasserkosten", d.nk_warmwasser_typ ?? "akonto", d.nk_warmwasser],
    ["Hauswartung/Treppenhausheinung", d.nk_hauswart_typ ?? "akonto", d.nk_hauswart],
    ["Kabel-TV- /Antennengebühren", "akonto", undefined],
    ["Allgemeinstrom", d.nk_allgemeinstrom_typ ?? "akonto", d.nk_allgemeinstrom],
    ["Abwassergebühren", "akonto", d.nk_abwasser],
    ["Kaltwasserbezug", "akonto", d.nk_wasser],
    ["Kehrichtabfuhr- und Grundgebühren", "akonto", d.nk_kehricht],
    ["Garten- und Umgebungspflege", "akonto", d.nk_garten],
    ["Kosten der Schnee- und Eisräumung", "akonto", d.nk_schnee],
  ];

  mietzinsRows.forEach(([rowLabel, typ, betrag], i) => {
    const rowH = 11;
    const bg = i % 2 === 0 ? rgb(0.99, 0.99, 0.99) : rgb(0.96, 0.97, 1.0);
    drawBox(p1, BOX_X, y, BOX_W, rowH, bg);

    const isBold = rowLabel === "Nettomietzins";
    const f = isBold ? fontB : fontR;
    p1.drawText(rowLabel, { x: BOX_X + 4, y: y - rowH + 3, size: 7.5, font: f, color: rowLabel === "Nebenkosten" ? GRAY : DARK });

    if (typ && rowLabel !== "Nettomietzins" && rowLabel !== "Netto-Mietzins Garage/Einstell-/Abstellplatz") {
      p1.drawText(`akonto* /pauschal*`, { x: BOX_X + 265, y: y - rowH + 3, size: 7, font: fontR, color: GRAY });
    }

    p1.drawText("CHF", { x: BOX_X + 460, y: y - rowH + 3, size: 7.5, font: fontR, color: GRAY });
    if (betrag) {
      p1.drawText(chf(betrag), { x: BOX_X + 478, y: y - rowH + 3, size: 8, font: fontB, color: DARK });
    }
    y -= rowH;
  });

  // Bruttomietzins
  drawBox(p1, BOX_X, y, BOX_W, 13, rgb(0.88, 0.92, 0.98));
  p1.drawText("Bruttomietzins", { x: BOX_X + 4, y: y - 9, size: 8.5, font: fontB, color: NAVY });
  p1.drawText("zahlbar im Voraus auf den Ersten eines Monats", { x: BOX_X + 85, y: y - 9, size: 7.5, font: fontR, color: GRAY });
  p1.drawText("CHF", { x: BOX_X + 450, y: y - 9, size: 8, font: fontR, color: GRAY });
  p1.drawText(chf(d.bruttomietzins), { x: BOX_X + 468, y: y - 9, size: 9.5, font: fontB, color: NAVY });
  y -= 13;

  y -= 4;
  p1.drawText("10006/001/2023", { x: BOX_X, y: y, size: 7, font: fontR, color: GRAY });
  p1.drawText("*Nichtpassendes streichen         Berechnungsgrundlagen siehe Seite 2  1/2", { x: BOX_X + 200, y: y, size: 7, font: fontR, color: GRAY });

  // ═══════════════════════════════════════════════
  // SEITE 2
  // ═══════════════════════════════════════════════
  const p2 = pdfDoc.addPage([595, 842]);
  y = 820;

  // Kopfbereich Seite 2 (Wiederholung der Kopfzeile)
  p2.drawText("Zürcher Mietvertrag für Wohnräume — Seite 2/2", { x: 30, y, size: 10, font: fontB, color: NAVY });
  p2.drawText(`Mieter: ${d.mieter_namen.join(", ")}  ·  Mietobjekt: ${d.mietobjekt_bezeichnung}  ·  ${d.liegenschaft_strasse}`, { x: 30, y: y - 12, size: 8, font: fontR, color: GRAY });
  y -= 28;
  drawLine(p2, 30, y, W - 30, 1, NAVY);
  y -= 12;

  // Berechnungsgrundlagen
  drawBox(p2, 30, y, W - 60, 38);
  p2.drawText("Berechnungsgrundlagen:", { x: 34, y: y - 9, size: 8, font: fontB, color: DARK });
  p2.drawText(`Referenzzinssatz ${d.referenzzinssatz ?? "______"}    Landesindex der Konsumentenpreise ${d.landesindex ?? "______"}    Kostenstand ${d.kostenstand ?? "______"}`, { x: 34, y: y - 20, size: 8, font: fontR, color: DARK });
  p2.drawText("Vorbehalte:   – aufgelaufene Reserve als Berechnungsstand bis Vertragsabschluss  CHF _______ / _______ %", { x: 34, y: y - 30, size: 8, font: fontR, color: DARK });
  y -= 42;

  // Mietzinszahlung/Verzug
  y -= 6;
  p2.drawText("Mietzinszahlung/Verzug", { x: 30, y, size: 9, font: fontB, color: NAVY });
  y -= 12;
  const verzugText = "Der Mietzins ist rechtzeitig bezahlt, wenn der Vermieter am Verfalldatum darüber verfügt.\nBei verspäteter Mietzinszahlung ist der Vermieter berechtigt, dem Mieter alle damit im Zusammenhang stehenden Aufwendungen\nsowie einen Verzugszins von 5%, eine Mahngebühr von mindestens CHF 25.– und Spesen in Rechnung zu stellen.";
  verzugText.split("\n").forEach(line => {
    p2.drawText(line, { x: 30, y, size: 8, font: fontR, color: DARK });
    y -= 11;
  });

  // Depot
  y -= 8;
  p2.drawText("Bestimmungen über das Depot", { x: 30, y, size: 9, font: fontB, color: NAVY });
  y -= 12;
  const depotText = `Das Depot dient der Sicherstellung sämtlicher Ansprüche aus dem Mietverhältnis und ist vor der Schlüsselübergabe zu bezahlen.\nDer Mieter ist nicht berechtigt, die Sicherheitsleistung mit dem Mietzins oder anderen Forderungen des Vermieters zu verrechnen.`;
  depotText.split("\n").forEach(line => { p2.drawText(line, { x: 30, y, size: 8, font: fontR, color: DARK }); y -= 11; });

  y -= 6;
  drawBox(p2, 30, y, W - 60, 68, rgb(0.95, 0.95, 0.95));
  const art257 = ["Art. 257e OR", "Leistet der Mieter von Wohn- oder Geschäftsräumen eine Sicherheit in Geld oder in Wertpapieren, so muss der Vermieter sie bei", "einer Bank auf einem Sparkonto oder einem Depot, das auf den Namen des Mieters lautet, hinterlegen.", "", "Bei Miete von Wohnräumen darf der Vermieter höchstens drei Monatszinse als Sicherheit verlangen.", "", "Die Bank darf die Sicherheit nur mit Zustimmung beider Parteien oder gestützt auf einen rechtskräftigen Zahlungsbefehl oder", "auf ein rechtskräftiges Gerichtsurteil herausgeben."];
  art257.forEach((line, i) => {
    p2.drawText(line, { x: 34, y: y - 9 - i * 9, size: i === 0 ? 8.5 : 7.5, font: i === 0 ? fontB : fontR, color: i === 0 ? DARK : GRAY });
  });
  y -= 72;

  // Besondere Vereinbarungen
  y -= 10;
  p2.drawText("Besondere Vereinbarungen", { x: 30, y, size: 9, font: fontB, color: NAVY });
  p2.drawText("(siehe auch Seite 6 der «Allgemeinen Bedingungen»)", { x: 170, y, size: 7.5, font: fontR, color: GRAY });
  y -= 14;

  const vereinLines = d.besondere_vereinbarungen.split("\n");
  drawBox(p2, 30, y, W - 60, Math.max(vereinLines.length * 13 + 16, 100));
  vereinLines.forEach((line, i) => {
    p2.drawText(line, { x: 34, y: y - 10 - i * 13, size: 8.5, font: fontR, color: DARK });
  });
  y -= Math.max(vereinLines.length * 13 + 20, 105);

  // Abschlussklausel
  y -= 10;
  const abschlussText = "Die «Allgemeinen Bedingungen zum Mietvertrag für Wohnräume», Ausgabe 2023 (HEV, SVIT, VZI), bilden einen integrierenden Bestandteil dieses Vertrages. Die Parteien bestätigen mit ihren Unterschriften, dass sie ein vollständiges Exemplar erhalten haben und sich mit dem Inhalt einverstanden erklären.\nDieser Vertrag ist zweifach ausgefertigt und enthält alle getroffenen Abmachungen. Jede Änderung oder Ergänzung derselben bedarf zu ihrer Gültigkeit der Schriftform. Der Vertrag hat erst Gültigkeit, wenn alle Vertragsparteien unterzeichnet haben.";
  abschlussText.split("\n").forEach(line => { p2.drawText(line, { x: 30, y, size: 7.5, font: fontR, color: GRAY }); y -= 11; });

  // Unterschriften
  y -= 20;
  drawLine(p2, 30, y, W / 2 - 10);
  drawLine(p2, W / 2 + 10, y, W - 30);
  p2.drawText("Ort und Datum:", { x: 30, y: y + 4, size: 7.5, font: fontR, color: GRAY });
  p2.drawText("Ort und Datum:", { x: W / 2 + 10, y: y + 4, size: 7.5, font: fontR, color: GRAY });
  y -= 3;
  p2.drawText(d.ort_datum_vermieter, { x: 30, y, size: 9.5, font: fontB, color: DARK });
  p2.drawText(d.ort_datum_mieter, { x: W / 2 + 10, y, size: 9.5, font: fontB, color: DARK });
  y -= 25;

  drawLine(p2, 30, y, W / 2 - 10);
  drawLine(p2, W / 2 + 10, y, W - 30);
  p2.drawText("Der Vermieter:", { x: 30, y: y + 4, size: 7.5, font: fontR, color: GRAY });
  p2.drawText("Der/Die Mieter:", { x: W / 2 + 10, y: y + 4, size: 7.5, font: fontR, color: GRAY });

  y -= 30;
  p2.drawText("Nachdruck verboten", { x: 30, y, size: 7, font: fontR, color: GRAY });
  p2.drawText("Zu beziehen beim Hauseigentümerverband Zürich, Albisstrasse 28, 8038 Zürich", { x: 30, y: y - 9, size: 7, font: fontR, color: GRAY });
  p2.drawText("10006/001/2023", { x: 30, y: y - 18, size: 7, font: fontR, color: GRAY });
  p2.drawText("2/2", { x: W - 40, y: y - 18, size: 7, font: fontR, color: GRAY });

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Mietvertrag_${d.mieter_namen[0].replace(/\s/g, "_")}.pdf"`,
    },
  });
}
