// Mietzinserhoehung — Shared PDF generation functions
// Used by formular, einschreiben, and komplett routes

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

  // Validate mieter belongs to this wohnung
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

  // PAGE 1 — Mieter
  drawMultiline(page1, mieterName, 85, 655, font, 10);
  if (mieter?.strasse) drawText(page1, mieter.strasse, 85, 643, font, 9);
  if (mieter?.plz && mieter?.ort) drawText(page1, `${mieter.plz} ${mieter.ort}`, 85, 631, font, 9);

  // PAGE 1 — Eigentümer/Vermieter
  drawMultiline(page1, eigentuemerName, 85, 535, font, 10);
  if (erhoehung.eigentuemer_adresse) drawText(page1, erhoehung.eigentuemer_adresse, 85, 523, font, 9);
  if (erhoehung.eigentuemer_ort) drawText(page1, erhoehung.eigentuemer_ort, 85, 511, font, 9);

  drawText(page1, 'X', 231, 425, bold, 12);

  drawText(page1, `${liegenschaftAdresse} / ${wohnungText}`, 158, 395, font, 10);

  drawText(page1, 'X', 196, 351, bold, 12);

  drawText(page1, chf(alteMiete), 340, 272, font, 10);
  drawText(page1, chf(neueMiete), 485, 272, font, 10);

  drawText(page1, chf(alteNk), 340, 239, font, 10);
  drawText(page1, chf(neueNk), 485, 239, font, 10);

  drawText(page1, chf(alteBrutto), 405, 128, bold, 11);
  drawText(page1, chf(neueBrutto), 573, 128, bold, 11);

  drawMultiline(page1, begruendung, 85, 83, font, 9, 95);

  // PAGE 2
  const datumsOrt = erhoehung.eigentuemer_ort || 'Dällikon';
  drawText(page2, `${datumsOrt}, ${new Date().toLocaleDateString('de-CH')}`, 80, 735, font, 10);

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

  if (Number(erhoehung.foerderbeitraege || 0) > 0) {
    drawText(page2, 'X', 92, 386, bold, 12);
  } else {
    drawText(page2, 'X', 137, 386, bold, 12);
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

  // Subject — bold
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

    // Section headings (numbered like "1.", "2.", etc.)
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