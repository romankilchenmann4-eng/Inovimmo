// ============================================================
// Mietzinserhöhung – TypeScript Types
// Konsistent mit Inovimmo-Datenmodell (deutsch)
// ============================================================

export type MietzinsErhoehungGrund =
  | 'heizungsersatz'
  | 'renovation'
  | 'wertvermehrend_sonstiges';

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

export interface MietzinsErhoehung {
  id: string;
  liegenschaft_id: string;
  verwalter_id: string;
  titel: string;
  grund: MietzinsErhoehungGrund;
  investition_total: number;
  foerderbeitraege: number;
  wertvermehrend_prozent: number;
  referenzzinssatz: number;
  zuschlag: number;
  amortisation_prozent: number;
  unterhalt_prozent: number;
  netto_investition: number;       // generated column
  jahressatz_total: number;        // generated column
  status: MietzinsErhoehungStatus;
  inkrafttreten: string | null;
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
  mieter_namen: string[];   // formatierte Liste der Mieter
}

// Berechnungs-Input
export interface BerechnungsInput {
  investition_total: number;
  foerderbeitraege: number;
  wertvermehrend_prozent: number;
  referenzzinssatz: number;
  zuschlag: number;
  amortisation_prozent: number;
  unterhalt_prozent: number;
  positionen: Array<{
    wohnung_id: string;
    nettomiete: number;
    beheizt: boolean;
  }>;
}

// Berechnungs-Output
export interface BerechnungsErgebnis {
  netto_investition: number;
  wertvermehrender_betrag: number;
  jahressatz_total: number;
  jaehrliche_mehrbelastung: number;
  monatliche_mehrbelastung: number;
  positionen: Array<{
    wohnung_id: string;
    anteil_prozent: number;
    monatliche_erhoehung: number;
    neuer_nettomietzins: number;
  }>;
}
