// ============================================================
// Mietzinserhöhung – HEV-konforme Berechnungslogik
// 4 Blöcke: Referenzzinssatz, Teuerung, Kostensteigerung, Investitionen
// Gemäss HEV Schweiz Mietzinsrechner
// ============================================================

import type {
  BerechnungsInput,
  BerechnungsErgebnis,
  MietzinsErhoehung,
} from './types';

/**
 * Berechnet die Mietzinserhöhung gemäss HEV-Schweiz-Rechner.
 *
 * Block 1: Referenzzinssatz-Änderung
 *   Erhöhung/Mt = Nettomiete × ((Referenzzins_neu - Referenzzins_alt) / 100)
 *
 * Block 2: Teuerungsausgleich (LIK)
 *   Teuerung% = ((LIK_neu - LIK_alt) / LIK_alt) × 100
 *   Teuerung 40% = Teuerung% × 0.4
 *   Erhöhung/Mt = Nettomiete × (Teuerung 40% / 100)
 *
 * Block 3: Allgemeine Kostensteigerung
 *   Gesamt% = Pauschale% × Jahre
 *   Erhöhung/Mt = Nettomiete × (Gesamt% / 100)
 *
 * Block 4: Investitionen (Art. 269a OR)
 *   Nettoinvestition = Total - Förderbeiträge
 *   Wertvermehrend = Nettoinvestition - Ersatzbeschaffung (oder × %)
 *   Ø-Kapitalzins = (Referenzzins_alt + Referenzzins_neu) / 2
 *   Jahressatz = Ø-Kapitalzins + Amortisation + Unterhalt
 *   Erhöhung/Jahr = Wertvermehrend × (Jahressatz / 100)
 *   Erhöhung/Mt = Erhöhung/Jahr / 12
 *   Verteilung auf beheizte Wohnungen nach Anteil Nettomiete
 */
