import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
}

const FROM = "Inovimmo <noreply@inovimmo.ch>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://inovimmo.ch";

// ── EMAIL TEMPLATES ────────────────────────────────────────────────────────────

function baseTemplate(content: string, preheader = "") {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Inovimmo</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${"${preheader ? `<div style=\"display:none;max-height:0;overflow:hidden;\">${preheader}</div>` : \"\"}"}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#0F2040;border-radius:12px 12px 0 0;padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
              🏛 Inovimmo
            </td>
            <td align="right" style="color:rgba(255,255,255,0.4);font-size:12px;">
              Swiss Property Intelligence
            </td>
          </tr></table>
        </td></tr>
        <!-- Content -->
        <tr><td style="background:white;padding:32px;border-radius:0 0 12px 12px;">
          ${"${content}"}
          <!-- Footer -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E7EB;">
            <tr><td style="color:#9CA3AF;font-size:11px;text-align:center;">
              © 2026 Inovimmo · Zürich, Schweiz<br>
              <a href="${"${BASE_URL}"}" style="color:#1D6EE0;text-decoration:none;">inovimmo.ch</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:#1D6EE0;border-radius:8px;padding:12px 24px;">
      <a href="${"${url}"}" style="color:white;font-weight:600;font-size:14px;text-decoration:none;">${"${text}"}</a>
    </td></tr>
  </table>`;
}

function infoBox(content: string, color = "#EFF6FF", border = "#BFDBFE") {
  return `<div style="background:${"${color}"};border:1px solid ${"${border}"};border-radius:8px;padding:16px;margin:16px 0;font-size:13px;color:#374151;line-height:1.6;">
    ${"${content}"}
  </div>`;
}

function kv(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;color:#6B7280;font-size:13px;width:140px;">${"${label}"}</td>
    <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:500;">${"${value}"}</td>
  </tr>`;
}

// ── SEND FUNCTIONS ──────────────────────────────────────────────────────────────

export async function sendTicketBestaetigung({
  to, name, ticketTitel, ticketId, liegenschaft, prioritaet,
}: {
  to: string; name: string; ticketTitel: string; ticketId: string; liegenschaft: string; prioritaet: string;
}) {
  const prioColor = prioritaet === "notfall" ? "#DC2626" : prioritaet === "dringend" ? "#D97706" : "#059669";
  const prioLabel = prioritaet === "notfall" ? "🔥 Notfall" : prioritaet === "dringend" ? "⚡ Dringend" : "Normal";

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">Ticket erstellt ✓</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${name},<br>Ihr Ticket wurde erfolgreich erstellt. Qualifizierte Dienstleister werden automatisch benachrichtigt.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      <tr><td colspan="2" style="padding-bottom:12px;border-bottom:1px solid #F3F4F6;margin-bottom:8px;">
        <strong style="font-size:15px;color:#111827;">${ticketTitel}</strong>
      </td></tr>
      ${kv("Liegenschaft", liegenschaft)}
      ${kv("Priorität", `<span style="color:${prioColor};font-weight:600;">${prioLabel}</span>`)}
      ${kv("Ticket-ID", `#${ticketId.slice(0,8)}`)}
      ${kv("Status", "Ausgeschrieben")}
    </table>
    ${infoBox("ℹ️ Was passiert als nächstes? Passende Dienstleister in der Region werden benachrichtigt und können Offerten einreichen. Sie erhalten eine E-Mail sobald Offerten eingegangen sind.")}
    ${btn("Ticket anzeigen", `${BASE_URL}/dashboard/tickets/${ticketId}`)}
  `, `Ticket "${ticketTitel}" wurde erstellt`);

  return getResend().emails.send({
    from: FROM, to, subject: `✓ Ticket erstellt: ${ticketTitel}`, html,
  });
}

export async function sendOfferteEingegangen({
  to, verwalterName, ticketTitel, ticketId, dienstleisterName, betrag, anzahlOfferten,
}: {
  to: string; verwalterName: string; ticketTitel: string; ticketId: string;
  dienstleisterName: string; betrag: number; anzahlOfferten: number;
}) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">Neue Offerte eingegangen 📋</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${verwalterName},<br>eine neue Offerte wurde für Ihr Ticket eingereicht.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Ticket", ticketTitel)}
      ${kv("Dienstleister", dienstleisterName)}
      ${kv("Offerte", `CHF ${betrag.toLocaleString("de-CH")}`)}
      ${kv("Total Offerten", `${anzahlOfferten} eingegangen`)}
    </table>
    ${infoBox(`🔒 <strong>Sicherheitshinweis:</strong> Diese Offerte ist versiegelt und kann nicht nachträglich geändert werden. Alle Kommunikation läuft über Inovimmo.`, "#ECFDF5", "#A7F3D0")}
    ${btn("Offerten vergleichen & vergeben", `${BASE_URL}/dashboard/tickets/${ticketId}`)}
  `, `Neue Offerte: CHF ${betrag.toLocaleString("de-CH")} von ${dienstleisterName}`);

  return getResend().emails.send({
    from: FROM, to, subject: `📋 Neue Offerte: ${ticketTitel} — CHF ${betrag.toLocaleString("de-CH")}`, html,
  });
}

