// ─── DATABASE TYPES ───────────────────────────────────────────────────────────

export type UserRole = "verwalter" | "mieter" | "dienstleister" | "admin";

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
  created_at: string;
  updated_at: string;
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
  mieter_id?: string;
  mietbeginn?: string;
  mietende?: string;
  created_at: string;
  updated_at: string;
};

export type Mieter = {
  id: string;
  profile_id: string;
  wohnung_id: string;
  liegenschaft_id: string;
  mietbeginn: string;
  mietende?: string;
  kaution: number;
  kaution_bezahlt: boolean;
  created_at: string;
  profile?: Profile;
  wohnung?: Wohnung;
};

export type TicketPrioritaet = "normal" | "dringend" | "notfall";
export type TicketStatus =
  | "neu"
  | "ausgeschrieben"
  | "offerten_eingegangen"
  | "vergeben"
  | "in_ausfuehrung"
  | "abgeschlossen"
  | "storniert";

export type TicketKategorie =
  | "heizung_sanitaer"
  | "elektro"
  | "fenster_tueren"
  | "maler_boeden"
  | "garten"
  | "reinigung"
  | "sonstiges";

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
  liegenschaft?: Liegenschaft;
  wohnung?: Wohnung;
  ersteller?: Profile;
  offerten?: Offerte[];
  _count?: { offerten: number };
};

export type OfferteStatus =
  | "eingegangen"
  | "akzeptiert"
  | "abgelehnt"
  | "zurueckgezogen";

export type Offerte = {
  id: string;
  ticket_id: string;
  dienstleister_id: string;
  betrag: number;
  beschreibung: string;
  verfuegbar_ab: string;
  garantie_monate?: number;
  status: OfferteStatus;
  versiegelt_at: string;
  created_at: string;
  dienstleister?: Profile;
  ticket?: Ticket;
};

export type EscrowStatus =
  | "ausstehend"
  | "einbezahlt"
  | "in_ausfuehrung"
  | "abgeschlossen"
  | "zurueckerstattet"
  | "streit";

export type Escrow = {
  id: string;
  ticket_id: string;
  offerte_id: string;
  verwalter_id: string;
  dienstleister_id: string;
  betrag: number;
  provision_prozent: number;
  provision_betrag: number;
  status: EscrowStatus;
  stripe_payment_intent_id?: string;
  einbezahlt_at?: string;
  freigegeben_at?: string;
  created_at: string;
  updated_at: string;
  offerte?: Offerte;
  ticket?: Ticket;
};

export type Nebenkostenposition = {
  id: string;
  liegenschaft_id: string;
  jahr: number;
  bezeichnung: string;
  betrag_total: number;
  verteilschluessel: "flaeche" | "kopf" | "gleich";
  created_at: string;
};

export type Nebenkostenabrechnung = {
  id: string;
  wohnung_id: string;
  liegenschaft_id: string;
  jahr: number;
  akonto_total: number;
  kosten_total: number;
  differenz: number;
  status: "entwurf" | "versendet" | "bezahlt";
  erstellt_at: string;
  versendet_at?: string;
};

export type DienstleisterProfil = {
  id: string;
  profile_id: string;
  kategorien: TicketKategorie[];
  beschreibung?: string;
  webseite?: string;
  zertifikate?: string[];
  bewertung_schnitt: number;
  anzahl_bewertungen: number;
  abo_aktiv: boolean;
  abo_typ: "basic" | "premium";
  verified: boolean;
  created_at: string;
  profile?: Profile;
};

export type Bewertung = {
  id: string;
  ticket_id: string;
  dienstleister_id: string;
  bewerter_id: string;
  sterne: number;
  kommentar?: string;
  created_at: string;
};

// ─── FORM TYPES ───────────────────────────────────────────────────────────────

export type LiegenschaftFormData = {
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  kanton: string;
  baujahr?: number;
  anzahl_wohnungen: number;
  objekttyp: Liegenschaft["objekttyp"];
  notizen?: string;
};

export type TicketFormData = {
  titel: string;
  beschreibung: string;
  liegenschaft_id: string;
  wohnung_id?: string;
  kategorie: TicketKategorie;
  prioritaet: TicketPrioritaet;
  budget_max?: number;
};

export type OfferteFormData = {
  betrag: number;
  beschreibung: string;
  verfuegbar_ab: string;
  garantie_monate?: number;
};

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

export type DashboardStats = {
  total_wohnungen: number;
  belegte_wohnungen: number;
  offene_tickets: number;
  dringende_tickets: number;
  auftragsvolumen_mtd: number;
  escrow_gesperrt: number;
  leerstandsquote: number;
};