export function berechneErhoehung(input: BerechnungsInput): BerechnungsErgebnis {
  const nettomiete = input.nettomiete_aktuell;

  // ── Block 1: Referenzzinssatz ──────────────────────────
  const referenzzinssatz_aenderung_pp = input.referenzzinssatz_neu - input.referenzzinssatz_alt;
  const erhoehung_referenzzins_chf = round(
    nettomiete * (referenzzinssatz_aenderung_pp / 100), 2
  );

  // ── Block 2: Teuerungsausgleich (LIK) ──────────────────
  let teuerung_prozent = 0;
  let teuerung_40_prozent = 0;
  let erhoehung_teuerung_chf = 0;

  if (input.lik_index_alt > 0 && input.lik_index_neu > 0) {
    teuerung_prozent = round(
      ((input.lik_index_neu - input.lik_index_alt) / input.lik_index_alt) * 100, 4
    );
    teuerung_40_prozent = round(teuerung_prozent * 0.4, 4);
    erhoehung_teuerung_chf = round(
      nettomiete * (teuerung_40_prozent / 100), 2
    );
  }

  // ── Block 3: Allgemeine Kostensteigerung ────────────────
  const kostensteigerung_gesamt_prozent = round(
    input.kostensteigerung_pauschale * input.kostensteigerung_jahre, 4
  );
  const erhoehung_kostensteigerung_chf = round(
    nettomiete * (kostensteigerung_gesamt_prozent / 100), 2
  );

  // ── Block 4: Investitionen ──────────────────────────────
  let netto_investition = 0;
  let wertvermehrender_betrag = 0;
  let jahressatz_prozent = 0;
  let erhoehung_investition_jaehrlich = 0;
  let erhoehung_investition_monatlich = 0;

  if (input.investition_total > 0) {
    netto_investition = Math.max(0, input.investition_total - input.foerderbeitraege);
    wertvermehrender_betrag = input.ersatzbeschaffung_1zu1 > 0
      ? Math.max(0, netto_investition - input.ersatzbeschaffung_1zu1)
      : netto_investition * (input.wertvermehrend_prozent / 100);

    const durchschnittlicher_kapitalzins = (input.referenzzinssatz_alt + input.referenzzinssatz_neu) / 2;
    jahressatz_prozent = round(
      durchschnittlicher_kapitalzins + input.amortisation_prozent + input.unterhalt_prozent, 2
    );

    erhoehung_investition_jaehrlich = round(
      wertvermehrender_betrag * (jahressatz_prozent / 100), 2
    );
    erhoehung_investition_monatlich = round(erhoehung_investition_jaehrlich / 12, 2);
  }

  // ── Total ───────────────────────────────────────────────
  const erhoehung_total_monatlich = round(
    erhoehung_referenzzins_chf +
    erhoehung_teuerung_chf +
    erhoehung_kostensteigerung_chf +
    erhoehung_investition_monatlich,
    2
  );

  const neuer_nettomietzins = round(nettomiete + erhoehung_total_monatlich, 2);
  const neuer_bruttomietzins = round(
    neuer_nettomietzins + input.nebenkosten_aktuell + (input.nebenkosten_aktuell > 0 ? 0 : 0),
    2
  );

  // ── Positionen (nur für Investitions-Block relevant) ───
  const beheizte = input.positionen.filter(p => p.beheizt);
  const total_beheizte_miete = beheizte.reduce((s, p) => s + p.nettomiete, 0);

  const positionen = input.positionen.map(p => {
    // Block 1-3: pro Wohnung proportional zur eigenen Nettomiete
    const eigeneErhoehungBasis = round(
      p.nettomiete * (referenzzinssatz_aenderung_pp / 100) +
      p.nettomiete * (teuerung_40_prozent / 100) +
      p.nettomiete * (kostensteigerung_gesamt_prozent / 100),
      2
    );

    // Block 4: Investitionen auf beheizte Wohnungen verteilt
    const investitionsanteil = (p.beheizt && total_beheizte_miete > 0)
      ? (p.nettomiete / total_beheizte_miete)
      : 0;
    const eigeneInvestErhoehung = round(erhoehung_investition_monatlich * investitionsanteil, 2);

    const monatliche_erhoehung = round(eigeneErhoehungBasis + eigeneInvestErhoehung, 2);

    return {
      wohnung_id: p.wohnung_id,
      anteil_prozent: round(investitionsanteil * 100, 4),
      monatliche_erhoehung,
      neuer_nettomietzins: round(p.nettomiete + monatliche_erhoehung, 2),
    };
  });

  return {
    referenzzinssatz_aenderung_pp: round(referenzzinssatz_aenderung_pp, 4),
    erhoehung_referenzzins_chf,
    teuerung_prozent,
    teuerung_40_prozent,
    erhoehung_teuerung_chf,
    kostensteigerung_gesamt_prozent,
    erhoehung_kostensteigerung_chf,
    netto_investition: round(netto_investition, 2),
    wertvermehrender_betrag: round(wertvermehrender_betrag, 2),
    jahressatz_prozent,
    erhoehung_investition_jaehrlich: round(erhoehung_investition_jaehrlich, 2),
    erhoehung_investition_monatlich,
    erhoehung_total_monatlich,
    nebenkosten_aenderung_monatlich: 0, // wird von aussen gesetzt
    neuer_nettomietzins,
    neuer_bruttomietzins,
    positionen,
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Generiert den Begründungstext für das amtliche Formular (HEV-konform).
 */
export function generiereBegruendungstext(
  erhoehung: MietzinsErhoehung,
  ergebnis: BerechnungsErgebnis,
): string {
  const lines: string[] = [
    'Mietzinsanpassung gemäss Art. 269d OR / Art. 14 VMWG:',
    '',
  ];

  // Block 1: Referenzzinssatz
  if (ergebnis.referenzzinssatz_aenderung_pp !== 0) {
    lines.push('1. Referenzzinssatz-Änderung:');
    lines.push(`   Alter Referenzzinssatz: ${fmtPct(erhoehung.referenzzinssatz_alt)}%`);
    lines.push(`   Neuer Referenzzinssatz: ${fmtPct(erhoehung.referenzzinssatz_neu)}%`);
    lines.push(`   Änderung: ${ergebnis.referenzzinssatz_aenderung_pp > 0 ? '+' : ''}${fmtPct(ergebnis.referenzzinssatz_aenderung_pp)} Prozentpunkte`);
    lines.push(`   Erhöhung/Monat: CHF ${fmt(ergebnis.erhoehung_referenzzins_chf)}`);
    lines.push('');
  }

  // Block 2: Teuerungsausgleich
  if (ergebnis.teuerung_prozent !== 0) {
    lines.push('2. Teuerungsausgleich (Kaufkraftsicherung):');
    lines.push(`   LIK-Index alt: ${fmtPct(erhoehung.lik_index_alt)}`);
    lines.push(`   LIK-Index neu: ${fmtPct(erhoehung.lik_index_neu)}`);
    lines.push(`   Teuerung: ${fmtPct(ergebnis.teuerung_prozent)}%`);
    lines.push(`   Anrechenbar (40%): ${fmtPct(ergebnis.teuerung_40_prozent)}%`);
    lines.push(`   Erhöhung/Monat: CHF ${fmt(ergebnis.erhoehung_teuerung_chf)}`);
    lines.push('');
  }

  // Block 3: Kostensteigerung
  if (ergebnis.kostensteigerung_gesamt_prozent !== 0) {
    lines.push('3. Allgemeine Kostensteigerung:');
    lines.push(`   Pauschale: ${fmtPct(erhoehung.kostensteigerung_pauschale)}% pro Jahr`);
    lines.push(`   Jahre seit letzter Anpassung: ${erhoehung.kostensteigerung_pro_jahr}`);
    lines.push(`   Gesamt: ${fmtPct(ergebnis.kostensteigerung_gesamt_prozent)}%`);
    lines.push(`   Erhöhung/Monat: CHF ${fmt(ergebnis.erhoehung_kostensteigerung_chf)}`);
    lines.push('');
  }

  // Block 4: Investitionen
  if (erhoehung.investition_total > 0) {
    lines.push('4. Wertvermehrende Investition (Art. 269a lit. b OR):');
    lines.push(`   Total Investitionskosten: CHF ${fmt(erhoehung.investition_total)}`);
    lines.push(`   Abzüglich Förderbeiträge: CHF ${fmt(erhoehung.foerderbeitraege)}`);
    lines.push(`   Nettoinvestition: CHF ${fmt(ergebnis.netto_investition)}`);
    if (erhoehung.ersatzbeschaffung_1zu1 > 0) {
      lines.push(`   Ersatzbeschaffung 1:1: CHF ${fmt(erhoehung.ersatzbeschaffung_1zu1)}`);
    }
    lines.push(`   Wertvermehrender Anteil: CHF ${fmt(ergebnis.wertvermehrender_betrag)}`);
    lines.push(`   Jahressatz total: ${fmtPct(ergebnis.jahressatz_prozent)}%`);
    lines.push(`   Erhöhung/Jahr: CHF ${fmt(ergebnis.erhoehung_investition_jaehrlich)}`);
    lines.push(`   Erhöhung/Monat: CHF ${fmt(ergebnis.erhoehung_investition_monatlich)}`);
    lines.push('');
  }

  // Total
  lines.push('─'.repeat(40));
  lines.push(`Gesamterhöhung/Monat: CHF ${fmt(ergebnis.erhoehung_total_monatlich)}`);
  lines.push(`Neuer Nettomietzins: CHF ${fmt(ergebnis.neuer_nettomietzins)}`);

  return lines.join('\n');
}

function fmt(n: number): string {
  return n.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number): string {
  return n.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}