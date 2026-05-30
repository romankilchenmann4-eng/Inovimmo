// ============================================================
// Referenzzinssatz & LIK (Landesindex der Konsumentenpreise)
// Daten gemäss HEV Schweiz / Bundesamt für Statistik
// ============================================================

/** Quartalsweiser Referenzzinssatz gemäss Bundesamt für Wohnungswesen */
export const REFERENZZINSSATZ_HISTORIE: Array<{ datum: string; zinssatz: number }> = [
  // 2008
  { datum: '2008-09-01', zinssatz: 3.50 },
  { datum: '2008-12-01', zinssatz: 3.50 },
  // 2009
  { datum: '2009-03-01', zinssatz: 3.25 },
  { datum: '2009-06-01', zinssatz: 3.25 },
  { datum: '2009-09-01', zinssatz: 3.00 },
  { datum: '2009-12-01', zinssatz: 3.00 },
  // 2010
  { datum: '2010-03-01', zinssatz: 3.00 },
  { datum: '2010-06-01', zinssatz: 3.00 },
  { datum: '2010-09-01', zinssatz: 3.00 },
  { datum: '2010-12-01', zinssatz: 2.75 },
  // 2011
  { datum: '2011-03-01', zinssatz: 2.75 },
  { datum: '2011-06-01', zinssatz: 2.75 },
  { datum: '2011-09-01', zinssatz: 2.75 },
  { datum: '2011-12-01', zinssatz: 2.50 },
  // 2012
  { datum: '2012-03-01', zinssatz: 2.50 },
  { datum: '2012-06-01', zinssatz: 2.25 },
  { datum: '2012-09-01', zinssatz: 2.25 },
  { datum: '2012-12-01', zinssatz: 2.25 },
  // 2013
  { datum: '2013-03-01', zinssatz: 2.25 },
  { datum: '2013-06-01', zinssatz: 2.25 },
  { datum: '2013-09-01', zinssatz: 2.00 },
  { datum: '2013-12-01', zinssatz: 2.00 },
  // 2014
  { datum: '2014-03-01', zinssatz: 2.00 },
  { datum: '2014-06-01', zinssatz: 2.00 },
  { datum: '2014-09-01', zinssatz: 2.00 },
  { datum: '2014-12-01', zinssatz: 2.00 },
  // 2015
  { datum: '2015-03-01', zinssatz: 2.00 },
  { datum: '2015-06-01', zinssatz: 1.75 },
  { datum: '2015-09-01', zinssatz: 1.75 },
  { datum: '2015-12-01', zinssatz: 1.75 },
  // 2016
  { datum: '2016-03-01', zinssatz: 1.75 },
  { datum: '2016-06-01', zinssatz: 1.75 },
  { datum: '2016-09-01', zinssatz: 1.75 },
  { datum: '2016-12-01', zinssatz: 1.75 },
  // 2017
  { datum: '2017-03-01', zinssatz: 1.75 },
  { datum: '2017-06-01', zinssatz: 1.50 },
  { datum: '2017-09-01', zinssatz: 1.50 },
  { datum: '2017-12-01', zinssatz: 1.50 },
  // 2018
  { datum: '2018-03-01', zinssatz: 1.50 },
  { datum: '2018-06-01', zinssatz: 1.50 },
  { datum: '2018-09-01', zinssatz: 1.50 },
  { datum: '2018-12-01', zinssatz: 1.50 },
  // 2019
  { datum: '2019-03-01', zinssatz: 1.50 },
  { datum: '2019-06-01', zinssatz: 1.50 },
  { datum: '2019-09-01', zinssatz: 1.50 },
  { datum: '2019-12-01', zinssatz: 1.25 },
  // 2020
  { datum: '2020-03-01', zinssatz: 1.25 },
  { datum: '2020-06-01', zinssatz: 1.25 },
  { datum: '2020-09-01', zinssatz: 1.25 },
  { datum: '2020-12-01', zinssatz: 1.25 },
  // 2021
  { datum: '2021-03-01', zinssatz: 1.25 },
  { datum: '2021-06-01', zinssatz: 1.25 },
  { datum: '2021-09-01', zinssatz: 1.25 },
  { datum: '2021-12-01', zinssatz: 1.25 },
  // 2022
  { datum: '2022-03-01', zinssatz: 1.25 },
  { datum: '2022-06-01', zinssatz: 1.25 },
  { datum: '2022-09-01', zinssatz: 1.25 },
  { datum: '2022-12-01', zinssatz: 1.25 },
  // 2023
  { datum: '2023-03-01', zinssatz: 1.25 },
  { datum: '2023-06-01', zinssatz: 1.50 },
  { datum: '2023-09-01', zinssatz: 1.50 },
  { datum: '2023-12-01', zinssatz: 1.75 },
  // 2024
  { datum: '2024-03-01', zinssatz: 1.75 },
  { datum: '2024-06-01', zinssatz: 1.75 },
  { datum: '2024-09-01', zinssatz: 1.75 },
  { datum: '2024-12-01', zinssatz: 1.75 },
  // 2025
  { datum: '2025-03-01', zinssatz: 1.50 },
  { datum: '2025-06-01', zinssatz: 1.50 },
  { datum: '2025-09-01', zinssatz: 1.25 },
  { datum: '2025-12-01', zinssatz: 1.25 },
  // 2026
  { datum: '2026-03-01', zinssatz: 1.25 },
];

