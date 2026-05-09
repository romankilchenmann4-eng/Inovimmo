// ============================================================
// Mietzinserhöhung – Berechnungslogik
// Reine Funktionen, keine Seiteneffekte
// Gemäss Art. 269a OR / Art. 14 VMWG
// ============================================================

import type {
  BerechnungsInput,
  BerechnungsErgebnis,
  MietzinsErhoehung,
} from './types';

/**
 * Berechnet die Mietzinserhöhung gemäss Schweizer Mietrecht.
 *
 * Formel:
 *   Nettoinvestition = investition_total - foerderbeitraege
 *   Wertvermehrend = Nettoinvestition × (wertvermehrend_prozent / 100)
 *   Jahressatz = referenzzinssatz + zuschlag + amortisation + unterhalt
 *   Jährliche Mehrbelastung = Wertvermehrend × (Jahressatz / 100)
 *   Monatliche Mehrbelastung = Jährlich / 12
 *
 * Verteilung auf Mietobjekte nach Anteil Nettomietzins (nur beheizte).
 */
export function berechneErhoehung(input: BerechnungsInput): BerechnungsErgebnis {
  const netto_investition = Math.max(0, input.investition_total - input.foerderbeitraege);
  const wertvermehrender_betrag = netto_investition * (input.wertvermehrend_prozent / 100);

  const jahressatz_total =
    input.referenzzinssatz +
    input.zuschlag +
    input.amortisation_prozent +
    input.unterhalt_prozent;

  const jaehrliche_mehrbelastung = wertvermehrender_betrag * (jahressatz_total / 100);
  const monatliche_mehrbelastung = jaehrliche_mehrbelastung / 12;

  // Verteilschlüssel: nur beheizte Objekte werden belastet
  const beheizte = input.positionen.filter(p => p.beheizt);
  const total_beheizte_miete = beheizte.reduce((s, p) => s + p.nettomiete, 0);

  const positionen = input.positionen.map(p => {
    const anteil_prozent = p.beheizt && total_beheizte_miete > 0
      ? (p.nettomiete / total_beheizte_miete) * 100
      : 0;
    const monatliche_erhoehung = (anteil_prozent / 100) * monatliche_mehrbelastung;
    const neuer_nettomietzins = p.nettomiete + monatliche_erhoehung;

    return {
      wohnung_id: p.wohnung_id,
      anteil_prozent: round(anteil_prozent, 4),
      monatliche_erhoehung: round(monatliche_erhoehung, 2),
      neuer_nettomietzins: round(neuer_nettomietzins, 2),
    };
  });

  return {
    netto_investition: round(netto_investition, 2),
    wertvermehrender_betrag: round(wertvermehrender_betrag, 2),
    jahressatz_total: round(jahressatz_total, 2),
    jaehrliche_mehrbelastung: round(jaehrliche_mehrbelastung, 2),
    monatliche_mehrbelastung: round(monatliche_mehrbelastung, 2),
    positionen,
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Generiert den Begründungstext für das amtliche Formular.
 */
export function generiereBegruendungstext(
  erhoehung: MietzinsErhoehung,
  ergebnis: BerechnungsErgebnis,
): string {
  const grund_label = {
    heizungsersatz: 'Ersatz der bestehenden Heizung',
    renovation: 'Renovation',
    wertvermehrend_sonstiges: 'Wertvermehrende Investition',
  }[erhoehung.grund];

  return [
    'Wertvermehrende Investition gemäss Art. 269a lit. b OR i.V.m. Art. 14 VMWG:',
    '',
    `${grund_label} – ${erhoehung.titel}`,
    '',
    `- Total Investitionskosten: CHF ${fmt(erhoehung.investition_total)}`,
    `- Abzüglich Förderbeiträge: CHF ${fmt(erhoehung.foerderbeitraege)}`,
    `- Nettoinvestition: CHF ${fmt(ergebnis.netto_investition)}`,
    `- Wertvermehrender Anteil: ${erhoehung.wertvermehrend_prozent}% = CHF ${fmt(ergebnis.wertvermehrender_betrag)}`,
    `- Jahressatz total (Verzinsung ${erhoehung.referenzzinssatz + erhoehung.zuschlag}% + Amortisation ${erhoehung.amortisation_prozent}% + Unterhalt ${erhoehung.unterhalt_prozent}%): ${ergebnis.jahressatz_total}%`,
    `- Jährliche Mehrbelastung total: CHF ${fmt(ergebnis.jaehrliche_mehrbelastung)}`,
    `- Monatliche Mehrbelastung total: CHF ${fmt(ergebnis.monatliche_mehrbelastung)}`,
    '- Verteilung auf Mietobjekte nach Anteil Nettomietzins (nur beheizte Objekte)',
  ].join('\n');
}

function fmt(n: number): string {
  return n.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
