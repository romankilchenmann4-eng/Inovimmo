// Mietzinserhoehung — Shared PDF generation functions
// Used by formular, einschreiben, and komplett routes
// Form field positions extracted from Formular-Mietzinserhoehung.pdf

import { createClient } from '@/lib/supabase/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import {
  DARK, GRAY, PAGE_W, PAGE_H, ML, MR, BW,
  drawHR, txt, drawWrappedText,
  drawKuvertfensterAdresse, drawAbsenderzeile,
  drawFooter,
} from '@/lib/nebenkostenabrechnung/pdf-helpers';
import { generiereEinschreibenBrief, type MietzinsErhoehungBriefDaten } from './templates';

type DataResult = {
  erhoehung: any;
  position: any;
  wohnung: any;
  liegenschaft: any;
  mieter: any;
};

async function fetchData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  erhoehungId: string,
  positionId: string,
  mieterId: string,
): Promise<DataResult> {
  const { data: erhoehung } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', erhoehungId)
    .maybeSingle();

  const { data: position } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('id', positionId)
    .eq('mietzins_erhoehung_id', erhoehungId)
    .maybeSingle();

  if (!erhoehung || !position) {
    throw new Error('Datensatz nicht gefunden');
  }

  const { data: wohnung } = await supabase
    .from('wohnungen')
    .select('*')
    .eq('id', position.wohnung_id)
    .maybeSingle();

  const { data: liegenschaft } = await supabase
    .from('liegenschaften')
    .select('*')
    .eq('id', erhoehung.liegenschaft_id)
    .maybeSingle();

  const { data: mieter } = await supabase
    .from('mieter')
    .select('id, vorname, nachname, strasse, plz, ort')
    .eq('id', mieterId)
    .maybeSingle();

  const { data: mietverhaeltnis } = await supabase
    .from('mietverhaeltnisse')
    .select('id')
    .eq('wohnung_id', position.wohnung_id)
    .eq('mieter_id', mieterId)
    .is('mietende', null)
    .maybeSingle();

  if (!mietverhaeltnis) {
    throw new Error('Mieter nicht dieser Wohnung zugeordnet');
  }

  return { erhoehung, position, wohnung, liegenschaft, mieter };
}