export async function sendAuftragVergeben({
  to, dienstleisterName, ticketTitel, ticketId, betrag, verwalterName, verfuegbarAb,
}: {
  to: string; dienstleisterName: string; ticketTitel: string; ticketId: string;
  betrag: number; verwalterName: string; verfuegbarAb: string;
}) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">Auftrag erhalten! 🎉</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${dienstleisterName},<br>Ihre Offerte wurde akzeptiert. Der Auftraggeber überweist den Betrag auf das Escrow-Konto.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Auftrag", ticketTitel)}
      ${kv("Auftraggeber", verwalterName)}
      ${kv("Ihr Betrag", `CHF ${betrag.toLocaleString("de-CH")}`)}
      ${kv("Verfügbar ab", new Date(verfuegbarAb).toLocaleDateString("de-CH"))}
      ${kv("Auszahlung", "Nach Auftragsbestätigung")}
    </table>
    ${infoBox(`💡 <strong>Wie läuft es ab?</strong><br>1. Auftraggeber zahlt auf Escrow-Konto ein<br>2. Sie führen den Auftrag aus<br>3. Auftraggeber bestätigt die Abnahme<br>4. Inovimmo zahlt CHF ${(betrag * 0.94).toLocaleString("de-CH")} auf Ihr Konto aus (nach 6% Provision)`, "#FFFBEB", "#FDE68A")}
    ${btn("Auftrag Details anzeigen", `${BASE_URL}/dashboard/dienstleister`)}
  `, `Auftrag erhalten: ${ticketTitel}`);

  return getResend().emails.send({
    from: FROM, to, subject: `🎉 Auftrag erhalten: ${ticketTitel} — CHF ${betrag.toLocaleString("de-CH")}`, html,
  });
}

export async function sendEscrowEinbezahlt({
  to, dienstleisterName, ticketTitel, betrag, escrowId,
}: {
  to: string; dienstleisterName: string; ticketTitel: string; betrag: number; escrowId: string;
}) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">Zahlung gesichert 🔒</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${dienstleisterName},<br>der Auftraggeber hat CHF ${betrag.toLocaleString("de-CH")} auf das Escrow-Konto eingezahlt. Sie können mit der Arbeit beginnen.</p>
    ${infoBox(`✅ <strong>CHF ${betrag.toLocaleString("de-CH")}</strong> sind sicher hinterlegt und werden nach Ihrer Arbeitsabnahme freigegeben.`, "#ECFDF5", "#A7F3D0")}
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Auftrag", ticketTitel)}
      ${kv("Gesicherter Betrag", `CHF ${betrag.toLocaleString("de-CH")}`)}
      ${kv("Escrow-ID", `#${escrowId.slice(0,8)}`)}
      ${kv("Status", "Bereit zur Ausführung")}
    </table>
    ${btn("Zum Auftrag", `${BASE_URL}/dashboard/dienstleister`)}
  `, `CHF ${betrag.toLocaleString("de-CH")} im Escrow gesichert`);

  return getResend().emails.send({
    from: FROM, to, subject: `🔒 Zahlung gesichert: CHF ${betrag.toLocaleString("de-CH")} für "${ticketTitel}"`, html,
  });
}

export async function sendAuftragAbgeschlossen({
  to, name, ticketTitel, betrag, auszahlung, isVerwalter,
}: {
  to: string; name: string; ticketTitel: string; betrag: number; auszahlung: number; isVerwalter: boolean;
}) {
  const html = baseTemplate(isVerwalter ? `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">Auftrag abgeschlossen ✅</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${name},<br>der Auftrag wurde abgeschlossen und die Zahlung freigegeben.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Auftrag", ticketTitel)}
      ${kv("Bezahlter Betrag", `CHF ${betrag.toLocaleString("de-CH")}`)}
      ${kv("Status", "Abgeschlossen")}
    </table>
    ${btn("Bewertung abgeben", `${BASE_URL}/dashboard/tickets`)}
  ` : `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">Zahlung eingegangen 💰</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${name},<br>der Auftrag wurde bestätigt. Ihre Auszahlung wird verarbeitet.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Auftrag", ticketTitel)}
      ${kv("Auszahlung", `CHF ${auszahlung.toLocaleString("de-CH")}`)}
      ${kv("Provision (6%)", `CHF ${(betrag - auszahlung).toLocaleString("de-CH")}`)}
      ${kv("Verarbeitung", "1–3 Werktage")}
    </table>
    ${btn("Details anzeigen", `${BASE_URL}/dashboard/dienstleister`)}
  `, `Auftrag "${ticketTitel}" abgeschlossen`);

  return getResend().emails.send({
    from: FROM, to,
    subject: isVerwalter ? `✅ Auftrag abgeschlossen: ${ticketTitel}` : `💰 Auszahlung: CHF ${auszahlung.toLocaleString("de-CH")} für "${ticketTitel}"`,
    html,
  });
}

export async function sendWillkommen({
  to, name, role,
}: {
  to: string; name: string; role: string;
}) {
  const roleLabel = role === "verwalter" ? "Immobilienverwalter" : role === "mieter" ? "Mieter" : "Dienstleister";
  const roleDesc = role === "verwalter"
    ? "Sie können jetzt Liegenschaften erfassen, Tickets erstellen und Dienstleister koordinieren — kostenlos."
    : role === "mieter"
    ? "Sie können jetzt Schäden melden, Dokumente einsehen und den Status Ihrer Tickets verfolgen."
    : "Sie können jetzt offene Ausschreibungen sehen und Offerten einreichen.";

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">Willkommen bei Inovimmo! 🏛</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${name},<br>Ihr Konto als <strong>${roleLabel}</strong> wurde erfolgreich erstellt.</p>
    ${infoBox(`✅ ${roleDesc}`, "#EFF6FF", "#BFDBFE")}
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">
      ${role === "verwalter" ? `
        <tr><td style="padding:8px 0;font-size:13px;color:#374151;">✓ Liegenschaft hinzufügen</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#374151;">✓ Erstes Ticket erstellen</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#374151;">✓ Dienstleister einladen</td></tr>
      ` : role === "mieter" ? `
        <tr><td style="padding:8px 0;font-size:13px;color:#374151;">✓ Wohnungsübersicht ansehen</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#374151;">✓ Schaden melden</td></tr>
      ` : `
        <tr><td style="padding:8px 0;font-size:13px;color:#374151;">✓ Profil vervollständigen</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#374151;">✓ Kategorien festlegen</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#374151;">✓ Erste Offerte einreichen</td></tr>
      `}
    </table>
    ${btn("Jetzt loslegen", `${BASE_URL}/dashboard`)}
    <p style="margin:16px 0 0;color:#9CA3AF;font-size:12px;">Inovimmo ist kostenlos für ${role === "dienstleister" ? "die Grundfunktionen" : "Sie"}. Keine Kreditkarte erforderlich.</p>
  `, `Willkommen bei Inovimmo, ${name}!`);

  return getResend().emails.send({
    from: FROM, to, subject: `🏛 Willkommen bei Inovimmo, ${name}!`, html,
  });
}

