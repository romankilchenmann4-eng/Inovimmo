// ── Nebenkostenabrechnung PDF Helpers ──────────────────────────
// Shared drawing functions for all NK PDF routes

import { PDFDocument, PDFPage, PDFFont, rgb, RGB } from "pdf-lib";
import { roundCHF, formatCHF } from "./calc";

// ── Color Constants ────────────────────────────────────────────
export const NAVY = rgb(0.08, 0.18, 0.35);
export const DARK = rgb(0.1, 0.1, 0.1);
export const GRAY = rgb(0.45, 0.45, 0.45);
export const LINE_GRAY = rgb(0.8, 0.8, 0.8);
export const FILL_BG = rgb(0.96, 0.97, 1.0);
export const GREEN = rgb(0.1, 0.6, 0.3);
export const RED = rgb(0.75, 0.1, 0.1);
export const WHITE = rgb(1, 1, 1);
export const LIGHT_BLUE = rgb(0.88, 0.92, 0.98);

// ── Page dimensions (A4) ──────────────────────────────────────
export const PAGE_W = 595;
export const PAGE_H = 842;
export const ML = 50; // margin left
export const MR = PAGE_W - 50; // margin right
export const BW = MR - ML; // body width

// ── Swiss Kuvertfenster coordinates ────────────────────────────
// Address window: 90x40mm at 20mm from left, 45mm from top
// In points (1mm ≈ 2.835pt): left=57, top=680, width=255, height=113
export const ADDR_X = 57;
export const ADDR_Y = 690;
export const ADDR_W = 255;
export const ADDR_H = 113;

// ── Drawing Helpers ────────────────────────────────────────────
export function drawHR(
  page: PDFPage,
  x1: number,
  y: number,
  x2: number,
  t: number = 0.5,
  color: RGB = LINE_GRAY
) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color });
}

export function txt(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB = DARK
) {
  if (!text) return;
  page.drawText(text, { x, y, size, font, color });
}

export function box(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: RGB = FILL_BG,
  border: RGB = LINE_GRAY
) {
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: fill, borderColor: border, borderWidth: 0.5 });
}

// ── Multi-line text with word wrap ──────────────────────────────
export function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  lineHeight: number = size * 1.4,
  color: RGB = DARK
): number {
  const lines = text.split("\n");
  let currentY = y;

  for (const line of lines) {
    const words = line.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth > maxWidth && currentLine) {
        txt(page, currentLine, x, currentY, font, size, color);
        currentY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      txt(page, currentLine, x, currentY, font, size, color);
      currentY -= lineHeight;
    }
  }

  return currentY;
}

// ── Kuvertfenster Address Block ───────────────────────────────
export function drawKuvertfensterAdresse(
  page: PDFPage,
  name: string,
  adresseLines: string[],
  fontB: PDFFont,
  fontR: PDFFont
) {
  // Swiss standard: address window at ~20mm left, ~45mm from top
  // Draw a light guide rectangle (invisible in print, visible in design)
  const startY = ADDR_Y;
  let y = startY;

  // Name (bold)
  txt(page, name, ADDR_X, y, fontB, 10, DARK);
  y -= 14;

  // Address lines (regular)
  for (const line of adresseLines) {
    if (!line) continue;
    txt(page, line, ADDR_X, y, fontR, 9, DARK);
    y -= 13;
  }
}

// ── Absenderzeile (above address window) ────────────────────────
export function drawAbsenderzeile(
  page: PDFPage,
  absenderText: string,
  fontR: PDFFont
) {
  // Small text above the address window
  txt(page, absenderText, ADDR_X, ADDR_Y + 18, fontR, 6.5, GRAY);
}

// ── Abrechnung Header Band ────────────────────────────────────
export function drawAbrechnungHeader(
  page: PDFPage,
  liegenschaft: { name: string; strasse: string; hausnummer: string; plz: string; ort: string },
  jahr: number,
  periode_von: string,
  periode_bis: string,
  fontB: PDFFont,
  fontR: PDFFont
): number {
  let y = PAGE_H;

  // Navy header band
  page.drawRectangle({ x: 0, y: y - 100, width: PAGE_W, height: 100, color: NAVY });
  txt(page, "NEBENKOSTENABRECHNUNG", ML, y - 35, fontB, 9, rgb(0.6, 0.7, 0.9));
  txt(page, liegenschaft.name, ML, y - 58, fontB, 22, WHITE);
  txt(page, `${liegenschaft.strasse} ${liegenschaft.hausnummer}, ${liegenschaft.plz} ${liegenschaft.ort}`, ML, y - 76, fontR, 9, rgb(0.75, 0.82, 0.95));

  const periodeStr = `${new Date(periode_von).toLocaleDateString("de-CH")} – ${new Date(periode_bis).toLocaleDateString("de-CH")}`;
  txt(page, `Abrechnungsperiode: ${periodeStr}`, ML, y - 94, fontR, 8, rgb(0.6, 0.7, 0.9));

  y -= 115;
  return y;
}

