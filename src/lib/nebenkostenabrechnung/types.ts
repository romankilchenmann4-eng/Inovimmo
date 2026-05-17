// ── Nebenkostenabrechnung Types ──────────────────────────────
// Swiss utility cost settlement system for Inovimmo

// ── Allocation Key Types ────────────────────────────────────
export type VerteilschluesselTyp = "flaeche" | "kopf" | "gleich" | "verbrauch" | "gemischt";
export type NKAbrechnungStatus = "entwurf" | "berechnet" | "versendet" | "teilweise_bezahlt" | "bezahlt" | "angefochten";
export type BegleitschreibenTon = "neutral" | "freundlich" | "streng";
export type ZaehlerTyp = "heizung" | "warmwasser" | "wasser" | "abwasser" | "strom";
export type NKKategorie = "heizung" | "warmwasser" | "wasser_abwasser" | "kehricht" | "allgemeinstrom" | "hauswart" | "versicherung" | "sonstiges";
export type DokumentTyp = "abrechnung" | "begleitschreiben" | "kostenuebersicht" | "detailbeilage" | "batch_pdf";

export const NK_KATEGORIEN: { value: NKKategorie; label: string }[] = [
  { value: "heizung", label: "Heizung" },
  { value: "warmwasser", label: "Warmwasser" },
  { value: "wasser_abwasser", label: "Wasser/Abwasser" },
  { value: "kehricht", label: "Kehricht" },
  { value: "allgemeinstrom", label: "Allgemeinstrom" },
  { value: "hauswart", label: "Hauswart" },
  { value: "versicherung", label: "Versicherung" },
  { value: "sonstiges", label: "Sonstiges" },
];

export const VERTEILSCHLUESSEL_LABELS: Record<VerteilschluesselTyp, string> = {
  flaeche: "nach Wohnfläche",
  kopf: "nach Personenanzahl",
  gleich: "gleichmässig",
  verbrauch: "nach Verbrauch",
  gemischt: "gemischt",
};

export const ZAEHLER_TYP_LABELS: Record<ZaehlerTyp, string> = {
  heizung: "Heizung",
  warmwasser: "Warmwasser",
  wasser: "Wasser",
  abwasser: "Abwasser",
  strom: "Strom",
};

export const STATUS_LABELS: Record<NKAbrechnungStatus, string> = {
  entwurf: "Entwurf",
  berechnet: "Berechnet",
  versendet: "Versendet",
  teilweise_bezahlt: "Teilweise bezahlt",
  bezahlt: "Bezahlt",
  angefochten: "Angefochten",
};

// ── Meter / Counter ─────────────────────────────────────────
export interface NKZaehler {
  id: string;
  liegenschaft_id: string;
  wohnung_id: string | null;
  bezeichnung: string;
  zaehler_typ: ZaehlerTyp;
  einheit: string;
  stand_vorjahr: number | null;
  stand_endjahr: number | null;
  faktor: number;
  notiz: string | null;
  created_at: string;
  updated_at: string;
}

// ── Allocation Keys ──────────────────────────────────────────
export interface GemischPosition {
  typ: "flaeche" | "kopf" | "gleich" | "verbrauch";
  anteil: number; // percentage, must sum to 100
}

export interface NKVerteilschluessel {
  id: string;
  liegenschaft_id: string;
  kategorie: NKKategorie;
  verteilschluessel_typ: VerteilschluesselTyp;
  gemischt_positionen: GemischPosition[];
  notiz: string | null;
  created_at: string;
}

// ── Cost Positions (extended) ────────────────────────────────
export interface NKPosition {
  id: string;
  liegenschaft_id: string;
  jahr: number;
  bezeichnung: string;
  kategorie: NKKategorie;
  betrag_total: number;
  verteilschluessel: VerteilschluesselTyp;
  verteilschluessel_override: VerteilschluesselTyp | null;
  zaehler_id: string | null;
  mwst_prozent: number;
  umlagefaehig: boolean;
  notiz: string | null;
  created_at: string;
}

