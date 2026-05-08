import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createCalculation } from '@/lib/mietzinserhoehung/actions';

export default async function MietzinserhoehungPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: calculations } = await supabase
    .from('rent_increase_calculations')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mietzinserhöhungen</h1>
          <p className="text-muted-foreground mt-1">
            Berechnung und Verwaltung wertvermehrender Investitionen 
            nach Art. 269a OR / Art. 14 VMWG
          </p>
        </div>
        <form action={createCalculation}>
          <input type="hidden" name="title" value="Neue Berechnung" />
          <input type="hidden" name="reason" value="heating_replacement" />
          <Button type="submit">
            <Plus className="mr-2 h-4 w-4" />
            Neue Berechnung
          </Button>
        </form>
      </div>

      {!calculations?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Noch keine Berechnungen
            </h3>
            <p className="text-muted-foreground mb-4">
              Erstellen Sie Ihre erste Mietzinserhöhungs-Berechnung.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {calculations.map(calc => (
            <Link 
              key={calc.id} 
              href={`/dashboard/mietzinserhoehung/${calc.id}`}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5" />
                        {calc.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Erstellt am {new Date(calc.created_at).toLocaleDateString('de-CH')}
                      </p>
                    </div>
                    <StatusBadge status={calc.status} />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    draft: { label: 'Entwurf', variant: 'secondary' as const },
    calculated: { label: 'Berechnet', variant: 'default' as const },
    sent: { label: 'Versendet', variant: 'default' as const },
    challenged: { label: 'Angefochten', variant: 'destructive' as const },
    active: { label: 'Aktiv', variant: 'default' as const },
  }[status] ?? { label: status, variant: 'secondary' as const };
  
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
