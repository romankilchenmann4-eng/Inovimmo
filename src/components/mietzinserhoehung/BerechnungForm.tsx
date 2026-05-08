'use client';

import { useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, TableBody, TableCell, TableFooter, 
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Calculator, FileText, Save, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { calculateRentIncrease } from '@/lib/mietzinserhoehung/calc';
import { 
  updateCalculation, 
  recalculateAndSave, 
  addAllocation, 
  deleteAllocation,
} from '@/lib/mietzinserhoehung/actions';
import type { 
  RentIncreaseCalculation, 
  RentIncreaseAllocation,
} from '@/lib/mietzinserhoehung/types';

interface Props {
  calculation: RentIncreaseCalculation;
  allocations: RentIncreaseAllocation[];
}

export function BerechnungForm({ calculation, allocations: initialAllocations }: Props) {
  const [calc, setCalc] = useState(calculation);
  const [allocations, setAllocations] = useState(initialAllocations);
  const [isPending, startTransition] = useTransition();

  // Live-Berechnung (clientseitig, ohne DB)
  const result = useMemo(() => calculateRentIncrease({
    investment_total: calc.investment_total,
    subsidies: calc.subsidies,
    value_added_pct: calc.value_added_pct,
    reference_rate: calc.reference_rate,
    surcharge: calc.surcharge,
    amortization_pct: calc.amortization_pct,
    maintenance_pct: calc.maintenance_pct,
    allocations: allocations.map(a => ({
      unit_label: a.unit_label,
      tenant_name: a.tenant_name,
      current_rent: a.current_rent,
      is_heated: a.is_heated,
    })),
  }), [calc, allocations]);

  function handleSave() {
    startTransition(async () => {
      try {
        await updateCalculation(calc.id, calc);
        await recalculateAndSave(calc.id);
        toast.success('Berechnung gespeichert');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern');
      }
    });
  }

  function fmt(n: number) {
    return n.toLocaleString('de-CH', { 
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Input
            value={calc.title}
            onChange={(e) => setCalc({ ...calc, title: e.target.value })}
            className="text-2xl font-bold border-0 px-0 focus-visible:ring-0"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Mietzinserhöhung gemäss Art. 269a OR / Art. 14 VMWG
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? 'Speichert...' : 'Speichern'}
        </Button>
      </div>

      <Tabs defaultValue="investition" className="space-y-4">
        <TabsList>
          <TabsTrigger value="investition">1. Investition</TabsTrigger>
          <TabsTrigger value="saetze">2. Sätze</TabsTrigger>
          <TabsTrigger value="verteilung">3. Verteilung</TabsTrigger>
          <TabsTrigger value="dokumente">4. Dokumente</TabsTrigger>
        </TabsList>

        {/* TAB 1: Investition */}
        <TabsContent value="investition">
          <Card>
            <CardHeader>
              <CardTitle>Investitionskosten</CardTitle>
              <CardDescription>
                Total der Investition, Förderbeiträge und wertvermehrender Anteil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Total Investition (CHF)</Label>
                  <Input
                    type="number"
                    value={calc.investment_total}
                    onChange={(e) => setCalc({ 
                      ...calc, investment_total: parseFloat(e.target.value) || 0,
                    })}
                  />
                </div>
                <div>
                  <Label>Förderbeiträge (CHF)</Label>
                  <Input
                    type="number"
                    value={calc.subsidies}
                    onChange={(e) => setCalc({ 
                      ...calc, subsidies: parseFloat(e.target.value) || 0,
                    })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Wertvermehrender Anteil in % (typ. 50–70 % bei Systemwechsel)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={calc.value_added_pct}
                    onChange={(e) => setCalc({ 
                      ...calc, value_added_pct: parseFloat(e.target.value) || 0,
                    })}
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Nettoinvestition:</span>
                  <span className="font-mono font-semibold">
                    CHF {fmt(result.netInvestment)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Wertvermehrender Anteil:</span>
                  <span className="font-mono font-semibold text-primary">
                    CHF {fmt(result.valueAddedAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Sätze */}
        <TabsContent value="saetze">
          <Card>
            <CardHeader>
              <CardTitle>Jährliche Kostensätze</CardTitle>
              <CardDescription>
                Verzinsung, Amortisation und Unterhalt nach VMWG.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Referenzzinssatz (%)</Label>
                  <Input
                    type="number" step="0.25"
                    value={calc.reference_rate}
                    onChange={(e) => setCalc({ 
                      ...calc, reference_rate: parseFloat(e.target.value) || 0,
                    })}
                  />
                </div>
                <div>
                  <Label>Zuschlag (%)</Label>
                  <Input
                    type="number" step="0.1"
                    value={calc.surcharge}
                    onChange={(e) => setCalc({ 
                      ...calc, surcharge: parseFloat(e.target.value) || 0,
                    })}
                  />
                </div>
                <div>
                  <Label>Amortisation (%)</Label>
                  <Input
                    type="number" step="0.5"
                    value={calc.amortization_pct}
                    onChange={(e) => setCalc({ 
                      ...calc, amortization_pct: parseFloat(e.target.value) || 0,
                    })}
                  />
                </div>
                <div>
                  <Label>Unterhalt (%)</Label>
                  <Input
                    type="number" step="0.1"
                    value={calc.maintenance_pct}
                    onChange={(e) => setCalc({ 
                      ...calc, maintenance_pct: parseFloat(e.target.value) || 0,
                    })}
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Gesamtsatz pro Jahr:</span>
                  <span className="font-mono font-semibold">
                    {result.totalRatePct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Jährliche Mehrbelastung:</span>
                  <span className="font-mono font-semibold">
                    CHF {fmt(result.yearlyIncrease)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Monatliche Mehrbelastung:</span>
                  <span className="font-mono font-semibold text-primary">
                    CHF {fmt(result.monthlyIncrease)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Verteilung */}
        <TabsContent value="verteilung">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Verteilung auf Mietobjekte</CardTitle>
                  <CardDescription>
                    Aufteilung nach aktuellem Nettomietzins.
                  </CardDescription>
                </div>
                <AddAllocationButton calculationId={calc.id} onAdded={(a) => 
                  setAllocations([...allocations, a])
                } />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Objekt</TableHead>
                      <TableHead>Mieter</TableHead>
                      <TableHead className="text-right">MZ/Mt.</TableHead>
                      <TableHead className="text-right">Beheizt</TableHead>
                      <TableHead className="text-right">Anteil %</TableHead>
                      <TableHead className="text-right">Erhöhung</TableHead>
                      <TableHead className="text-right">Neuer MZ</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((a, i) => {
                      const r = result.allocations[i];
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.unit_label}</TableCell>
                          <TableCell>{a.tenant_name ?? '–'}</TableCell>
                          <TableCell className="text-right font-mono">
                            <Input
                              type="number"
                              className="w-24 text-right"
                              value={a.current_rent}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setAllocations(allocations.map(x =>
                                  x.id === a.id ? { ...x, current_rent: val } : x
                                ));
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <input
                              type="checkbox"
                              checked={a.is_heated}
                              onChange={(e) => {
                                setAllocations(allocations.map(x =>
                                  x.id === a.id ? { ...x, is_heated: e.target.checked } : x
                                ));
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {r.share_pct.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmt(r.monthly_increase)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {fmt(r.new_rent)}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" variant="ghost"
                              onClick={() => startTransition(async () => {
                                await deleteAllocation(a.id, calc.id);
                                setAllocations(allocations.filter(x => x.id !== a.id));
                              })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Dokumente */}
        <TabsContent value="dokumente">
          <Card>
            <CardHeader>
              <CardTitle>Rechtliche Hinweise & Dokumente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p>
                    Die Erhöhung muss auf dem <strong>amtlichen Formular Kanton Zürich</strong> mitgeteilt werden.
                  </p>
                  <p>
                    Versand <strong>eingeschrieben</strong>, mind. 10 Tage vor Beginn der Kündigungsfrist.
                  </p>
                  <p>
                    Mieter haben <strong>30 Tage Anfechtungsfrist</strong> bei der Schlichtungsbehörde.
                  </p>
                </AlertDescription>
              </Alert>

              <Button variant="outline" className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Begründungstext für Formular generieren
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddAllocationButton({ 
  calculationId, onAdded,
}: { 
  calculationId: string; 
  onAdded: (a: RentIncreaseAllocation) => void;
}) {
  const [isPending, startTransition] = useTransition();
  
  return (
    <Button 
      size="sm" 
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await addAllocation(calculationId, {
          rental_unit_id: null,
          unit_label: 'Neues Objekt',
          tenant_name: null,
          current_rent: 0,
          is_heated: true,
        });
      })}
    >
      <Plus className="mr-2 h-4 w-4" />
      Objekt hinzufügen
    </Button>
  );
}
