export type UserRole = "verwalter" | "mieter" | "dienstleister" | "admin" | "eigentümer";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  firma?: string;
  adresse?: string;
  plz?: string;
  ort?: string;
  created_at?: string;
  updated_at?: string;
};

export type Liegenschaft = {
  id: string;
  verwalter_id: string;
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  kanton: string;
  baujahr?: number;
  anzahl_wohnungen: number;
  objekttyp: "MFH" | "EFH" | "Gewerbe" | "Gemischt";
  notizen?: string;
  created_at: string;
  updated_at: string;
};

export type Wohnung = {
  id: string;
  liegenschaft_id: string;
  bezeichnung: string;
  etage: number;
  zimmer: number;
  flaeche_m2: number;
  nettomiete: number;
  nebenkosten_akonto: number;
  status: "vermietet" | "leer" | "kuendigung";
  mietbeginn?: string;
  mietende?: string;
  created_at: string;
  updated_at: string;
};

export type TicketKategorie =
  | "heizung_sanitaer" | "elektro" | "fenster_tueren"
  | "maler_boeden" | "garten" | "reinigung" | "sonstiges";

export type TicketPrioritaet = "normal" | "dringend" | "notfall";

export type TicketStatus =
  | "neu" | "ausgeschrieben" | "offerten_eingegangen"
  | "vergeben" | "in_ausfuehrung" | "abgeschlossen" | "storniert";

export type Ticket = {
  id: string;
  liegenschaft_id: string;
  wohnung_id?: string;
  erstellt_von: string;
  titel: string;
  beschreibung: string;
  kategorie: TicketKategorie;
  prioritaet: TicketPrioritaet;
  status: TicketStatus;
  budget_max?: number;
  fotos?: string[];
  created_at: string;
  updated_at: string;
};

export type Offerte = {
  id: string;
  ticket_id: string;
  dienstleister_id: string;
  betrag: number;
  beschreibung: string;
  verfuegbar_ab: string;
  garantie_monate?: number;
  status: "eingegangen" | "akzeptiert" | "abgelehnt" | "zurueckgezogen";
  versiegelt_at: string;
  created_at: string;
};

export type Escrow = {
  id: string;
  ticket_id: string;
  offerte_id: string;
  verwalter_id: string;
  dienstleister_id: string;
  betrag: number;
  provision_prozent: number;
  provision_betrag: number;
  status: "ausstehend" | "einbezahlt" | "in_ausfuehrung" | "abgeschlossen" | "zurueckerstattet" | "streit";
  stripe_payment_intent_id?: string;
  einbezahlt_at?: string;
  freigegeben_at?: string;
  created_at: string;
  updated_at: string;
};