export async function sendTicketStatusUpdate({
  to, name, ticketTitel, ticketId, neuerStatus,
}: {
  to: string; name: string; ticketTitel: string; ticketId: string; neuerStatus: string;
}) {
  const STATUS: Record<string, { label: string; icon: string; desc: string }> = {
    ausgeschrieben:       { label: "Ausgeschrieben",    icon: "📢", desc: "Dienstleister werden benachrichtigt." },
    offerten_eingegangen: { label: "Offerten eingegangen", icon: "📋", desc: "Sie können jetzt Offerten vergleichen." },
    vergeben:             { label: "Auftrag vergeben",   icon: "✅", desc: "Der Dienstleister wurde informiert." },
    in_ausfuehrung:       { label: "In Ausführung",     icon: "🔨", desc: "Der Dienstleister ist am Arbeiten." },
    abgeschlossen:        { label: "Abgeschlossen",      icon: "🎉", desc: "Bitte Bewertung abgeben." },
  };
  const s = STATUS[neuerStatus] ?? { label: neuerStatus, icon: "ℹ️", desc: "" };

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">${s.icon} Ticket-Update</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${name},<br>der Status Ihres Tickets hat sich geändert.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Ticket", ticketTitel)}
      ${kv("Neuer Status", `<strong>${s.label}</strong>`)}
    </table>
    ${infoBox(`${s.icon} ${s.desc}`)}
    ${btn("Ticket anzeigen", `${BASE_URL}/dashboard/tickets/${ticketId}`)}
  `, `${ticketTitel}: ${s.label}`);

  return getResend().emails.send({
    from: FROM, to, subject: `${s.icon} ${ticketTitel}: ${s.label}`, html,
  });
}

export async function sendMahnung({
  to, mieterName, wohnung, liegenschaft, offenerBetrag, offeneMonate, mahnstufe,
}: {
  to: string; mieterName: string; wohnung: string; liegenschaft: string;
  offenerBetrag: number; offeneMonate: string[]; mahnstufe: 1 | 2 | 3;
}) {
  const STUFEN = {
    1: { titel: "Zahlungserinnerung", icon: "⚠️", farbe: "#D97706", frist: 10, ton: "freundlich" },
    2: { titel: "2. Mahnung",         icon: "🔴", farbe: "#DC2626", frist: 7,  ton: "bestimmt" },
    3: { titel: "Letzte Mahnung vor rechtlichen Schritten", icon: "🚨", farbe: "#991B1B", frist: 5, ton: "rechtlich" },
  };
  const s = STUFEN[mahnstufe];
  const faellig = new Date(); faellig.setDate(faellig.getDate() + s.frist);

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">${s.icon} ${s.titel}</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">
      ${mahnstufe === 1
        ? `Hallo ${mieterName},<br>wir möchten Sie freundlich daran erinnern, dass folgende Mietzahlung noch ausstehend ist.`
        : mahnstufe === 2
        ? `Hallo ${mieterName},<br>trotz unserer Zahlungserinnerung ist der ausstehende Betrag noch nicht eingegangen. Wir bitten Sie dringend, die Zahlung umgehend vorzunehmen.`
        : `Hallo ${mieterName},<br>wir stellen fest, dass der ausstehende Betrag trotz wiederholter Mahnungen nicht beglichen wurde. Dies ist unsere letzte Mahnung vor Einleitung rechtlicher Schritte.`
      }
    </p>
    <div style="background:#FEF2F2;border:2px solid ${s.farbe};border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">Ausstehender Betrag</p>
      <p style="margin:0;font-size:28px;font-weight:700;color:${s.farbe};">CHF ${offenerBetrag.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</p>
    </div>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Wohnung", `${wohnung}`)}
      ${kv("Liegenschaft", liegenschaft)}
      ${kv("Offene Periode(n)", offeneMonate.join(", "))}
      ${kv("Zahlungsfrist", faellig.toLocaleDateString("de-CH"))}
    </table>
    ${mahnstufe === 3 ? infoBox(
      `⚖️ <strong>Rechtliche Hinweise:</strong> Bei ausbleibender Zahlung bis ${faellig.toLocaleDateString("de-CH")} sind wir gezwungen, das Betreibungsverfahren einzuleiten (SchKG Art. 67). Zusätzliche Kosten gehen zu Ihren Lasten.`,
      "#FEF2F2", "#FECACA"
    ) : infoBox(
      `💳 Bitte überweisen Sie den Betrag auf das Ihnen bekannte Konto. Bei Fragen wenden Sie sich an Ihre Verwaltung.`
    )}
    ${btn("Kontakt Verwaltung", `${BASE_URL}/dashboard`)}
  `, `${s.titel}: CHF ${offenerBetrag.toLocaleString("de-CH", { minimumFractionDigits: 2 })} ausstehend`);

  return getResend().emails.send({
    from: FROM, to,
    subject: `${s.icon} ${s.titel} — CHF ${offenerBetrag.toLocaleString("de-CH", { minimumFractionDigits: 2 })} ausstehend`,
    html,
  });
}

