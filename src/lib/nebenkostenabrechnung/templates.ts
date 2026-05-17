// ── Nebenkostenabrechnung Template System ─────────────────────
// Cover letter templates with placeholder substitution

import type { BegleitschreibenTon } from "./types";

// ── Available Placeholders ────────────────────────────────────
export interface TemplatePlatzhalter {
  mieter_name: string;
  mieter_adresse: string;
  wohnung_bezeichnung: string;
  liegenschaft_name: string;
  liegenschaft_adresse: string;
  periode: string;
  jahr: string;
  kosten_total: string;
  akonto_total: string;
  saldo: string;
  saldo_gerundet: string;
  saldo_typ: string;
  zahlungsfrist: string;
  bankverbindung: string;
  verwalter_name: string;
  verwalter_adresse: string;
}

// ── Default Sender (Kurt Rusch) ────────────────────────────────
export const DEFAULT_ABSNDER = {
  name: "Kurt Rusch",
  strasse: "Rebackerstrasse 22",
  plz: "8955",
  ort: "Oetwil an der Limmat",
};

export const DEFAULT_BANKVERBINDUNG = {
  iban: "",
  bank_name: "",
  qr_iban: "",
};

// ── Placeholder Substitution ──────────────────────────────────
export function ersetzePlatzhalter(template: string, daten: TemplatePlatzhalter): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return String((daten as any)[key] ?? match);
  });
}

