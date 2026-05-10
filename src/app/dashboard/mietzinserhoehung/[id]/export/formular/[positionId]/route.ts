import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';

type RouteProps = {
  params: Promise<{
    id: string;
    positionId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { id, positionId } = await params;
  const supabase = await createClient();

  const { data: erhoehung } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data: position } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('id', positionId)
    .eq('mietzins_erhoehung_id', id)
    .maybeSingle();

  if (!erhoehung || !position) {
    return new NextResponse('Datensatz nicht gefunden', { status: 404 });
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

  const { data: mietverhaeltnisse } = await supabase
    .from('mietverhaeltnisse')
    .select(`
      wohnung_id,
      ist_hauptperson,
      ist_vertragspartner,
      mieter:mieter_id (
        id, vorname, nachname, email
      )
    `)
    .eq('wohnung_id', position.wohnung_id);

  const mieterNamen =
    (mietverhaeltnisse ?? [])
      .map((mv: any) =>
        [mv.mieter?.vorname, mv.mieter?.nachname].filter(Boolean).join(' ')
      )
      .filter(Boolean)
      .join('\n') || 'Mieter/in';

  const templatePath = path.join(
    process.cwd(),
    'public',
    'forms',
    'Formular-Mietzinserhoehung.pdf'
  );

  const templateBytes = await readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const page2 = pages[1];

  const black = rgb(0, 0, 0);

  const alteMiete = Number(position.miete_alt || 0);
  const neueMiete = Number(position.miete_neu || 0);
  const alteNk = Number(position.nebenkosten_alt || 0);
  const neueNk = Number(position.nebenkosten_neu || alteNk || 0);
  const alteBrutto = alteMiete + alteNk;
  const neueBrutto = neueMiete + neueNk;
  const erhoehungMonat = Number(
    position.erhoehung_monatlich || position.erhoehung_betrag || 0
  );

  const liegenschaftAdresse = [
    liegenschaft?.strasse,
    liegenschaft?.hausnummer,
    liegenschaft?.plz,
    liegenschaft?.ort,
  ]
    .filter(Boolean)
    .join(' ');

  const wohnungText = [
    wohnung?.whg_nr,
    wohnung?.bezeichnung,
  ]
    .filter(Boolean)
    .join(' · ');

  const begruendung =
    position.begruendung ||
    'Mietzinserhöhung infolge wertvermehrender Investitionen und Kostensteigerungen.';

  // PAGE 1

  drawMultiline(page1, mieterNamen, 85, 655, font, 10);

  drawMultiline(
    page1,
    'Inovimmo Verwaltung',
    85,
    535,
    font,
    10
  );

  drawText(page1, 'X', 231, 425, bold, 12);

  drawText(
    page1,
    `${liegenschaftAdresse} / ${wohnungText}`,
    158,
    395,
    font,
    10
  );

  drawText(page1, 'X', 196, 351, bold, 12);

  drawText(page1, chf(alteMiete), 340, 272, font, 10);
  drawText(page1, chf(neueMiete), 485, 272, font, 10);

  drawText(page1, chf(alteNk), 340, 239, font, 10);
  drawText(page1, chf(neueNk), 485, 239, font, 10);

  drawText(page1, chf(alteBrutto), 405, 128, bold, 11);
  drawText(page1, chf(neueBrutto), 573, 128, bold, 11);

  drawMultiline(page1, begruendung, 85, 83, font, 9, 95);

  // PAGE 2

  drawText(page2, 'Dällikon, ' + new Date().toLocaleDateString('de-CH'), 80, 735, font, 10);

  drawMultiline(
    page2,
    `Erhöhung des Nettomietzinses um ${chf(erhoehungMonat)} pro Monat.`,
    80,
    660,
    font,
    10,
    100
  );

  drawMultiline(page2, begruendung, 80, 585, font, 10, 100);

  drawText(
    page2,
    erhoehung.inkrafttreten_ab
      ? String(erhoehung.inkrafttreten_ab)
      : 'auf den nächstmöglichen Kündigungstermin',
    80,
    505,
    font,
    10
  );

  if (Number(erhoehung.foerderbeitraege || 0) > 0) {
    drawText(page2, 'X', 92, 386, bold, 12);
  } else {
    drawText(page2, 'X', 137, 386, bold, 12);
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="amtliches-formular-${wohnung?.whg_nr ?? positionId}.pdf"`,
    },
  });
}

function drawText(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  size: number
) {
  page.drawText(text ?? '', {
    x,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawMultiline(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  size: number,
  maxChars = 45
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

function chf(value: number) {
  return Number(value || 0).toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
