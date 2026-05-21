import { NextResponse } from 'next/server';
import { generateFormularPdf } from '@/lib/mietzinserhoehung/pdf';

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
    const pdfBytes = await generateFormularPdf(id, positionId, mieterId);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="amtliches-formular-${positionId}-${mieterId}.pdf"`,
      },
    });
  } catch (e: any) {
    return new NextResponse(e.message || 'Fehler beim Generieren', { status: 404 });
  }
}