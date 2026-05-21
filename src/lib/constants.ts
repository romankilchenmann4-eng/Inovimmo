// ── Shared Constants ──────────────────────────────────────────

/** Escrow commission percentage (6%) */
export const PROVISION_PROZENT = 0.06;

/** Swiss VAT rate (8.1% as of 2024) */
export const MWST_SATZ = 0.081;

/** Bexio accounting account numbers */
export const BEXIO_KONTEN = {
  SOLL_AUFWAND: "6200",
  HABEN_BANK: "1020",
  MWST_CODE: "MWS",
} as const;

/** Default sender information — used as fallback when no verwalter data is available */
export const DEFAULT_ABSSENDER = {
  name: "Inovimmo",
  strasse: "",
  plz: "",
  ort: "",
  fullAddress: "Inovimmo",
} as const;

/** Allowed fields for NK position updates (mass assignment protection) */
export const ALLOWED_POSITION_FIELDS = [
  "bezeichnung",
  "kategorie",
  "betrag_total",
  "verteilschluessel",
  "mwst_prozent",
  "umlagefaehig",
  "zaehler_id",
  "notiz",
] as const;

/** Allowed fields for cover letter template updates (mass assignment protection) */
export const ALLOWED_VORLAGE_FIELDS = [
  "betreff",
  "anrede_vorlage",
  "einleitungstext",
  "schlussstext",
  "zahlungshinweis",
  "belege_hinweis",
  "ton",
] as const;

/** Allowed fields for rent increase updates (mass assignment protection) */
export const ALLOWED_ERHOEHUNG_FIELDS = [
  "titel",
  "grund",
  "status",
  "investition_total",
  "foerderbeitraege",
  "sonstige_kosten",
  "sonstige_abzuege",
  "wertvermehrend_prozent",
  "kapitalisierungssatz",
  "referenzzinssatz",
  "zuschlag_prozent",
  "amortisation_prozent",
  "unterhalt_prozent",
  "inkrafttreten",
  "eigentuemer_name",
  "eigentuemer_adresse",
  "eigentuemer_ort",
  "mietbeginn",
  "mietende",
] as const;