/**
 * Monatlicher Landesindex der Konsumentenpreise (LIK)
 * Basis: Dezember 2020 = 100
 * Quelle: Bundesamt für Statistik (BFS)
 * Nur die Daten ab 2020 sind hier aufgeführt.
 */
export const LIK_INDEX: Array<{ monat: string; index: number }> = [
  // 2020
  { monat: '2020-01', index: 100.0 },
  { monat: '2020-02', index: 100.1 },
  { monat: '2020-03', index: 99.7 },
  { monat: '2020-04', index: 99.4 },
  { monat: '2020-05', index: 99.3 },
  { monat: '2020-06', index: 99.4 },
  { monat: '2020-07', index: 99.6 },
  { monat: '2020-08', index: 99.7 },
  { monat: '2020-09', index: 99.8 },
  { monat: '2020-10', index: 99.9 },
  { monat: '2020-11', index: 99.7 },
  { monat: '2020-12', index: 100.0 },
  // 2021
  { monat: '2021-01', index: 99.8 },
  { monat: '2021-02', index: 100.0 },
  { monat: '2021-03', index: 100.4 },
  { monat: '2021-04', index: 100.5 },
  { monat: '2021-05', index: 100.6 },
  { monat: '2021-06', index: 100.8 },
  { monat: '2021-07', index: 100.7 },
  { monat: '2021-08', index: 100.9 },
  { monat: '2021-09', index: 101.0 },
  { monat: '2021-10', index: 101.2 },
  { monat: '2021-11', index: 101.3 },
  { monat: '2021-12', index: 101.3 },
  // 2022
  { monat: '2022-01', index: 101.5 },
  { monat: '2022-02', index: 102.0 },
  { monat: '2022-03', index: 102.7 },
  { monat: '2022-04', index: 103.0 },
  { monat: '2022-05', index: 103.3 },
  { monat: '2022-06', index: 103.4 },
  { monat: '2022-07', index: 103.2 },
  { monat: '2022-08', index: 103.3 },
  { monat: '2022-09', index: 103.4 },
  { monat: '2022-10', index: 103.5 },
  { monat: '2022-11', index: 103.4 },
  { monat: '2022-12', index: 103.4 },
  // 2023
  { monat: '2023-01', index: 103.4 },
  { monat: '2023-02', index: 103.6 },
  { monat: '2023-03', index: 103.9 },
  { monat: '2023-04', index: 104.1 },
  { monat: '2023-05', index: 104.1 },
  { monat: '2023-06', index: 104.0 },
  { monat: '2023-07', index: 103.9 },
  { monat: '2023-08', index: 103.9 },
  { monat: '2023-09', index: 103.8 },
  { monat: '2023-10', index: 103.6 },
  { monat: '2023-11', index: 103.5 },
  { monat: '2023-12', index: 103.4 },
  // 2024
  { monat: '2024-01', index: 103.5 },
  { monat: '2024-02', index: 103.6 },
  { monat: '2024-03', index: 103.7 },
  { monat: '2024-04', index: 103.9 },
  { monat: '2024-05', index: 103.9 },
  { monat: '2024-06', index: 103.8 },
  { monat: '2024-07', index: 103.7 },
  { monat: '2024-08', index: 103.6 },
  { monat: '2024-09', index: 103.4 },
  { monat: '2024-10', index: 103.4 },
  { monat: '2024-11', index: 103.3 },
  { monat: '2024-12', index: 103.2 },
  // 2025
  { monat: '2025-01', index: 103.3 },
  { monat: '2025-02', index: 103.5 },
  { monat: '2025-03', index: 103.6 },
  { monat: '2025-04', index: 103.5 },
];

