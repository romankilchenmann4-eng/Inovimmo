// ============================================================
// Mietzinserhöhung – TypeScript Types (HEV-konform)
// 4 Berechnungsblöcke: Referenzzinssatz, Teuerung, Kostensteigerung, Investitionen
// ============================================================

export type MietzinsErhoehungGrund =
  | 'referenzzinssatz'
  | 'teuerungsausgleich'
  | 'kostensteigerung'
  | 'investition';

export type MietzinsErhoehungStatus =
  | 'entwurf'
  | 'berechnet'
  | 'versendet'
  | 'angefochten'
  | 'aktiv';

export type VersandMethode =
  | 'einschreiben'
  | 'a_post'
  | 'email'
  | 'manuell';

export type KostensteigerungPauschale = 0 | 0.25 | 0.5;

export interface MietzinsErhoehung {
  id: string;
  liegenschaft_id: string;
  verwalter_id: string;
  titel: string;
  grund: MietzinsErhoehungGrund;
  status: MietzinsErhoehungStatus;
  // Block 1: Referenzzinssatz
  referenzzinssatz_alt: number;
  referenzzinssatz_neu: number;
  // Block 2: Teuerungsausgleich (LIK)
  lik_index_alt: number;
  lik_index_neu: number;
  // Block 3: Kostensteigerung
  kostensteigerung_pauschale: number;  // 0, 0.25, oder 0.5
  kostensteigerung_pro_jahr: number;   // Jahre seit letzter Anpassung
  // Block 4: Investitionen
  investition_total: number;
  foerderbeitraege: number;
  wertvermehrend_prozent: number;
  ersatzbeschaffung_1zu1: number;
  amortisation_prozent: number;
  unterhalt_prozent: number;
  // Nebenkosten
  nebenkosten_aenderung_monatlich: number;
  // Berechnete Ergebnisse (gespeichert)
  referenzzinssatz_aenderung: number;
  teuerung_prozent: number;
  teuerung_40_prozent: number;
  // Datum-Felder
  berechnungsdatum: string | null;
  letzte_anpassung: string | null;
  inkrafttreten: string | null;
  mietbeginn: string | null;
  // Eigentümer
  eigentuemer_name: string | null;
  eigentuemer_adresse: string | null;
  eigentuemer_ort: string | null;
  // Begründung
  begruendung_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface MietzinsErhoehungPosition {
  id: string;
  mietzins_erhoehung_id: string;
  wohnung_id: string;
  beheizt: boolean;
  anteil_prozent: number | null;
  monatliche_erhoehung: number | null;
  neuer_nettomietzins: number | null;
  versendet_at: string | null;
  versand_methode: VersandMethode | null;
  bestaetigt_at: string | null;
  created_at: string;
}

// Erweiterte Position mit Wohnungs- und Mieter-Daten (für UI)
export interface PositionMitWohnung extends MietzinsErhoehungPosition {
  wohnung: {
    id: string;
    bezeichnung: string;
    whg_nr: string | null;
    wohnungstyp: string;
    nettomiete: number;
    nebenkosten_akonto: number;
    flaeche_m2: number | null;
  };
  mieter_namen: string[];
}

// Berechnungs-Input (HEV-konform, 4 Blöcke)
export interface BerechnungsInput {
  nettomiete_aktuell: number;
  nebenkosten_aktuell: number;
  // Block 1: Referenzzinssatz
  referenzzinssatz_alt: number;
  referenzzinssatz_neu: number;
  // Block 2: Teuerungsausgleich
  lik_index_alt: number;
  lik_index_neu: number;
  // Block 3: Kostensteigerung
  kostensteigerung_pauschale: number;  // 0, 0.25, oder 0.5
  kostensteigerung_jahre: number;
  // Block 4: Investitionen (0 = nicht aktiv)
  investition_total: number;
  foerderbeitraege: number;
  wertvermehrend_prozent: number;
  ersatzbeschaffung_1zu1: number;
  amortisation_prozent: number;
  unterhalt_prozent: number;
  // Positionen für pro-Wohnung-Berechnung
  positionen: Array<{
    wohnung_id: string;
    nettomiete: number;
    beheizt: boolean;
  }>;
}

// Berechnungs-Ergebnis (HEV-konform, 4 Blöcke)
export interface BerechnungsErgebnis {
  // Block 1: Referenzzinssatz
  referenzzinssatz_aenderung_pp: number;
  erhoehung_referenzzins_chf: number;
  // Block 2: Teuerungsausgleich
  teuerung_prozent: number;
  teuerung_40_prozent: number;
  erhoehung_teuerung_chf: number;
  // Block 3: Kostensteigerung
  kostensteigerung_gesamt_prozent: number;
  erhoehung_kostensteigerung_chf: number;
  // Block 4: Investitionen
  netto_investition: number;
  wertvermehrender_betrag: number;
  jahressatz_prozent: number;
  erhoehung_investition_jaehrlich: number;
  erhoehung_investition_monatlich: number;
  // Total
  erhoehung_total_monatlich: number;
  nebenkosten_aenderung_monatlich: number;
  neuer_nettomietzins: number;
  neuer_bruttomietzins: number;
  // Positionen
  positionen: Array<{
    wohnung_id: string;
    anteil_prozent: number;
    monatliche_erhoehung: number;
    neuer_nettomietzins: number;
  }>;
}