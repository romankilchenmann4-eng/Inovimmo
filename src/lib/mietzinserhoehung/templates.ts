// Mietzinserhoehung — Briefvorlagen fuer Einschreiben (HEV-konform, 4 Bloecke)

export interface MietzinsErhoehungBriefDaten {
  mieter_anrede: string;
  mieter_name: string;
  wohnung_bezeichnung: string;
  liegenschaft_adresse: string;
  liegenschaft_name: string;
  miete_alt: string;
  miete_neu: string;
  nebenkosten_alt: string;
  nebenkosten_neu: string;
  brutto_alt: string;
  brutto_neu: string;
  erhoehung_monatlich: string;
  erhoehung_prozent: string;
  inkrafttreten: string;
  eigentuemer_name: string;
  eigentuemer_adresse: string;
  eigentuemer_ort: string;
  begruendung: string;
  datum_ort: string;
  datum: string;
  // HEV 4-Block Details
  block_referenzzins_text?: string;
  block_teuerung_text?: string;
  block_kostensteigerung_text?: string;
  block_investition_text?: string;
}

export function generiereEinschreibenBrief(daten: MietzinsErhoehungBriefDaten): string {
  const bloecke: string[] = [];

  if (daten.block_referenzzins_text) {
    bloecke.push(`a) Referenzzinssatz-Änderung:\n${daten.block_referenzzins_text}`);
  }
  if (daten.block_teuerung_text) {
    bloecke.push(`b) Teuerungsausgleich:\n${daten.block_teuerung_text}`);
  }
  if (daten.block_kostensteigerung_text) {
    bloecke.push(`c) Allgemeine Kostensteigerung:\n${daten.block_kostensteigerung_text}`);
  }
  if (daten.block_investition_text) {
    bloecke.push(`d) Wertvermehrende Investition:\n${daten.block_investition_text}`);
  }

  const begruendungstext = bloecke.length > 0
    ? bloecke.join('\n\n')
    : daten.begruendung;

  const t = `{{mieter_anrede}}

wir teilen Ihnen hiermit eine Erhöhung des Nettomietzinses für die Wohnung {{wohnung_bezeichnung}} an der Liegenschaft {{liegenschaft_name}}, {{liegenschaft_adresse}}, mit.

1. Mietzinsanpassung

Nettomietzins:         CHF {{miete_alt}} auf CHF {{miete_neu}} (Erhöhung: CHF {{erhoehung_monatlich}}/Monat)
Nebenkosten (akonto):  CHF {{nebenkosten_alt}}

2. Begründung

${begruendungstext}

3. Inkrafttreten

Die Mietzinserhöhung tritt auf den nächstmöglichen Kündigungstermin in Kraft.

Das amtliche Formular liegt diesem Einschreiben bei.

Freundliche Grüsse


{{eigentuemer_name}}
{{eigentuemer_adresse}}
{{eigentuemer_ort}}

Beilagen:
– Amtliches Formular zur Mietzinserhöhung`;

  return ersetzePlatzhalter(t, daten);
}

function ersetzePlatzhalter(text: string, daten: MietzinsErhoehungBriefDaten): string {
  const map: Record<string, string> = { ...daten };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] ?? '');
}