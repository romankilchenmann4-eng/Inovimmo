// Mietzinserhoehung — Briefvorlagen fuer Einschreiben
// Professionelle Vorlage nach Schweizer Mietrecht (OR Art. 269d, 270b)

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
}

export function generiereEinschreibenBrief(daten: MietzinsErhoehungBriefDaten): string {
  const t = `{{mieter_anrede}}

gestützt auf Art. 269d des Schweizerischen Obligationenrechts (OR) teilen wir Ihnen hiermit eine Erhöhung des Mietzinses für die Wohnung {{wohnung_bezeichnung}} an der Liegenschaft {{liegenschaft_name}}, {{liegenschaft_adresse}}, mit.

1. Mietzinsanpassung

Die Miete setzt sich wie folgt zusammen:

Nettomietzins:         CHF {{miete_alt}} auf CHF {{miete_neu}} (Erhöhung: CHF {{erhoehung_monatlich}}/Monat)
Nebenkosten (akonto):  CHF {{nebenkosten_alt}} auf CHF {{nebenkosten_neu}}
Bruttomiete:           CHF {{brutto_alt}} auf CHF {{brutto_neu}}

Die Erhöhung beträgt CHF {{erhoehung_monatlich}} pro Monat und wirkt sich auf die Bruttomiete aus.

2. Inkrafttreten

Die Mietzinserhöhung tritt {{inkrafttreten}} in Kraft.

3. Begründung

{{begruendung}}

Die detaillierte Berechnung ist dem beiliegenden amtlichen Formular zu entnehmen.

4. Rechtliches

Gemäss Art. 270b OR können Sie diese Mietzinserhöhung innert 30 Tagen nach Empfang dieses Schreibens bei der zuständigen Schlichtungsbehörde für Mietsachen anfechten. Das Anfechtungsrecht entsteht mit dem Erhalt dieses Einschreibens.

Wir weisen Sie darauf hin, dass Sie das amtliche Formular zur Mietzinserhöhung (Art. 269d Abs. 1 OR) zusammen mit diesem Schreiben erhalten. Das Formular liegt diesem Einschreiben bei.

5. Kontakt

Sollten Sie Fragen zu dieser Mitteilung haben, stehen wir Ihnen gerne zur Verfügung.

Freundliche Grüsse


{{eigentuemer_name}}
{{eigentuemer_adresse}}
{{eigentuemer_ort}}

Beilagen:
– Amtliches Formular zur Mietzinserhöhung (Art. 269d OR)`;

  return ersetzePlatzhalter(t, daten);
}

function ersetzePlatzhalter(text: string, daten: MietzinsErhoehungBriefDaten): string {
  const map: Record<string, string> = { ...daten };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] ?? '');
}