import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: erhoehung } = await supabase
    .from('mietzins_erhoehungen')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data: positionen } = await supabase
    .from('mietzins_erhoehung_positionen')
    .select('*')
    .eq('mietzins_erhoehung_id', id);

  const wohnungIds = (positionen ?? [])
    .map((p: any) => p.wohnung_id)
    .filter(Boolean);

  const { data: wohnungen } = wohnungIds.length
    ? await supabase
        .from('wohnungen')
        .select('*')
        .in('id', wohnungIds)
    : { data: [] };

  const wohnungMap = new Map(
    (wohnungen ?? []).map((w: any) => [w.id, w])
  );

  const html = `
  <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #111;
        }

        h1 {
          margin-bottom: 4px;
        }

        .muted {
          color: #666;
          margin-bottom: 24px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          font-size: 12px;
          text-align: left;
        }

        th {
          background: #f5f5f5;
        }

        .right {
          text-align: right;
        }
      </style>
    </head>

    <body>
      <h1>${erhoehung?.titel ?? 'Mietzinserhöhung'}</h1>

      <div class="muted">
        Status: ${erhoehung?.status ?? 'entwurf'}
      </div>

      <table>
        <thead>
          <tr>
            <th>Wohnung</th>
            <th>Alte Miete</th>
            <th>Erhöhung / Mt.</th>
            <th>Neue Miete</th>
            <th>Anteil %</th>
          </tr>
        </thead>

        <tbody>
          ${(positionen ?? [])
            .map((p: any) => {
              const w: any = wohnungMap.get(p.wohnung_id);

              const wohnung =
                [w?.whg_nr, w?.bezeichnung]
                  .filter(Boolean)
                  .join(' · ') || p.wohnung_id;

              return `
                <tr>
                  <td>${wohnung}</td>
                  <td class="right">CHF ${Number(
                    p.miete_alt || 0
                  ).toFixed(2)}</td>
                  <td class="right">CHF ${Number(
                    p.erhoehung_monatlich || 0
                  ).toFixed(2)}</td>
                  <td class="right">CHF ${Number(
                    p.miete_neu || 0
                  ).toFixed(2)}</td>
                  <td class="right">${Number(
                    p.verteilschluessel_prozent || 0
                  ).toFixed(2)}%</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </body>
  </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