// ── Cost Category Table ────────────────────────────────────────
export interface KostenPosition {
  bezeichnung: string;
  kategorie: string;
  betrag_total: number;
  anteil_prozent: number;
  betrag_anteil: number;
  verteilschluessel_typ: string;
  umlagefaehig: boolean;
}

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

const VS_LABELS: Record<string, string> = {
  flaeche: "Fläche",
  kopf: "Kopf",
  gleich: "gleich",
  verbrauch: "Verbrauch",
  gemischt: "gemischt",
};

export function drawKostenTabelle(
  page: PDFPage,
  positionen: KostenPosition[],
  startY: number,
  fontR: PDFFont,
  fontB: PDFFont
): number {
  let y = startY;

  // Header
  txt(page, "Kostenübersicht", ML, y, fontB, 11, NAVY);
  y -= 18;

  const colWidths = [BW * 0.32, BW * 0.18, BW * 0.14, BW * 0.14, BW * 0.14, BW * 0.08];
  const headers = ["Bezeichnung", "Kategorie", "Total CHF", "Anteil %", "Ihr Anteil", "VS"];

  // Table header row
  box(page, ML, y, BW, 15, LIGHT_BLUE);
  let cx = ML + 4;
  headers.forEach((h, i) => {
    txt(page, h, cx, y - 4, fontB, 7.5, NAVY);
    cx += colWidths[i];
  });
  y -= 15;

  // Position rows
  let kostenTotal = 0;
  let anteilTotal = 0;

  for (let i = 0; i < positionen.length; i++) {
    const pos = positionen[i];
    const bg = i % 2 === 0 ? rgb(0.98, 0.99, 1.0) : WHITE;

    if (!pos.umlagefaehig) {
      // Strike through non-umlagefaehig items
      box(page, ML, y, BW, 13, rgb(0.95, 0.95, 0.95));
    } else {
      box(page, ML, y, BW, 13, bg);
    }

    cx = ML + 4;
    const textColor = pos.umlagefaehig ? DARK : GRAY;

    txt(page, pos.bezeichnung.length > 28 ? pos.bezeichnung.substring(0, 27) + "…" : pos.bezeichnung, cx, y - 3, fontR, 7.5, textColor);
    cx += colWidths[0];
    txt(page, KATEGORIE_LABELS[pos.kategorie] ?? pos.kategorie, cx, y - 3, fontR, 7.5, textColor);
    cx += colWidths[1];
    txt(page, formatCHF(pos.betrag_total), cx, y - 3, fontR, 7.5, textColor);
    cx += colWidths[2];
    txt(page, pos.anteil_prozent.toFixed(1) + "%", cx, y - 3, fontR, 7.5, textColor);
    cx += colWidths[3];
    txt(page, formatCHF(pos.betrag_anteil), cx, y - 3, pos.umlagefaehig ? fontB : fontR, 8, pos.umlagefaehig ? DARK : GRAY);
    cx += colWidths[4];
    txt(page, VS_LABELS[pos.verteilschluessel_typ] ?? pos.verteilschluessel_typ, cx, y - 3, fontR, 7, GRAY);

    if (pos.umlagefaehig) {
      kostenTotal += pos.betrag_total;
      anteilTotal += pos.betrag_anteil;
    }
    y -= 13;

    // Page break check
    if (y < 120) {
      txt(page, `Nebenkostenabrechnung – Fortsetzung`, ML, 28, fontR, 7, GRAY);
      page = page.doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 40;
    }
  }

  // Totals row
  y -= 2;
  box(page, ML, y, BW, 16, rgb(0.9, 0.93, 0.98));
  txt(page, "Total (umlagefähig)", ML + 4, y - 5, fontB, 8.5, NAVY);
  txt(page, formatCHF(kostenTotal), ML + colWidths[0] + colWidths[1] + 4, y - 5, fontB, 8.5, NAVY);
  const totalAnteilW = fontB.widthOfTextAtSize(formatCHF(anteilTotal), 9);
  txt(page, formatCHF(anteilTotal), MR - totalAnteilW - 6, y - 5, fontB, 9, NAVY);

  return y - 20;
}

