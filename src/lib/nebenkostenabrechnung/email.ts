// ── Nebenkostenabrechnung E-Mail Template ─────────────────────
// E-mail notification for NK settlement dispatch (informational only,
// actual settlement is sent per Einschreiben/postal mail)

import type { BegleitschreibenTon } from "./types";

export interface NKVersandEmailData {
  mieter_name: string;
  mieter_email: string;
  liegenschaft_name: string;
  wohnung_bezeichnung: string;
  jahr: number;
  saldo_typ: "Nachzahlung" | "Guthaben";
  saldo_betrag: number;
  verwalter_name: string;
  verwalter_email: string;
  versand_methode: "einschreiben" | "a_post" | "email";
  ton: BegleitschreibenTon;
}

export function nkVersandSubject(data: NKVersandEmailData): string {
  if (data.ton === "streng") {
    return `Nebenkostenabrechnung ${data.jahr} – ${data.liegenschaft_name} – Wohnung ${data.wohnung_bezeichnung}`;
  }
  return `Ihre Nebenkostenabrechnung ${data.jahr} – ${data.liegenschaft_name}`;
}

export function nkVersandHtml(data: NKVersandEmailData): string {
  const isNachzahlung = data.saldo_typ === "Nachzahlung";
  const isEinschreiben = data.versand_methode === "einschreiben";

  const begruessung = data.ton === "freundlich"
    ? `Liebe/r ${data.mieter_name}`
    : `Sehr geehrte/r ${data.mieter_name}`;

  const versandHinweis = isEinschreiben
    ? "per Einschreiben"
    : data.versand_methode === "a_post"
    ? "per A-Post"
    : "per E-Mail";

  const saldoHinweis = isNachzahlung
    ? `<p>Die Abrechnung ergibt eine <strong>Nachzahlung von CHF ${data.saldo_betrag.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</strong>.</p>
       <p>Bitte überweisen Sie den Betrag innerhalb der in der Abrechnung angegebenen Zahlungsfrist.</p>`
    : `<p>Die Abrechnung ergibt ein <strong>Guthaben von CHF ${data.saldo_betrag.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</strong>. Dieses wird mit der nächsten Miete verrechnet.</p>`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #14294a; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 18px;">Nebenkostenabrechnung ${data.jahr}</h1>
        <p style="color: #b0c4de; margin: 5px 0 0 0; font-size: 13px;">${data.liegenschaft_name} · Wohnung ${data.wohnung_bezeichnung}</p>
      </div>

      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        <p>${begruessung},</p>

        <p>wir bestätigen Ihnen hiermit den Versand der Nebenkostenabrechnung für das Jahr ${data.jahr} <strong>${versandHinweis}</strong>.</p>

        ${saldoHinweis}

        <p>Die detaillierte Abrechnung geht Ihnen ${versandHinweis} zu. Sie enthält alle Kostenpositionen, den Verteilschlüssel und die rechtlichen Hinweise zur Belegeinsicht.</p>

        <div style="background: #f5f7fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0; font-size: 13px; color: #666;">
            <strong>Hinweis:</strong> Die Belege können während 14 Tagen bei der Verwaltung eingesehen werden.
            Bitte vereinbaren Sie hierfür einen Termin.
          </p>
        </div>

        <p>Mit freundlichen Grüssen</p>
        <p><strong>${data.verwalter_name}</strong></p>
      </div>

      <div style="background: #f5f7fa; padding: 15px; border-radius: 0 0 8px 8px; font-size: 11px; color: #999;">
        <p style="margin: 0;">Diese E-Mail wurde automatisch durch Inovimmo erstellt. Bitte antworten Sie nicht auf diese E-Mail.</p>
      </div>
    </div>
  `;
}

export function nkVersandText(data: NKVersandEmailData): string {
  const isNachzahlung = data.saldo_typ === "Nachzahlung";
  const isEinschreiben = data.versand_methode === "einschreiben";

  const versandHinweis = isEinschreiben ? "per Einschreiben" : data.versand_methode === "a_post" ? "per A-Post" : "per E-Mail";
  const begruessung = data.ton === "freundlich"
    ? `Liebe/r ${data.mieter_name}`
    : `Sehr geehrte/r ${data.mieter_name}`;

  const saldoInfo = isNachzahlung
    ? `Die Abrechnung ergibt eine Nachzahlung von CHF ${data.saldo_betrag.toLocaleString("de-CH", { minimumFractionDigits: 2 })}. Bitte überweisen Sie den Betrag innerhalb der Zahlungsfrist.`
    : `Die Abrechnung ergibt ein Guthaben von CHF ${data.saldo_betrag.toLocaleString("de-CH", { minimumFractionDigits: 2 })}. Dieses wird mit der nächsten Miete verrechnet.`;

  return `${begruessung},

wir bestätigen Ihnen hiermit den Versand der Nebenkostenabrechnung für das Jahr ${data.jahr} ${versandHinweis}.

${saldoInfo}

Die Belege können während 14 Tagen bei der Verwaltung eingesehen werden.

Mit freundlichen Grüssen
${data.verwalter_name}

---
Diese E-Mail wurde automatisch durch Inovimmo erstellt.`;
}