// ── Default Templates ─────────────────────────────────────────
export const DEFAULT_TEMPLATES: Record<BegleitschreibenTon, {
  betreff: string;
  anrede: string;
  einleitung: string;
  schluss: string;
  zahlungshinweis: string;
  belege_hinweis: string;
  absender: string;
}> = {
  neutral: {
    betreff: "Nebenkostenabrechnung {{periode}} – {{liegenschaft_name}}",
    anrede: "Sehr geehrte/r {{mieter_name}},",
    einleitung: `hiermit erhalten Sie die Nebenkostenabrechnung für die Abrechnungsperiode {{periode}} für die Wohnung {{wohnung_bezeichnung}} an der {{liegenschaft_adresse}} per Einschreiben.

Die Abrechnung ergibt einen {{saldo_typ}} von CHF {{saldo_gerundet}}.

Die aufgeschlüsselten Kosten und Ihr Anteil sind der beiliegenden detaillierten Abrechnung zu entnehmen.`,
    schluss: "Die Belege können während 14 Tagen bei der Verwaltung eingesehen werden. Bitte vereinbaren Sie hierfür einen Termin.\n\nFreundliche Grüsse",
    zahlungshinweis: "{{saldo_typ_nach}}Bitte überweisen Sie den Betrag von CHF {{saldo_gerundet}} bis {{zahlungsfrist}} auf das unten angegebene Konto:\n\n{{bankverbindung}}\n\nVerwenden Sie als Verwendungszweck: «Nebenkostenabrechnung {{jahr}} – {{wohnung_bezeichnung}}»{{saldo_typ_nach_end}}{{saldo_typ_gut}}Ein Guthaben von CHF {{saldo_gerundet}} wird mit der nächsten Mietzahlung verrechnet.{{saldo_typ_gut_end}}",
    belege_hinweis: "Die Belege können während 14 Tagen bei der Verwaltung eingesehen werden.",
    absender: "Kurt Rusch\nRebackerstrasse 22\n8955 Oetwil an der Limmat",
  },
  freundlich: {
    betreff: "Ihre Nebenkostenabrechnung {{periode}} – {{liegenschaft_name}}",
    anrede: "Liebe/r {{mieter_name}},",
    einleitung: `ich sende Ihnen hiermit die Nebenkostenabrechnung für die Periode {{periode}} für Ihre Wohnung {{wohnung_bezeichnung}} per Einschreiben.

{{saldo_typ_gut}}Gute Nachricht: Es ergibt sich ein Guthaben von CHF {{saldo_gerundet}}! Wir werden dies mit der nächsten Miete verrechnen.{{saldo_typ_gut_end}}{{saldo_typ_nach}}Die Abrechnung ergibt eine Nachzahlung von CHF {{saldo_gerundet}}.{{saldo_typ_nach_end}}

Die detaillierte Aufschlüsselung finden Sie in der beiliegenden Abrechnung.`,
    schluss: "Die Belege liegen während 14 Tagen in unserer Geschäftsstelle zur Einsicht auf. Gerne können Sie auch einen Termin vereinbaren.\n\nHerzliche Grüsse",
    zahlungshinweis: "{{saldo_typ_nach}}Bitte überweisen Sie den Betrag von CHF {{saldo_gerundet}} bis {{zahlungsfrist}} auf unser Konto:\n\n{{bankverbindung}}\n\nVerwendungszweck: «Nebenkosten {{jahr}} – {{wohnung_bezeichnung}}»{{saldo_typ_nach_end}}{{saldo_typ_gut}}Das Guthaben von CHF {{saldo_gerundet}} wird automatisch mit der nächsten Miete verrechnet.{{saldo_typ_gut_end}}",
    belege_hinweis: "Die Belege liegen während 14 Tagen in unserer Geschäftsstelle zur Einsicht auf.",
    absender: "Kurt Rusch\nRebackerstrasse 22\n8955 Oetwil an der Limmat",
  },
  streng: {
    betreff: "Nebenkostenabrechnung {{periode}} – {{liegenschaft_name}} – Zahlungsaufforderung",
    anrede: "Sehr geehrte/r {{mieter_name}},",
    einleitung: `nachstehend erhalten Sie die rechtskräftige Nebenkostenabrechnung für die Periode {{periode}} gemäss Art. 257d OR für die Wohnung {{wohnung_bezeichnung}} an der {{liegenschaft_adresse}} per Einschreiben.

Die Abrechnung ergibt eine Nachzahlung von CHF {{saldo_gerundet}}.

Die aufgeschlüsselten Kosten und Ihr Anteil sind der beiliegenden detaillierten Abrechnung zu entnehmen.`,
    schluss: "Die Belege können gemäss Art. 257d Abs. 4 OR während 14 Tagen bei der Verwaltung eingesehen werden. Eine Verlängerung der Einsichtsfrist ist auf schriftlichen Antrag möglich.\n\nHochachtungsvoll",
    zahlungshinweis: `Wir fordern Sie auf, den Betrag von CHF {{saldo_gerundet}} bis spätestens {{zahlungsfrist}} auf das folgende Konto zu überweisen:

{{bankverbindung}}

Verwendungszweck: «Nebenkostenabrechnung {{jahr}} – {{wohnung_bezeichnung}}»

Nach Ablauf der Frist behalten wir uns rechtliche Schritte gemäss Art. 257d OR vor.`,
    belege_hinweis: "Die Belege können gemäss Art. 257d Abs. 4 OR während 14 Tagen eingesehen werden.",
    absender: "Kurt Rusch\nRebackerstrasse 22\n8955 Oetwil an der Limmat",
  },
};

