import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

export interface QRRechnungInput {
  // Empfänger (Zahlungsempfänger = Verwalter)
  empfaenger_name: string;
  empfaenger_strasse: string;
  empfaenger_plz: string;
  empfaenger_ort: string;
  iban: string;

  // Zahlungspflichtiger (Mieter)
  zahler_name: string;
  zahler_strasse: string;
  zahler_plz: string;
  zahler_ort: string;

  // Betrag & Verwendungszweck
  betrag: number;
  waehrung: "CHF" | "EUR";
  mitteilung: string;

  // Referenznummer (optional, 27-stellig für QRR, leer für NON)
  referenz?: string;
}

function formatIBAN(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase();
}

function buildQRData(input: QRRechnungInput): string {
  const iban = formatIBAN(input.iban);
  const hasRef = input.referenz && input.referenz.trim().length > 0;
  const refType = hasRef ? "QRR" : "NON";
  const ref = hasRef ? input.referenz!.replace(/\s/g, "") : "";

  // Swiss QR Bill Payload (SPS 2.0)
  const lines = [
    "SPC",                          // QR-Typ
    "0200",                         // Version
    "1",                            // Coding
    iban,                           // IBAN Empfänger
    "K",                            // Adresstyp Empfänger
    input.empfaenger_name,
    input.empfaenger_strasse,
    `${input.empfaenger_plz} ${input.empfaenger_ort}`,
    "",                             // PLZ (leer wenn K-Typ)
    "",                             // Ort (leer wenn K-Typ)
    "CH",                           // Land Empfänger
    "",                             // NICHT mehr Endempfänger (leer)
    "", "", "", "", "", "",         // 6x leer
    input.betrag.toFixed(2),        // Betrag
    input.waehrung,
    "K",                            // Adresstyp Zahlungspflichtiger
    input.zahler_name,
    input.zahler_strasse,
    `${input.zahler_plz} ${input.zahler_ort}`,
    "",
    "",
    "CH",                           // Land Zahlungspflichtiger
    refType,                        // Referenztyp
    ref,                            // Referenz
    input.mitteilung,               // Mitteilung
    "EPD",                          // Ende-Markierung
  ];

  return lines.join("\n");
}