// ── Settlements ─────────────────────────────────────────────
export interface NKAbrechnung {
  id: string;
  wohnung_id: string;
  liegenschaft_id: string;
  jahr: number;
  periode_von: string | null;
  periode_bis: string | null;
  akonto_total: number;
  kosten_total: number;
  differenz: number;
  nachzahlung: number;
  total_kosten: number;
  total_vorschuss: number;
  status: NKAbrechnungStatus;
  zahlungsfrist: string | null;
  begleitschreiben_ton: BegleitschreibenTon;
  bankkonto_id: string | null;
  verwalter_id: string | null;
  notiz: string | null;
  versendet_an: string | null;
  pdf_url: string | null;
  bezahlt_at: string | null;
  erstellt_at: string;
}

// ── Settlement Position Lines ────────────────────────────────
export interface NKAbrechnungPosition {
  id: string;
  abrechnung_id: string;
  position_id: string | null;
  bezeichnung: string;
  kategorie: NKKategorie;
  betrag_total: number;
  anteil_prozent: number;
  betrag_anteil: number;
  zaehlerstand_start: number | null;
  zaehlerstand_end: number | null;
  verbrauch_einheit: number | null;
  verteilschluessel_typ: VerteilschluesselTyp | null;
  notiz: string | null;
  created_at: string;
}

// ── Cover Letter Templates ───────────────────────────────────
export interface NKAbrechnungVorlage {
  id: string;
  verwalter_id: string;
  name: string;
  ton: BegleitschreibenTon;
  betreff: string;
  anrede_vorlage: string;
  einleitungstext: string | null;
  schlusstext: string | null;
  zahlungshinweis: string | null;
  belege_hinweis: string;
  erstellt_von: string | null;
  created_at: string;
  updated_at: string;
}

// ── Generated Documents ──────────────────────────────────────
export interface NKAbrechnungDokument {
  id: string;
  abrechnung_id: string;
  dokument_typ: DokumentTyp;
  pdf_url: string | null;
  dateiname: string;
  erstellt_am: string;
  versendet_am: string | null;
  versendet_an: string | null;
}

// ── Calculation Input/Output ─────────────────────────────────
export interface WohnungMitMietern {
  id: string;
  bezeichnung: string;
  whg_nr: string | null;
  etage: number | null;
  flaeche_m2: number;
  nettomiete: number;
  nebenkosten_akonto: number;
  mieter_namen: string[];
  mieter_adresse: string;
  personenzahl: number;
  beheizt: boolean;
}

export interface AkontoBuchung {
  buchung_id: string;
  betrag: number;
  valuta: string;
  periode_monat: number;
  periode_jahr: number;
}

export interface BerechnungsInput {
  positionen: NKPosition[];
  verteilschluessel: NKVerteilschluessel[];
  zaehler: NKZaehler[];
  wohnungen: WohnungMitMietern[];
  akontoBuchungen: AkontoBuchung[];
  periode_von: string;
  periode_bis: string;
}

export interface BerechnetePosition {
  position_id: string;
  bezeichnung: string;
  kategorie: NKKategorie;
  betrag_total: number;
  verteilschluessel_typ: VerteilschluesselTyp;
  anteil_prozent: number;
  betrag_anteil: number;
  umlagefaehig: boolean;
  zaehlerstand_start?: number;
  zaehlerstand_end?: number;
  verbrauch_einheit?: number;
}

export interface BerechnungsErgebnis {
  wohnung_id: string;
  wohnung_bezeichnung: string;
  mieter_namen: string[];
  mieter_adresse: string;
  positionen: BerechnetePosition[];
  kosten_total: number;
  akonto_total: number;
  saldo: number; // positive = Guthaben, negative = Nachzahlung
  saldo_gerundet: number; // Swiss 0.05 rounding
  saldo_typ: "Nachzahlung" | "Guthaben";
}

// ── Umlagefähigkeit Check ────────────────────────────────────
export interface UmlagefaehigkeitWarning {
  position_id: string;
  bezeichnung: string;
  kategorie: NKKategorie;
  umlagefaehig: boolean;
  warnung: string | null;
}

// ── Pflichtangaben Check ─────────────────────────────────────
export interface PflichtangabenCheck {
  pflichtangabe: string;
  vorhanden: boolean;
  hinweis: string | null;
}