// ── Summary Block (Total, Akonto, Saldo) ──────────────────────
export function drawZusammenfassung(
  page: PDFPage,
  kostenTotal: number,
  akontoTotal: number,
  saldo: number,
  startY: number,
  fontR: PDFFont,
  fontB: PDFFont
): number {
  let y = startY;
  const saldoTyp = saldo >= 0 ? "Guthaben" : "Nachzahlung";
  const saldoBetrag = Math.abs(saldo);

  txt(page, "Zusammenfassung", ML, y, fontB, 11, NAVY);
  y -= 16;

  const rows = [
    { label: "Gesamtkosten (umlagefähig)", value: formatCHF(kostenTotal), color: DARK },
    { label: "Akontozahlungen", value: formatCHF(akontoTotal), color: DARK },
  ];

  for (const row of rows) {
    box(page, ML, y, BW, 14, FILL_BG);
    txt(page, row.label, ML + 6, y - 4, fontR, 8.5, DARK);
    const valW = fontB.widthOfTextAtSize(row.value, 9);
    txt(page, row.value, MR - valW - 6, y - 4, fontB, 9, row.color);
    y -= 14;
  }

  // Saldo row (highlighted)
  const saldoColor = saldo >= 0 ? GREEN : RED;
  box(page, ML, y, BW, 18, saldo >= 0 ? rgb(0.92, 0.98, 0.93) : rgb(0.98, 0.92, 0.92));
  txt(page, saldoTyp, ML + 6, y - 6, fontB, 10, saldoColor);
  const saldoStr = `${saldo >= 0 ? "+" : "−"}${formatCHF(saldoBetrag)}`;
  const saldoW = fontB.widthOfTextAtSize(saldoStr, 12);
  txt(page, saldoStr, MR - saldoW - 6, y - 6, fontB, 12, saldoColor);
  y -= 24;

  return y;
}

// ── Payment Instructions Block ─────────────────────────────────
export function drawZahlungshinweis(
  page: PDFPage,
  bankkonto: { iban: string; bank_name: string; qr_iban?: string } | null,
  zahlungsfrist: string,
  saldo: number,
  startY: number,
  fontR: PDFFont,
  fontB: PDFFont
): number {
  // Only show payment instructions for Nachzahlung
  if (saldo >= 0) return startY;

  let y = startY;
  const saldoBetrag = Math.abs(saldo);

  txt(page, "Zahlungsinformationen", ML, y, fontB, 10, NAVY);
  y -= 14;

  box(page, ML, y, BW, 55, rgb(0.97, 0.98, 1.0));
  let txY = y - 4;

  txt(page, "Nachzahlungsbetrag:", ML + 6, txY, fontR, 8, GRAY);
  txt(page, `CHF ${formatCHF(saldoBetrag)}`, ML + 130, txY, fontB, 9, RED);
  txY -= 14;

  txt(page, "Zahlbar bis:", ML + 6, txY, fontR, 8, GRAY);
  txt(page, zahlungsfrist, ML + 130, txY, fontB, 9, DARK);
  txY -= 14;

  if (bankkonto) {
    txt(page, "IBAN:", ML + 6, txY, fontR, 8, GRAY);
    txt(page, bankkonto.iban, ML + 130, txY, fontR, 8, DARK);
    txY -= 14;
    txt(page, "Bank:", ML + 6, txY, fontR, 8, GRAY);
    txt(page, bankkonto.bank_name, ML + 130, txY, fontR, 8, DARK);
  }

  y -= 60;
  return y;
}

// ── Legal Notices Block ────────────────────────────────────────
export function drawRechtlicheHinweise(
  page: PDFPage,
  periode_von: string,
  periode_bis: string,
  startY: number,
  fontR: PDFFont,
  fontB: PDFFont
): number {
  let y = startY;

  drawHR(page, ML, y, MR, 0.5);
  y -= 12;

  txt(page, "Rechtliche Hinweise", ML, y, fontB, 9, NAVY);
  y -= 14;

  const hinweise = [
    `Abrechnungsperiode: ${new Date(periode_von).toLocaleDateString("de-CH")} – ${new Date(periode_bis).toLocaleDateString("de-CH")}`,
    "Die Belege können während 14 Tagen bei der Verwaltung eingesehen werden (Art. 257d Abs. 4 OR).",
    "Eine allfällige Nachzahlung ist innerhalb von 30 Tagen nach Empfang dieser Abrechnung fällig.",
    "Bei Guthaben wird der Betrag mit der nächsten Miete verrechnet.",
    "Einsprachen sind schriftlich an die Verwaltung zu richten.",
  ];

  for (const h of hinweise) {
    y = drawWrappedText(page, `• ${h}`, ML + 4, y, BW - 8, fontR, 7.5, 10, GRAY);
    y -= 4;
  }

  return y;
}

// ── Footer ────────────────────────────────────────────────────
export function drawFooter(
  page: PDFPage,
  text: string,
  fontR: PDFFont
) {
  txt(page, text, ML, 28, fontR, 7, GRAY);
}

// ── Date & Reference Block ────────────────────────────────────
export function drawDatumszeile(
  page: PDFPage,
  fontR: PDFFont,
  fontB: PDFFont,
  startY?: number
): number {
  const y = startY ?? PAGE_H - 120;
  const datum = new Date().toLocaleDateString("de-CH");

  txt(page, `Oetwil an der Limmat, ${datum}`, MR - fontR.widthOfTextAtSize(datum, 9) - 50, y, fontR, 9, DARK);
  return y - 16;
}

// ── Page Number ────────────────────────────────────────────────
export function drawSeitennummer(
  page: PDFPage,
  current: number,
  total: number,
  fontR: PDFFont
) {
  const text = `Seite ${current} / ${total}`;
  const w = fontR.widthOfTextAtSize(text, 7);
  txt(page, text, MR - w, 28, fontR, 7, GRAY);
}