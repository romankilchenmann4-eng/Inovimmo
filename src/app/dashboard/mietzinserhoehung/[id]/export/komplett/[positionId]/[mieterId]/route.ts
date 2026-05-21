import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { generateFormularPdf, generateEinschreibenPdf } from '@/lib/mietzinserhoehung/pdf';

type RouteProps = {
  params: Promise<{
    id: string;
    positionId: string;
    mieterId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { id, positionId, mieterId } = await params;

  try {
    const [einschreibenBytes, formularBytes] = await Promise.all([
      generateEinschreibenPdf(id, positionId, mieterId),
      generateFormularPdf(id, positionId, mieterId),
    ]);

    const mergedDoc = await PDFDocument.create();

    // Einschreiben pages first
    const einschreibenDoc = await PDFDocument.load(einschreibenBytes);
    const einschreibenPages = await mergedDoc.copyPages(
      einschreibenDoc,
      einschreibenDoc.getPageIndices(),
    );
    for (const page of einschreibenPages) {
      mergedDoc.addPage(page);
    }

    // Formular pages after
    const formularDoc = await PDFDocument.load(formularBytes);
    const formularPages = await mergedDoc.copyPages(
      formularDoc,
      formularDoc.getPageIndices(),
    );
    for (const page of formularPages) {
      mergedDoc.addPage(page);
    }

    const pdfBytes = await mergedDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="komplett-mietzinserhoehung-${positionId}-${mieterId}.pdf"`,
      },
    });
  } catch (e: any) {
    return new NextResponse(e.message || 'Fehler beim Generieren', { status: 404 });
  }
}