export async function sendNachrichtBenachrichtigung({
  to, empfaengerName, absenderName, betreff, vorschau,
}: {
  to: string; empfaengerName: string; absenderName: string; betreff: string; vorschau: string;
}) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">💬 Neue Nachricht</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Hallo ${empfaengerName},<br>Sie haben eine neue Nachricht von <strong>${absenderName}</strong> erhalten.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Von", absenderName)}
      ${kv("Betreff", betreff)}
    </table>
    ${infoBox(`"${vorschau}${vorschau.length >= 100 ? "…" : ""}"`)}
    ${btn("Nachricht lesen", `${BASE_URL}/dashboard/nachrichten`)}
    <p style="margin:16px 0 0;color:#9CA3AF;font-size:12px;">Diese Nachricht wurde über Inovimmo gesendet und ist nur in Ihrer Inbox sichtbar.</p>
  `, `Neue Nachricht von ${absenderName}: ${betreff}`);

  return getResend().emails.send({
    from: FROM, to,
    subject: `💬 ${absenderName}: ${betreff}`,
    html,
  });
}

export async function sendVertragAblauf({
  to, verwalterName, mieterName, wohnung, liegenschaft, mietende, mietbeginn,
}: {
  to: string; verwalterName: string; mieterName: string;
  wohnung: string; liegenschaft: string; mietende: string; mietbeginn: string;
}) {
  const endeDate = new Date(mietende);
  const daysLeft = Math.ceil((endeDate.getTime() - Date.now()) / 86400000);

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F2040;">📅 Mietvertrag läuft ab</h2>
    <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">
      Guten Tag ${verwalterName},<br>folgender Mietvertrag endet in <strong>${daysLeft} Tagen</strong>.
      Bitte prüfen Sie, ob eine Verlängerung oder Neuvermietung gewünscht ist.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${kv("Mieter/in", mieterName)}
      ${kv("Wohnung", wohnung)}
      ${kv("Liegenschaft", liegenschaft)}
      ${kv("Mietbeginn", new Date(mietbeginn).toLocaleDateString("de-CH"))}
      ${kv("Mietende", endeDate.toLocaleDateString("de-CH"))}
      ${kv("Verbleibend", `${daysLeft} Tage`)}
    </table>
    ${infoBox(`
      <strong>Empfohlene Aktionen:</strong><br>
      • Mieter kontaktieren bezüglich Verlängerung oder Kündigung<br>
      • Bei Auszug: Übergabetermin vereinbaren und Wohnungsabnahme planen<br>
      • Neue Ausschreibung erstellen falls Neuvermietung gewünscht
    `)}
    ${btn("Zum Dashboard", `${BASE_URL}/dashboard/mietvertrag`)}
  `, `Mietvertrag endet in ${daysLeft} Tagen — ${wohnung}, ${liegenschaft}`);

  return getResend().emails.send({
    from: FROM, to,
    subject: `📅 Mietvertrag endet in ${daysLeft} Tagen — ${wohnung}`,
    html,
  });
}