function chf(value: number) {
  if (value === undefined || value === null) return '0.00';
  return value.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function drawText(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  size: number,
) {
  page.drawText(text ?? '', { x, y, size, font, color: rgb(0, 0, 0) });
}

function drawMultiline(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  size: number,
  maxChars = 45,
) {
  const words = String(text ?? '').split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }

  if (line) lines.push(line);

  lines.slice(0, 5).forEach((l, index) => {
    page.drawText(l, {
      x,
      y: y - index * (size + 3),
      size,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

export async function generateFormularPdf(
  erhoehungId: string,
  positionId: string,
  mieterId: string,
): Promise<Uint8Array> {
  const supabase = await createClient();
  const { erhoehung, position, wohnung, liegenschaft, mieter } = await fetchData(supabase, erhoehungId, positionId, mieterId);

  const mieterName = mieter
    ? `${mieter.vorname} ${mieter.nachname}`
    : 'Mieter/in';

  const templatePath = path.join(
    process.cwd(),
    'public',
    'forms',
    'Formular-Mietzinserhoehung.pdf',
  );

  const templateBytes = await readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const page2 = pages[1];

  const alteMiete = Number(position.miete_alt || 0);
  const neueMiete = Number(position.miete_neu || 0);
  const alteNk = Number(position.nebenkosten_alt || 0);
  const neueNk = Number(position.nebenkosten_neu || alteNk || 0);
  const alteBrutto = alteMiete + alteNk;
  const neueBrutto = neueMiete + neueNk;
  const erhoehungMonat = Number(
    position.erhoehung_monatlich || position.erhoehung_betrag || 0,
  );

  const eigentuemerName = erhoehung.eigentuemer_name || 'Inovimmo Verwaltung';

  const liegenschaftAdresse = [
    liegenschaft?.strasse,
    liegenschaft?.hausnummer,
    liegenschaft?.plz,
    liegenschaft?.ort,
  ]
    .filter(Boolean)
    .join(' ');

  const wohnungText = [wohnung?.whg_nr, wohnung?.bezeichnung]
    .filter(Boolean)
    .join(' · ');

  const begruendung =
    position.begruendung ||
    'Mietzinserhöhung infolge wertvermehrender Investitionen und Kostensteigerungen.';

  // ============================================================
  // PAGE 1 — Formularfelder basierend auf echten PDF-Feldkoordinaten
  // ============================================================

  // EMPFÄNGER (Mieter) — Linkes Kuvertfenster
  // Feld: "Einschreiben Feld Adresseingabe LINKS 4" [x=59, y=588, w=232, h=113]
  drawText(page1, mieterName, 65, 685, font, 10);
  if (mieter?.strasse) drawText(page1, mieter.strasse, 65, 670, font, 9);
  if (mieter?.plz && mieter?.ort) drawText(page1, `${mieter.plz} ${mieter.ort}`, 65, 655, font, 9);

  // ABSENDER / VERMIETER — Rechtes Kuvertfenster
  // Feld: "Einschreiben Feld Adresseingabe 1 RECHTS 4" [x=306, y=588, w=232, h=113]
  // Absender = Vermieter (Kurt Rusch)
  drawText(page1, eigentuemerName, 312, 685, font, 10);
  if (erhoehung.eigentuemer_adresse) drawText(page1, erhoehung.eigentuemer_adresse, 312, 670, font, 9);
  if (erhoehung.eigentuemer_ort) drawText(page1, erhoehung.eigentuemer_ort, 312, 655, font, 9);

  // ABSENDER/IN Textfeld — unterhalb der Fenster
  // Feld: "Absender/in Text Eingabefeld 4" [x=59, y=491, w=234, h=61]
  const absenderLines = [
    eigentuemerName,
    erhoehung.eigentuemer_adresse,
    erhoehung.eigentuemer_ort,
  ].filter(Boolean);
  absenderLines.forEach((line, i) => {
    if (line) drawText(page1, line, 65, 540 - i * 14, font, 9);
  });

  // KONTROLLKÄSTCHEN 1: Mietzinserhöhung
  // Feld: "Kontrollkästchen 1" [x=161, y=409, w=12, h=12]
  drawText(page1, 'X', 164, 411, bold, 12);

  // LIEGENSCHAFT — Adresse und Wohnung
  // Feld: "Textfeld 4" [x=110, y=393, w=429, h=12]
  drawText(page1, `${liegenschaftAdresse} / ${wohnungText}`, 115, 397, font, 10);

  // KONTROLLKÄSTCHEN 3: Wohnung
  // Feld: "Kontrollkästchen 3" [x=134, y=342, w=12, h=12]
  drawText(page1, 'X', 137, 344, bold, 12);

  // FINANZTABELLE — Nettomietzins (Zeile 1)
  // Textfeld 7 (bisher): [x=235, y=282, w=84, h=13]
  // Textfeld 8 (neu ab): [x=350, y=282, w=84, h=13]
  drawText(page1, chf(alteMiete), 240, 286, font, 10);
  drawText(page1, chf(neueMiete), 355, 286, font, 10);

  // FINANZTABELLE — Nebenkosten (Zeile 2)
  // Textfeld 10 (bisher): [x=235, y=253, w=84, h=13]
  // Textfeld 11 (neu ab): [x=350, y=253, w=84, h=13]
  drawText(page1, chf(alteNk), 240, 257, font, 10);
  drawText(page1, chf(neueNk), 355, 257, font, 10);

  // FINANZTABELLE — Total Bruttomiete
  // Textfeld 30 (bisher): [x=235, y=143, w=84, h=15]
  // Textfeld 31 (neu ab): [x=350, y=143, w=84, h=15]
  drawText(page1, chf(alteBrutto), 240, 148, bold, 11);
  drawText(page1, chf(neueBrutto), 355, 148, bold, 11);

  // BEGRÜNDUNG — 4 Zeilen
  // Textfeld 32: [x=59, y=100, w=480, h=12]
  // Textfeld 76: [x=59, y=84, w=480, h=12]
  // Textfeld 74: [x=59, y=69, w=480, h=12]
  // Textfeld 75: [x=59, y=53, w=480, h=12]
  const begruendungWords = String(begruendung).split(/\s+/);
  const begruendungLines: string[] = [];
  let bLine = '';
  for (const word of begruendungWords) {
    if ((bLine + ' ' + word).trim().length > 80) {
      begruendungLines.push(bLine);
      bLine = word;
    } else {
      bLine = (bLine + ' ' + word).trim();
    }
  }
  if (bLine) begruendungLines.push(bLine);

  const begruendungYPositions = [104, 88, 73, 57];
  begruendungLines.slice(0, 4).forEach((l, i) => {
    drawText(page1, l, 65, begruendungYPositions[i], font, 9);
  });

  // ============================================================
  // PAGE 2
  // ============================================================

  // ORT UND DATUM — Zeile 1
  // Textfeld 70: [x=199, y=738, w=339, h=14]
  const datumsOrt = erhoehung.eigentuemer_ort || 'Dällikon';
  drawText(page2, `${datumsOrt}, ${new Date().toLocaleDateString('de-CH')}`, 205, 742, font, 10);

  // UMSCHREIBUNG DER ÄNDERUNG — Freitextbereich
  // Zwischen Textfeld 72 (y=708) und Unterschriftsbereich (y=620)
  drawMultiline(
    page2,
    `Erhöhung des Nettomietzinses um ${chf(erhoehungMonat)} pro Monat.`,
    80,
    660,
    font,
    10,
    100,
  );

  drawMultiline(page2, begruendung, 80, 585, font, 10, 100);

  drawText(
    page2,
    erhoehung.inkrafttreten
      ? String(erhoehung.inkrafttreten)
      : 'auf den nächstmöglichen Kündigungstermin',
    80,
    505,
    font,
    10,
  );

  // FÖRDERBEITRÄGE Ja/Nein
  // Kontrollkästchen 42 (Ja): [x=369, y=786, w=12, h=12]
  // Kontrollkästchen 43 (Nein): [x=406, y=786, w=12, h=12]
  if (Number(erhoehung.foerderbeitraege || 0) > 0) {
    drawText(page2, 'X', 372, 788, bold, 12);
  } else {
    drawText(page2, 'X', 409, 788, bold, 12);
  }

  return pdfDoc.save();
}

export async function generateEinschreibenPdf(
  erhoehungId: string,
  positionId: string,
  mieterId: string,
): Promise<Uint8Array> {
  const supabase = await createClient();
  const { erhoehung, position, wohnung, liegenschaft, mieter } = await fetchData(supabase, erhoehungId, positionId, mieterId);

  const mieterName = mieter
    ? `${mieter.vorname} ${mieter.nachname}`
    : 'Mieter/in';

  const mieterAdressLines = mieter
    ? [mieter.strasse, `${mieter.plz} ${mieter.ort}`].filter(Boolean)
    : ['Adresse unbekannt'];

  const eigentuemerName = erhoehung.eigentuemer_name || 'Inovimmo Verwaltung';
  const absenderLine = [
    eigentuemerName,
    erhoehung.eigentuemer_adresse,
    erhoehung.eigentuemer_ort,
  ].filter(Boolean).join(' · ');

  const liegenschaftAdresse = [
    liegenschaft?.strasse,
    liegenschaft?.hausnummer,
    liegenschaft?.plz,
    liegenschaft?.ort,
  ].filter(Boolean).join(' ');

  const liegenschaftName = liegenschaft?.name || liegenschaftAdresse || '–';

  const wohnungText = [wohnung?.whg_nr, wohnung?.bezeichnung]
    .filter(Boolean)
    .join(' · ');

  const alteMiete = Number(position.miete_alt || 0);
  const neueMiete = Number(position.miete_neu || 0);
  const alteNk = Number(position.nebenkosten_alt || 0);
  const neueNk = Number(position.nebenkosten_neu || alteNk || 0);
  const erhoehungMonat = Number(position.erhoehung_monatlich || position.erhoehung_betrag || 0);

  const erhoehungProzent = alteMiete > 0
    ? ((erhoehungMonat / alteMiete) * 100).toFixed(1)
    : '–';

  const begruendung =
    position.begruendung ||
    'Mietzinserhöhung infolge wertvermehrender Investitionen und allgemeiner Kostensteigerungen.';

  const datumsOrt = erhoehung.eigentuemer_ort || 'Dällikon';
  const datumStr = new Date().toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });

  const briefDaten: MietzinsErhoehungBriefDaten = {
    mieter_anrede: mieter?.nachname
      ? `Sehr geehrte/r Frau/Herr ${mieter.nachname}`
      : 'Sehr geehrte Damen und Herren',
    mieter_name: mieterName,
    wohnung_bezeichnung: wohnungText || '–',
    liegenschaft_adresse: liegenschaftAdresse || '–',
    liegenschaft_name: liegenschaftName,
    miete_alt: chf(alteMiete),
    miete_neu: chf(neueMiete),
    nebenkosten_alt: chf(alteNk),
    nebenkosten_neu: chf(neueNk),
    brutto_alt: chf(alteMiete + alteNk),
    brutto_neu: chf(neueMiete + neueNk),
    erhoehung_monatlich: chf(erhoehungMonat),
    erhoehung_prozent: erhoehungProzent,
    inkrafttreten: erhoehung.inkrafttreten
      ? String(erhoehung.inkrafttreten)
      : 'auf den nächstmöglichen Kündigungstermin',
    eigentuemer_name: eigentuemerName,
    eigentuemer_adresse: erhoehung.eigentuemer_adresse || '',
    eigentuemer_ort: erhoehung.eigentuemer_ort || '',
    begruendung: begruendung,
    datum_ort: `${datumsOrt}, ${datumStr}`,
    datum: datumStr,
  };

  const briefText = generiereEinschreibenBrief(briefDaten);

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

  // Date — right-aligned
  y = 690 - 20;
  const dateLine = `${datumsOrt}, ${datumStr}`;
  const dateW = fontR.widthOfTextAtSize(dateLine, 9);
  txt(page, dateLine, MR - dateW, y, fontR, 9, DARK);
  y -= 30;

  // Subject — bold with horizontal rule
  txt(page, 'Mitteilung der Mietzinserhöhung gemäss Art. 269d OR', ML, y, fontB, 11, DARK);
  y -= 4;
  drawHR(page, ML, y, MR);
  y -= 14;

  // Body
  const lines = briefText.split('\n');
  for (const line of lines) {
    if (y < 80) {
      drawFooter(page, `Einschreiben · ${liegenschaftName} · ${wohnungText}`, fontR);
      const newPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 40;
    }

    const isHeading = /^\d+\.\s/.test(line.trim());
    if (isHeading) {
      y -= 4;
      txt(page, line, ML, y, fontB, 9.5, DARK);
      y -= 14;
    } else if (line.startsWith('–') || line.startsWith('Beilagen')) {
      txt(page, line, ML, y, fontR, 9.5, DARK);
      y -= 14;
    } else if (line.trim() === '') {
      y -= 6;
    } else {
      y = drawWrappedText(page, line, ML, y, BW, fontR, 9.5, 14, DARK);
    }
  }

  // Signature area
  y -= 20;
  txt(page, 'Freundliche Grüsse', ML, y, fontR, 9.5, DARK);
  y -= 30;
  txt(page, eigentuemerName, ML, y, fontB, 10, DARK);
  y -= 14;
  if (erhoehung.eigentuemer_adresse) txt(page, erhoehung.eigentuemer_adresse, ML, y, fontR, 9, GRAY);
  y -= 13;
  if (erhoehung.eigentuemer_ort) txt(page, erhoehung.eigentuemer_ort, ML, y, fontR, 9, GRAY);

  // Footer
  drawFooter(page, `Einschreiben · ${liegenschaftName} · ${wohnungText}`, fontR);

  return pdfDoc.save();
}