/** Kostensteigerungspauschalen gemäss HEV / kantonalen Schlichtungsbehörden */
export const KOSTENSTEIGERUNG_PAUSCHALEN = [0, 0.25, 0.5] as const;
export type KostensteigerungPauschale = typeof KOSTENSTEIGERUNG_PAUSCHALEN[number];

/**
 * Liefert den Referenzzinssatz, der an einem bestimmten Datum galt.
 * Findet den neuesten Eintrag, dessen Datum <= angegebenes Datum.
 */
export function getReferenzzinssatz(datum: string): number {
  const d = datum.substring(0, 10); // YYYY-MM-DD
  let result = REFERENZZINSSATZ_HISTORIE[0].zinssatz;
  for (const entry of REFERENZZINSSATZ_HISTORIE) {
    if (entry.datum <= d) {
      result = entry.zinssatz;
    } else {
      break;
    }
  }
  return result;
}

/**
 * Liefert den aktuellsten Referenzzinssatz.
 */
export function getNeuesterReferenzzinssatz(): number {
  return REFERENZZINSSATZ_HISTORIE[REFERENZZINSSATZ_HISTORIE.length - 1].zinssatz;
}

/**
 * Liefert alle Referenzzinssatz-Änderungen (nur Quartale mit tatsächlichem Wechsel).
 */
export function getReferenzzinssatzAenderungen(): Array<{ datum: string; zinssatz: number }> {
  const changes: Array<{ datum: string; zinssatz: number }> = [];
  let prev = -1;
  for (const entry of REFERENZZINSSATZ_HISTORIE) {
    if (entry.zinssatz !== prev) {
      changes.push(entry);
      prev = entry.zinssatz;
    }
  }
  return changes;
}

/**
 * Liefert den LIK-Indexwert für einen bestimmten Monat.
 * Findet den neuesten Eintrag, dessen Monat <= angegebenes Datum.
 * BFS veröffentlicht Daten mit einem Monat Verzögerung –
 * deshalb gilt: LIK-Wert = Index des Vormonats zum angegebenen Datum.
 */
export function getLikIndex(datum: string): number | null {
  const d = datum.substring(0, 7); // YYYY-MM
  // BFS-Regel: Index des Vormonats verwenden
  const date = new Date(d + '-01');
  date.setMonth(date.getMonth() - 1);
  const prevMonth = date.toISOString().substring(0, 7);

  for (let i = LIK_INDEX.length - 1; i >= 0; i--) {
    if (LIK_INDEX[i].monat <= prevMonth) {
      return LIK_INDEX[i].index;
    }
  }
  return null;
}

/**
 * Liefert den neuesten verfügbaren LIK-Indexwert.
 */
export function getNeuesterLikIndex(): number {
  return LIK_INDEX[LIK_INDEX.length - 1].index;
}