function formatCHF(n: number): string {
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input: QRRechnungInput = await req.json();

  // QR-Code als Data-URL generieren
  const qrData = buildQRData(input);
  const qrDataUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: "M",
    width: 400,
    margin: 0,
    color: { dark: "#000000", light: "#ffffff" },
  });

  // PDF erstellen (A4)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const gray = rgb(0.5, 0.5, 0.5);
  const black = rgb(0, 0, 0);
  const navy = rgb(0.06, 0.13, 0.25);

  // ── RECHNUNGSTEIL (oben) ────────────────────────────────────

  // Header
  page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: navy });
  page.drawText("Inovimmo", { x: 40, y: height - 38, size: 18, font: fontBold, color: rgb(1,1,1) });
  page.drawText("Swiss Property Intelligence", { x: 40, y: height - 52, size: 9, font: fontRegular, color: rgb(0.7,0.8,1) });

  // Rechnungstitel
  page.drawText("ZAHLUNGSAUFFORDERUNG", { x: 40, y: height - 90, size: 11, font: fontBold, color: navy });

  // Empfänger-Adresse (oben rechts)
  const zahlerLines = [input.zahler_name, input.zahler_strasse, `${input.zahler_plz} ${input.zahler_ort}`];
  zahlerLines.forEach((line, i) => {
    page.drawText(line, { x: 380, y: height - 90 - i * 14, size: 10, font: i === 0 ? fontBold : fontRegular, color: black });
  });

  // Absender (Verwalter)
  page.drawText(input.empfaenger_name, { x: 40, y: height - 115, size: 9, font: fontRegular, color: gray });
  page.drawText(input.empfaenger_strasse, { x: 40, y: height - 126, size: 9, font: fontRegular, color: gray });
  page.drawText(`${input.empfaenger_plz} ${input.empfaenger_ort}`, { x: 40, y: height - 137, size: 9, font: fontRegular, color: gray });
  page.drawText(`IBAN: ${input.iban}`, { x: 40, y: height - 148, size: 9, font: fontRegular, color: gray });

  // Linie
  page.drawLine({ start: { x: 40, y: height - 170 }, end: { x: width - 40, y: height - 170 }, thickness: 0.5, color: rgb(0.85,0.85,0.85) });

  // Verwendungszweck + Betrag
  page.drawText("Verwendungszweck", { x: 40, y: height - 195, size: 8, font: fontRegular, color: gray });
  page.drawText(input.mitteilung, { x: 40, y: height - 208, size: 11, font: fontBold, color: black });

  page.drawText("Zahlbar bis", { x: 300, y: height - 195, size: 8, font: fontRegular, color: gray });
  const faellig = new Date(); faellig.setDate(faellig.getDate() + 30);
  page.drawText(faellig.toLocaleDateString("de-CH"), { x: 300, y: height - 208, size: 11, font: fontBold, color: black });

  page.drawText("Betrag", { x: 40, y: height - 240, size: 8, font: fontRegular, color: gray });
  page.drawText(`CHF ${formatCHF(input.betrag)}`, { x: 40, y: height - 256, size: 22, font: fontBold, color: navy });

  // ── TRENNLINIE (Perforierung) ────────────────────────────────
  const cutY = 297; // 105mm von unten = Trennlinie QR-Rechnung
  // Gestrichelte Linie
  for (let x = 0; x < width; x += 8) {
    page.drawLine({ start: { x, y: cutY }, end: { x: x + 4, y: cutY }, thickness: 0.5, color: rgb(0.7,0.7,0.7) });
  }
  page.drawText("Hier trennen", { x: width / 2 - 25, y: cutY + 4, size: 7, font: fontRegular, color: gray });

  // ── QR-ZAHLUNGSTEIL (unten 105mm) ────────────────────────────
  const qrY = cutY - 10;

  // "Zahlteil" Titel
  page.drawText("Zahlteil", { x: 40, y: qrY - 14, size: 11, font: fontBold, color: black });
  page.drawText("Empfangsschein", { x: 390, y: qrY - 14, size: 9, font: fontBold, color: black });

  // QR-Code einbetten
  const qrImageBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  const qrSize = 140;
  page.drawImage(qrImage, { x: 40, y: qrY - 30 - qrSize, width: qrSize, height: qrSize });

  // Schweizer Kreuz im QR-Code (weisses Rechteck mit Kreuz)
  const crossX = 40 + qrSize / 2 - 9;
  const crossY = qrY - 30 - qrSize / 2 - 9;
  page.drawRectangle({ x: crossX, y: crossY, width: 18, height: 18, color: rgb(1,1,1) });
  page.drawRectangle({ x: crossX + 7, y: crossY + 2, width: 4, height: 14, color: rgb(0.8,0,0) });
  page.drawRectangle({ x: crossX + 2, y: crossY + 7, width: 14, height: 4, color: rgb(0.8,0,0) });

  // Zahlteil Details
  const detailX = 200;
  const labelSize = 7;
  const valueSize = 10;
  let detailY = qrY - 30;

  const drawDetail = (label: string, value: string) => {
    page.drawText(label, { x: detailX, y: detailY, size: labelSize, font: fontRegular, color: gray });
    detailY -= 13;
    page.drawText(value, { x: detailX, y: detailY, size: valueSize, font: fontBold, color: black });
    detailY -= 16;
  };

  drawDetail("Konto / Zahlbar an", input.iban);
  drawDetail("Zahlungspflichtiger", `${input.zahler_name}, ${input.zahler_strasse}, ${input.zahler_plz} ${input.zahler_ort}`);
  if (input.referenz) drawDetail("Referenz", input.referenz);
  drawDetail("Zusätzliche Informationen", input.mitteilung);
  drawDetail("Währung", input.waehrung);
  drawDetail("Betrag", `CHF ${formatCHF(input.betrag)}`);

  // Empfangsschein rechts
  const esX = 390;
  let esY = qrY - 30;
  const drawES = (label: string, value: string) => {
    page.drawText(label, { x: esX, y: esY, size: labelSize, font: fontRegular, color: gray });
    esY -= 12;
    page.drawText(value.length > 28 ? value.slice(0, 28) + "…" : value, { x: esX, y: esY, size: 8, font: fontBold, color: black });
    esY -= 14;
  };

  drawES("Konto", input.iban);
  drawES("Zahlbar an", input.empfaenger_name);
  drawES("Betrag", `CHF ${formatCHF(input.betrag)}`);
  drawES("Zahlungspflichtiger", input.zahler_name);

  // Akzeptanzfeld
  page.drawText("Annahmestelle", { x: esX, y: cutY + 20, size: 7, font: fontRegular, color: gray });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="QR-Rechnung_${input.zahler_name.replace(/\s/g,"_")}.pdf"`,
    },
  });
}
