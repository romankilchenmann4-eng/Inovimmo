// ── Nebenkostenabrechnung Calculation Module ──────────────────
// Pure functions for Swiss utility cost settlement calculations

import type {
  NKPosition,
  NKVerteilschluessel,
  NKZaehler,
  WohnungMitMietern,
  AkontoBuchung,
  BerechnungsInput,
  BerechnungsErgebnis,
  BerechnetePosition,
  GemischPosition,
  UmlagefaehigkeitWarning,
  PflichtangabenCheck,
  NKAbrechnung,
  NKKategorie,
  VerteilschluesselTyp,
} from "./types";

// ── Swiss Commercial Rounding (0.05 CHF / 5 Rappen) ─────────
export function roundCHF(n: number): number {
  return Math.round(n * 20) / 20;
}

// ── Format CHF Amount ────────────────────────────────────────
export function formatCHF(n: number): string {
  return n.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Umlagefähige Kosten nach OR 257d ──────────────────────────
const UMLAGEFAEHIGE_KATEGORIEN: NKKategorie[] = [
  "heizung",
  "warmwasser",
  "wasser_abwasser",
  "kehricht",
  "allgemeinstrom",
  "hauswart",
  "versicherung",
];

// Categories that require specific contractual basis
const KATEGORIEN_MIT_VERTRAGSPRUEFUNG: NKKategorie[] = [
  "versicherung",
  "hauswart",
  "sonstiges",
];

// ── Calculate Single Apartment's Share ────────────────────────
export function berechneAnteil(
  position: NKPosition,
  wohnung: WohnungMitMietern,
  alleWohnungen: WohnungMitMietern[],
  verteilschluessel: NKVerteilschluessel | null,
  zaehler: NKZaehler[]
): { anteil_prozent: number; betrag_anteil: number } {
  const typ = position.verteilschluessel_override ?? verteilschluessel?.verteilschluessel_typ ?? position.verteilschluessel;

  switch (typ) {
    case "flaeche":
      return berechneFlaechenAnteil(position, wohnung, alleWohnungen);
    case "kopf":
      return berechneKopfAnteil(position, wohnung, alleWohnungen);
    case "gleich":
      return berechneGleichenAnteil(position, wohnung, alleWohnungen);
    case "verbrauch":
      return berechneVerbrauchAnteil(position, wohnung, alleWohnungen, zaehler);
    case "gemischt":
      return berechneGemischtAnteil(position, wohnung, alleWohnungen, zaehler, verteilschluessel);
    default:
      return berechneFlaechenAnteil(position, wohnung, alleWohnungen);
  }
}

// ── Area-based Allocation (nach Wohnfläche) ───────────────────
function berechneFlaechenAnteil(
  position: NKPosition,
  wohnung: WohnungMitMietern,
  alleWohnungen: WohnungMitMietern[]
): { anteil_prozent: number; betrag_anteil: number } {
  const totalFlaeche = alleWohnungen.reduce((sum, w) => sum + w.flaeche_m2, 0);
  if (totalFlaeche === 0) {
    const gleich = 1 / alleWohnungen.length;
    return { anteil_prozent: gleich * 100, betrag_anteil: roundCHF(position.betrag_total * gleich) };
  }
  const anteil = wohnung.flaeche_m2 / totalFlaeche;
  return {
    anteil_prozent: anteil * 100,
    betrag_anteil: roundCHF(position.betrag_total * anteil),
  };
}

// ── Per-capita Allocation (nach Personenanzahl) ───────────────
function berechneKopfAnteil(
  position: NKPosition,
  wohnung: WohnungMitMietern,
  alleWohnungen: WohnungMitMietern[]
): { anteil_prozent: number; betrag_anteil: number } {
  const totalPersonen = alleWohnungen.reduce((sum, w) => sum + w.personenzahl, 0);
  if (totalPersonen === 0) {
    return berechneGleichenAnteil(position, wohnung, alleWohnungen);
  }
  const anteil = wohnung.personenzahl / totalPersonen;
  return {
    anteil_prozent: anteil * 100,
    betrag_anteil: roundCHF(position.betrag_total * anteil),
  };
}

// ── Equal Allocation (gleichmässig) ───────────────────────────
function berechneGleichenAnteil(
  position: NKPosition,
  wohnung: WohnungMitMietern,
  alleWohnungen: WohnungMitMietern[]
): { anteil_prozent: number; betrag_anteil: number } {
  const anteil = 1 / alleWohnungen.length;
  return {
    anteil_prozent: anteil * 100,
    betrag_anteil: roundCHF(position.betrag_total * anteil),
  };
}

// ── Consumption-based Allocation (nach Verbrauch/Zähler) ──────
function berechneVerbrauchAnteil(
  position: NKPosition,
  wohnung: WohnungMitMietern,
  alleWohnungen: WohnungMitMietern[],
  zaehler: NKZaehler[]
): { anteil_prozent: number; betrag_anteil: number } {
  if (!position.zaehler_id) {
    // No specific meter linked — fall back to area-based
    return berechneFlaechenAnteil(position, wohnung, alleWohnungen);
  }

  const relevantZaehler = zaehler.filter(
    (z) => z.zaehler_typ === kategorieToZaehlerTyp(position.kategorie)
  );

  if (relevantZaehler.length === 0) {
    return berechneFlaechenAnteil(position, wohnung, alleWohnungen);
  }

  // Calculate total consumption
  const totalVerbrauch = relevantZaehler.reduce((sum, z) => {
    const stand = (z.stand_endjahr ?? 0) - (z.stand_vorjahr ?? 0);
    return sum + Math.max(0, stand * z.faktor);
  }, 0);

  if (totalVerbrauch === 0) {
    return berechneFlaechenAnteil(position, wohnung, alleWohnungen);
  }

  // Calculate apartment's consumption
  const wohnungZaehler = relevantZaehler.filter(
    (z) => z.wohnung_id === wohnung.id
  );
  const wohnungVerbrauch = wohnungZaehler.reduce((sum, z) => {
    const stand = (z.stand_endjahr ?? 0) - (z.stand_vorjahr ?? 0);
    return sum + Math.max(0, stand * z.faktor);
  }, 0);

  // Shared meters (wohnung_id null) are allocated proportionally
  const sharedZaehler = relevantZaehler.filter((z) => z.wohnung_id === null);
  const sharedVerbrauch = sharedZaehler.reduce((sum, z) => {
    const stand = (z.stand_endjahr ?? 0) - (z.stand_vorjahr ?? 0);
    return sum + Math.max(0, stand * z.faktor);
  }, 0);

  const wohnungAnteilShared = wohnung.flaeche_m2 / alleWohnungen.reduce((s, w) => s + w.flaeche_m2, 0);
  const totalForWohnung = wohnungVerbrauch + sharedVerbrauch * wohnungAnteilShared;

  const anteil = totalForWohnung / totalVerbrauch;
  return {
    anteil_prozent: anteil * 100,
    betrag_anteil: roundCHF(position.betrag_total * anteil),
  };
}

// ── Mixed Allocation (gemischt) ───────────────────────────────
function berechneGemischtAnteil(
  position: NKPosition,
  wohnung: WohnungMitMietern,
  alleWohnungen: WohnungMitMietern[],
  zaehler: NKZaehler[],
  verteilschluessel: NKVerteilschluessel | null
): { anteil_prozent: number; betrag_anteil: number } {
  const positionen = verteilschluessel?.gemischt_positionen ?? [];
  if (positionen.length === 0 || positionen.reduce((s, p) => s + p.anteil, 0) !== 100) {
    // Invalid mixed configuration — fall back to area-based
    return berechneFlaechenAnteil(position, wohnung, alleWohnungen);
  }

  let betragAnteil = 0;
  let anteilProzent = 0;

  for (const pos of positionen) {
    const subAnteil = berechneSubAnteil(pos.typ, position, wohnung, alleWohnungen, zaehler);
    const gewicht = pos.anteil / 100;
    betragAnteil += position.betrag_total * gewicht * subAnteil.anteil_prozent / 100;
    anteilProzent += subAnteil.anteil_prozent * gewicht;
  }

  return {
    anteil_prozent: anteilProzent,
    betrag_anteil: roundCHF(betragAnteil),
  };
}

function berechneSubAnteil(
  typ: "flaeche" | "kopf" | "gleich" | "verbrauch",
  position: NKPosition,
  wohnung: WohnungMitMietern,
  alleWohnungen: WohnungMitMietern[],
  zaehler: NKZaehler[]
): { anteil_prozent: number; betrag_anteil: number } {
  switch (typ) {
    case "flaeche":
      return berechneFlaechenAnteil(position, wohnung, alleWohnungen);
    case "kopf":
      return berechneKopfAnteil(position, wohnung, alleWohnungen);
    case "gleich":
      return berechneGleichenAnteil(position, wohnung, alleWohnungen);
    case "verbrauch":
      return berechneVerbrauchAnteil(position, wohnung, alleWohnungen, zaehler);
  }
}

// ── Map NK Kategorie to ZaehlerTyp ────────────────────────────
function kategorieToZaehlerTyp(kategorie: NKKategorie): string {
  const mapping: Record<string, string> = {
    heizung: "heizung",
    warmwasser: "warmwasser",
    wasser_abwasser: "wasser",
    allgemeinstrom: "strom",
  };
  return mapping[kategorie] ?? kategorie;
}

// ── Calculate Akonto Total from Buchungen ─────────────────────
export function berechneAkontoTotal(
  buchungen: AkontoBuchung[],
  periodeVon: string,
  periodeBis: string
): number {
  const von = new Date(periodeVon);
  const bis = new Date(periodeBis);

  return buchungen
    .filter((b) => {
      const buchungsDatum = new Date(b.valuta);
      return buchungsDatum >= von && buchungsDatum <= bis;
    })
    .reduce((sum, b) => sum + b.betrag, 0);
}

// ── Main Calculation: All Settlements for a Property ──────────
export function berechneAbrechnungen(
  input: BerechnungsInput
): BerechnungsErgebnis[] {
  const { positionen, verteilschluessel, zaehler, wohnungen, akontoBuchungen, periode_von, periode_bis } = input;

  return wohnungen.map((wohnung) => {
    // Calculate each position's share for this apartment
    const berechnetePositionen: BerechnetePosition[] = positionen.map((pos) => {
      const kategorieVsk = verteilschluessel.find((v) => v.kategorie === pos.kategorie) ?? null;
      const anteil = berechneAnteil(pos, wohnung, wohnungen, kategorieVsk, zaehler);

      // Find relevant meter data for consumption-based items
      const relevantZaehler = pos.zaehler_id
        ? zaehler.filter((z) => z.id === pos.zaehler_id)
        : zaehler.filter((z) =>
            z.wohnung_id === wohnung.id &&
            z.zaehler_typ === kategorieToZaehlerTyp(pos.kategorie)
          );

      return {
        position_id: pos.id,
        bezeichnung: pos.bezeichnung,
        kategorie: pos.kategorie,
        betrag_total: pos.betrag_total,
        verteilschluessel_typ: pos.verteilschluessel_override ?? kategorieVsk?.verteilschluessel_typ ?? pos.verteilschluessel,
        anteil_prozent: anteil.anteil_prozent,
        betrag_anteil: anteil.betrag_anteil,
        umlagefaehig: pos.umlagefaehig,
        ...(relevantZaehler.length > 0
          ? {
              zaehlerstand_start: relevantZaehler[0].stand_vorjahr ?? undefined,
              zaehlerstand_end: relevantZaehler[0].stand_endjahr ?? undefined,
              verbrauch_einheit: relevantZaehler[0].stand_endjahr && relevantZaehler[0].stand_vorjahr
                ? (relevantZaehler[0].stand_endjahr - relevantZaehler[0].stand_vorjahr) * relevantZaehler[0].faktor
                : undefined,
            }
          : {}),
      };
    });

    // Calculate akonto for this apartment (filter by wohnung_id)
    const wohnungAkonto = akontoBuchungen
      .filter((b) => b.wohnung_id === wohnung.id && b.betrag > 0)
      .reduce((sum, b) => sum + b.betrag, 0);

    // Sum up costs (only umlagefaehig)
    const kostenTotal = berechnetePositionen
      .filter((p) => p.umlagefaehig)
      .reduce((sum, p) => sum + p.betrag_anteil, 0);

    const saldo = roundCHF(wohnungAkonto - kostenTotal); // positive = Guthaben, negative = Nachzahlung

    return {
      wohnung_id: wohnung.id,
      wohnung_bezeichnung: wohnung.bezeichnung,
      mieter_namen: wohnung.mieter_namen,
      mieter_adresse: wohnung.mieter_adresse,
      positionen: berechnetePositionen,
      kosten_total: roundCHF(kostenTotal),
      akonto_total: roundCHF(wohnungAkonto),
      saldo: saldo,
      saldo_gerundet: roundCHF(Math.abs(saldo)),
      saldo_typ: saldo >= 0 ? ("Guthaben" as const) : ("Nachzahlung" as const),
    };
  });
}

// ── Umlagefähigkeit Check (OR 257d) ───────────────────────────
export function pruefeUmlagefaehigkeit(
  positionen: NKPosition[]
): UmlagefaehigkeitWarning[] {
  return positionen.map((pos) => {
    let warnung: string | null = null;

    if (!pos.umlagefaehig) {
      warnung = "Nicht umlagefähig — darf nicht an Mieter weiterberechnet werden (Art. 257d OR)";
    } else if (KATEGORIEN_MIT_VERTRAGSPRUEFUNG.includes(pos.kategorie)) {
      if (pos.kategorie === "versicherung") {
        warnung = "Versicherungskosten sind nur umlagefähig, wenn im Mietvertrag vereinbart (Art. 257d OR)";
      } else if (pos.kategorie === "hauswart") {
        warnung = "Hauswartkosten müssen im Mietvertrag als umlagefähig deklariert sein";
      } else if (pos.kategorie === "sonstiges") {
        warnung = "Sonstige Kosten bedürfen einer vertraglichen Grundlage im Mietvertrag";
      }
    }

    return {
      position_id: pos.id,
      bezeichnung: pos.bezeichnung,
      kategorie: pos.kategorie,
      umlagefaehig: pos.umlagefaehig,
      warnung,
    };
  });
}

// ── Pflichtangaben Check ──────────────────────────────────────
export function pruefePflichtangaben(abrechnung: Partial<NKAbrechnung>): PflichtangabenCheck[] {
  const checks: PflichtangabenCheck[] = [
    {
      pflichtangabe: "Abrechnungsperiode (von–bis)",
      vorhanden: !!(abrechnung.periode_von && abrechnung.periode_bis),
      hinweis: abrechnung.periode_von && abrechnung.periode_bis ? null : "Periode muss angegeben werden (Start- und Enddatum)",
    },
    {
      pflichtangabe: "Liegenschaft",
      vorhanden: !!abrechnung.liegenschaft_id,
      hinweis: abrechnung.liegenschaft_id ? null : "Liegenschaft muss zugeordnet sein",
    },
    {
      pflichtangabe: "Mietername",
      vorhanden: true, // Will be verified at PDF generation time
      hinweis: null,
    },
    {
      pflichtangabe: "Wohnungsnummer",
      vorhanden: true, // Will be verified at PDF generation time
      hinweis: null,
    },
    {
      pflichtangabe: "Verteilschlüssel",
      vorhanden: true, // Verified through positions
      hinweis: null,
    },
    {
      pflichtangabe: "Gesamtkosten",
      vorhanden: !!abrechnung.kosten_total && abrechnung.kosten_total > 0,
      hinweis: abrechnung.kosten_total ? null : "Gesamtkosten müssen grösser als 0 sein",
    },
    {
      pflichtangabe: "Akonto-Zahlungen",
      vorhanden: abrechnung.akonto_total !== undefined && abrechnung.akonto_total !== null,
      hinweis: null,
    },
    {
      pflichtangabe: "Saldo (Nachzahlung/Guthaben)",
      vorhanden: abrechnung.differenz !== undefined && abrechnung.differenz !== null,
      hinweis: null,
    },
    {
      pflichtangabe: "Zahlungsfrist",
      vorhanden: !!abrechnung.zahlungsfrist,
      hinweis: abrechnung.zahlungsfrist ? null : "Zahlungsfrist muss gesetzt sein (min. 30 Tage nach Empfang, Art. 257d OR)",
    },
    {
      pflichtangabe: "Hinweis auf Belegeinsicht",
      vorhanden: true, // Included in PDF template
      hinweis: null,
    },
    {
      pflichtangabe: "Kontaktdaten Verwaltung",
      vorhanden: !!abrechnung.verwalter_id,
      hinweis: abrechnung.verwalter_id ? null : "Verwalter muss zugeordnet sein",
    },
  ];

  return checks;
}

// ── Calculate Zahlungsfrist ────────────────────────────────────
export function berechneZahlungsfrist(
  versendetAm: Date | string,
  tage: number = 30
): Date {
  const datum = typeof versendetAm === "string" ? new Date(versendetAm) : versendetAm;
  const frist = new Date(datum);
  frist.setDate(frist.getDate() + tage);
  return frist;
}