// ── Generate Full Cover Letter Text ────────────────────────────
export function generiereBegleitschreiben(
  ton: BegleitschreibenTon,
  daten: TemplatePlatzhalter
): string {
  const t = DEFAULT_TEMPLATES[ton];

  // Handle conditional blocks for saldo_typ
  const isNachzahlung = daten.saldo_typ === "Nachzahlung";
  const processConditional = (text: string) =>
    text
      .replace(/\{\{saldo_typ_nach\}\}/g, isNachzahlung ? "" : "{{saldo_typ_nach}}")
      .replace(/\{\{saldo_typ_nach_end\}\}/g, isNachzahlung ? "" : "{{saldo_typ_nach_end}}")
      .replace(/\{\{saldo_typ_gut\}\}/g, !isNachzahlung ? "" : "{{saldo_typ_gut}}")
      .replace(/\{\{saldo_typ_gut_end\}\}/g, !isNachzahlung ? "" : "{{saldo_typ_gut_end}}")
      // Remove conditional blocks that don't apply
      .replace(/\{\{saldo_typ_nach\}\}([\s\S]*?)\{\{saldo_typ_nach_end\}\}/g, isNachzahlung ? "$1" : "")
      .replace(/\{\{saldo_typ_gut\}\}([\s\S]*?)\{\{saldo_typ_gut_end\}\}/g, !isNachzahlung ? "$1" : "");

  const betreff = ersetzePlatzhalter(t.betreff, daten);
  const anrede = ersetzePlatzhalter(t.anrede, daten);
  const einleitung = ersetzePlatzhalter(processConditional(t.einleitung), daten);
  const schluss = ersetzePlatzhalter(t.schluss, daten);
  const zahlungshinweis = ersetzePlatzhalter(processConditional(t.zahlungshinweis), daten);
  const absender = ersetzePlatzhalter(t.absender, daten);

  const parts = [
    betreff,
    "",
    anrede,
    "",
    einleitung,
    "",
    zahlungshinweis,
    "",
    schluss,
    "",
    "",
    absender,
  ];

  return parts.join("\n");
}

// ── Build Template Platzhalter from Data ───────────────────────
export function buildPlatzhalter(data: {
  mieter_namen: string;
  mieter_adresse: string;
  wohnung_bezeichnung: string;
  liegenschaft_name: string;
  liegenschaft_strasse?: string;
  liegenschaft_hausnummer?: string;
  liegenschaft_plz?: string;
  liegenschaft_ort?: string;
  periode_von: string;
  periode_bis: string;
  kosten_total: number;
  akonto_total: number;
  saldo: number;
  saldo_gerundet: number;
  saldo_typ: "Nachzahlung" | "Guthaben";
  zahlungsfrist: string;
  bank_iban?: string;
  bank_name?: string;
  verwalter_name?: string;
  verwalter_adresse?: string;
}): TemplatePlatzhalter {
  const formatCHF = (n: number) =>
    n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const liegenschaft_adresse = [
    data.liegenschaft_strasse,
    data.liegenschaft_hausnummer,
    data.liegenschaft_plz && data.liegenschaft_ort
      ? `${data.liegenschaft_plz} ${data.liegenschaft_ort}`
      : data.liegenschaft_ort,
  ]
    .filter(Boolean)
    .join(", ");

  const periode = `${new Date(data.periode_von).toLocaleDateString("de-CH")} – ${new Date(data.periode_bis).toLocaleDateString("de-CH")}`;

  const bankverbindung = data.bank_iban
    ? `${data.bank_name || "Bank"}\nIBAN: ${data.bank_iban}`
    : "";

  return {
    mieter_name: data.mieter_namen,
    mieter_adresse: data.mieter_adresse,
    wohnung_bezeichnung: data.wohnung_bezeichnung ?? data.wohung_bezeichnung,
    liegenschaft_name: data.liegenschaft_name,
    liegenschaft_adresse,
    periode,
    jahr: String(new Date(data.periode_von).getFullYear()),
    kosten_total: formatCHF(data.kosten_total),
    akonto_total: formatCHF(data.akonto_total),
    saldo: `${data.saldo >= 0 ? "+" : ""}${formatCHF(data.saldo)}`,
    saldo_gerundet: formatCHF(data.saldo_gerundet),
    saldo_typ: data.saldo_typ,
    zahlungsfrist: new Date(data.zahlungsfrist).toLocaleDateString("de-CH"),
    bankverbindung,
    verwalter_name: data.verwalter_name ?? DEFAULT_ABSNDER.name,
    verwalter_adresse: data.verwalter_adresse ?? `${DEFAULT_ABSNDER.name}\n${DEFAULT_ABSNDER.strasse}\n${DEFAULT_ABSNDER.plz} ${DEFAULT_ABSNDER.ort}`,
  };
}