"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  NKKategorie,
  VerteilschluesselTyp,
  BegleitschreibenTon,
  NKZaehler,
  NKVerteilschluessel,
  GemischPosition,
} from "./types";
import { berechneAbrechnungen, berechneAkontoTotal, roundCHF } from "./calc";

// ============================================================
// ABRECHNUNGEN ERSTELLEN
// ============================================================
export async function erstelleAbrechnungen(
  liegenschaft_id: string,
  jahr: number,
  periode_von: string,
  periode_bis: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht autorisiert");

  // Delete existing draft settlements for this property/year
  const { data: existing } = await supabase
    .from("nebenkostenabrechnungen")
    .select("id")
    .eq("liegenschaft_id", liegenschaft_id)
    .eq("jahr", jahr)
    .eq("status", "entwurf");

  if (existing && existing.length > 0) {
    await supabase
      .from("nebenkostenabrechnungen")
      .delete()
      .eq("liegenschaft_id", liegenschaft_id)
      .eq("jahr", jahr)
      .eq("status", "entwurf");
  }

  // Load positions
  const { data: positionen, error: posError } = await supabase
    .from("nebenkostenpositionen")
    .select("*")
    .eq("liegenschaft_id", liegenschaft_id)
    .eq("jahr", jahr);

  if (posError) throw new Error(posError.message);
  if (!positionen || positionen.length === 0) {
    throw new Error("Keine Nebenkostenpositionen für dieses Jahr vorhanden");
  }

  // Load verteilschluessel
  const { data: verteilschluessel } = await supabase
    .from("nk_verteilschluessel")
    .select("*")
    .eq("liegenschaft_id", liegenschaft_id);

  // Load zaehler
  const { data: zaehler } = await supabase
    .from("nk_zaehler")
    .select("*")
    .eq("liegenschaft_id", liegenschaft_id);

  // Load wohnungen with mieter
  const { data: wohnungen } = await supabase
    .from("wohnungen")
    .select(
      `
      id, bezeichnung, whg_nr, etage, flaeche_m2, nettomiete, nebenkosten_akonto, beheizt,
      mietverhaeltnisse:mietverhaeltnisse!inner(
        mieter_id,
        ist_hauptperson,
        mieter:mieter!inner(id, vorname, nachname, email, strasse, plz, ort)
      )
    `
    )
    .eq("liegenschaft_id", liegenschaft_id)
    .eq("status", "vermietet");

  if (!wohnungen || wohnungen.length === 0) {
    throw new Error("Keine vermieteten Wohnungen gefunden");
  }

  // Load bankkonto
  const { data: bankkonten } = await supabase
    .from("bankkonten")
    .select("id")
    .eq("verwalter_id", user.id)
    .eq("aktiv", true)
    .limit(1);

  const bankkonto_id = bankkonten?.[0]?.id ?? null;

  // Calculate akonto per wohnung
  const wohnungenMitMietern = (wohnungen as any[]).map((w: any) => {
    const mieterListe = Array.isArray(w.mietverhaeltnisse)
      ? w.mietverhaeltnisse.filter((mv: any) => mv.ist_hauptperson !== false)
      : [];
    const mieter_namen = mieterListe
      .map((mv: any) => {
        const m = mv.mieter;
        return m ? `${m.vorname} ${m.nachname}` : "Unbekannt";
      })
      .join(", ");
    const hauptMieter = mieterListe.find((mv: any) => mv.ist_hauptperson === true);
    const mieter_adresse = hauptMieter?.mieter
      ? `${hauptMieter.mieter.vorname} ${hauptMieter.mieter.nachname}\n${hauptMieter.mieter.strasse}\n${hauptMieter.mieter.plz} ${hauptMieter.mieter.ort}`
      : "Adresse unbekannt";
    const personenzahl = mieterListe.length || 1;

    return {
      id: w.id,
      bezeichnung: w.bezeichnung,
      whg_nr: w.whg_nr,
      etage: w.etage,
      flaeche_m2: Number(w.flaeche_m2 || 0),
      nettomiete: Number(w.nettomiete || 0),
      nebenkosten_akonto: Number(w.nebenkosten_akonto || 0),
      mieter_namen,
      mieter_adresse,
      personenzahl,
      beheizt: Boolean(w.beheizt),
    };
  });

  // Load akonto buchungen
  const { data: buchungen } = await supabase
    .from("buchungen")
    .select("id, betrag, valuta, periode_monat, periode_jahr")
    .eq("liegenschaft_id", liegenschaft_id)
    .in("typ", ["nk_soll", "nk_rueckerstattung"]);

  // Calculate settlements
  const ergebnisse = berechneAbrechnungen({
    positionen: positionen.map((p: any) => ({
      ...p,
      betrag_total: Number(p.betrag_total || 0),
      mwst_prozent: Number(p.mwst_prozent || 0),
      umlagefaehig: p.umlagefaehig ?? true,
    })),
    verteilschluessel: (verteilschluessel ?? []) as NKVerteilschluessel[],
    zaehler: (zaehler ?? []) as NKZaehler[],
    wohnungen: wohnungenMitMietern,
    akontoBuchungen: (buchungen ?? []).map((b: any) => ({
      buchung_id: b.id,
      betrag: Number(b.betrag || 0),
      valuta: b.valuta,
      periode_monat: b.periode_monat,
      periode_jahr: b.periode_jahr,
    })),
    periode_von,
    periode_bis,
  });

  // Create abrechnungen and position lines
  const zahlungsfrist = new Date();
  zahlungsfrist.setDate(zahlungsfrist.getDate() + 30);

  const abrechnungenData = ergebnisse.map((erg) => ({
    wohnung_id: erg.wohnung_id,
    liegenschaft_id,
    jahr,
    periode_von,
    periode_bis,
    akonto_total: erg.akonto_total,
    kosten_total: erg.kosten_total,
    status: "entwurf",
    zahlungsfrist: zahlungsfrist.toISOString().split("T")[0],
    begleitschreiben_ton: "neutral" as const,
    bankkonto_id,
    verwalter_id: user.id,
  }));

  const { data: insertedAbrechnungen, error: insertError } = await supabase
    .from("nebenkostenabrechnungen")
    .insert(abrechnungenData)
    .select("id, wohnung_id");

  if (insertError) throw new Error(insertError.message);

  // Insert position lines for each abrechnung
  const allPositionLines: any[] = [];
  for (let i = 0; i < ergebnisse.length; i++) {
    const erg = ergebnisse[i];
    const abrechnung = insertedAbrechnungen?.find(
      (a: any) => a.wohnung_id === erg.wohnung_id
    );
    if (!abrechnung) continue;

    for (const pos of erg.positionen) {
      const originalPosition = positionen.find((p: any) => p.id === pos.position_id);
      allPositionLines.push({
        abrechnung_id: abrechnung.id,
        position_id: pos.position_id,
        bezeichnung: pos.bezeichnung,
        kategorie: pos.kategorie,
        betrag_total: pos.betrag_total,
        anteil_prozent: pos.anteil_prozent,
        betrag_anteil: pos.betrag_anteil,
        verteilschluessel_typ: pos.verteilschluessel_typ,
        zaehlerstand_start: pos.zaehlerstand_start ?? null,
        zaehlerstand_end: pos.zaehlerstand_end ?? null,
        verbrauch_einheit: pos.verbrauch_einheit ?? null,
      });
    }
  }

  if (allPositionLines.length > 0) {
    const { error: lineError } = await supabase
      .from("nk_abrechnung_positionen")
      .insert(allPositionLines);

    if (lineError) throw new Error(lineError.message);
  }

  return insertedAbrechnungen;
}

// ============================================================
// ZÄHLERSTÄNDE
// ============================================================
export async function speichereZaehlerstand(
  zaehler_id: string,
  stand_vorjahr: number,
  stand_endjahr: number
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nk_zaehler")
    .update({ stand_vorjahr, stand_endjahr, updated_at: new Date().toISOString() })
    .eq("id", zaehler_id);

  if (error) throw new Error(error.message);
}

export async function erstelleZaehler(
  liegenschaft_id: string,
  zaehler: {
    wohnung_id?: string;
    bezeichnung: string;
    zaehler_typ: string;
    einheit?: string;
    faktor?: number;
    notiz?: string;
  }
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nk_zaehler")
    .insert({
      liegenschaft_id,
      ...zaehler,
      einheit: zaehler.einheit ?? "kWh",
      faktor: zaehler.faktor ?? 1.0,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function loescheZaehler(zaehler_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nk_zaehler")
    .delete()
    .eq("id", zaehler_id);

  if (error) throw new Error(error.message);
}

// ============================================================
// VERTEILSCHLÜSSEL
// ============================================================
export async function speichereVerteilschluessel(
  liegenschaft_id: string,
  kategorie: NKKategorie,
  typ: VerteilschluesselTyp,
  gemischt?: GemischPosition[]
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nk_verteilschluessel")
    .upsert(
      {
        liegenschaft_id,
        kategorie,
        verteilschluessel_typ: typ,
        gemischt_positionen: gemischt ?? [],
      },
      { onConflict: "liegenschaft_id,kategorie" }
    );

  if (error) throw new Error(error.message);
}

// ============================================================
// POSITIONEN
// ============================================================
export async function speicherePosition(
  liegenschaft_id: string,
  jahr: number,
  position: {
    bezeichnung: string;
    kategorie: NKKategorie;
    betrag_total: number;
    verteilschluessel: VerteilschluesselTyp;
    mwst_prozent?: number;
    umlagefaehig?: boolean;
    zaehler_id?: string;
    notiz?: string;
  }
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nebenkostenpositionen")
    .insert({
      liegenschaft_id,
      jahr,
      ...position,
      mwst_prozent: position.mwst_prozent ?? 0,
      umlagefaehig: position.umlagefaehig ?? true,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function aktualisierePosition(
  position_id: string,
  updates: Record<string, any>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nebenkostenpositionen")
    .update(updates)
    .eq("id", position_id);

  if (error) throw new Error(error.message);
}

export async function loeschePosition(position_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nebenkostenpositionen")
    .delete()
    .eq("id", position_id);

  if (error) throw new Error(error.message);
}

// ============================================================
// ABRECHNUNG STATUS
// ============================================================
export async function setzeStatus(abrechnung_id: string, status: string) {
  const supabase = await createClient();
  const updates: Record<string, any> = { status };

  if (status === "versendet") {
    updates.versendet_an = new Date().toISOString();
  }
  if (status === "bezahlt") {
    updates.bezahlt_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("nebenkostenabrechnungen")
    .update(updates)
    .eq("id", abrechnung_id);

  if (error) throw new Error(error.message);
}

export async function markiereVersendet(abrechnung_id: string, versendet_an: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nebenkostenabrechnungen")
    .update({
      status: "versendet",
      versendet_an,
      bezahlt_at: null,
    })
    .eq("id", abrechnung_id);

  if (error) throw new Error(error.message);
}

export async function markiereBezahlt(abrechnung_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nebenkostenabrechnungen")
    .update({
      status: "bezahlt",
      bezahlt_at: new Date().toISOString(),
    })
    .eq("id", abrechnung_id);

  if (error) throw new Error(error.message);
}

// ============================================================
// BEGLEITSCHREIBEN VORLAGEN
// ============================================================
export async function generiereBegleitschreibenVorlage(
  verwalter_id: string,
  ton: BegleitschreibenTon
) {
  const supabase = await createClient();

  // Check if template already exists
  const { data: existing } = await supabase
    .from("nk_abrechnung_vorlagen")
    .select("id")
    .eq("verwalter_id", verwalter_id)
    .eq("ton", ton)
    .maybeSingle();

  if (existing) return existing;

  const templates: Record<BegleitschreibenTon, Record<string, string>> = {
    neutral: {
      betreff: "Nebenkostenabrechnung {{periode}} – {{liegenschaft_name}}",
      anrede_vorlage: "Sehr geehrte/r {{mieter_name}},",
      einleitungstext:
        "hiermit erhalten Sie die Nebenkostenabrechnung für die Abrechnungsperiode {{periode}} per Einschreiben.\n\nDie Abrechnung ergibt einen {{saldo_typ}} von CHF {{saldo_gerundet}}.",
      schlusstext:
        "Die Belege können während 14 Tagen bei der Verwaltung eingesehen werden. Bitte vereinbaren Sie hierfür einen Termin.",
      zahlungshinweis:
        "Bitte überweisen Sie den Betrag bis {{zahlungsfrist}} auf das unten angegebene Konto.",
    },
    freundlich: {
      betreff: "Ihre Nebenkostenabrechnung {{periode}} – {{liegenschaft_name}}",
      anrede_vorlage: "Liebe/r {{mieter_name}},",
      einleitungstext:
        "ich sende Ihnen hiermit die Nebenkostenabrechnung für die Periode {{periode}} per Einschreiben.\n\n{{saldo_typ_gut}}Vielen Dank für Ihre pünktlichen Akontozahlungen! Es ergibt sich ein Guthaben von CHF {{saldo_gerundet}}, das wir mit der nächsten Miete verrechnen werden.{{saldo_typ_gut_end}}{{saldo_typ_nach}}Die Abrechnung ergibt eine Nachzahlung von CHF {{saldo_gerundet}}.{{saldo_typ_nach_end}}",
      schlusstext:
        "Die Belege liegen während 14 Tagen in unserer Geschäftsstelle zur Einsicht auf. Gerne können Sie auch einen Termin vereinbaren.",
      zahlungshinweis:
        "Bitte überweisen Sie den fälligen Betrag bis {{zahlungsfrist}} auf unser Konto.",
    },
    streng: {
      betreff: "Nebenkostenabrechnung {{periode}} – {{liegenschaft_name}} – Zahlungsaufforderung",
      anrede_vorlage: "Sehr geehrte/r {{mieter_name}},",
      einleitungstext:
        "nachstehend erhalten Sie die rechtskräftige Nebenkostenabrechnung für die Periode {{periode}} gemäss Art. 257d OR per Einschreiben.\n\nDie Abrechnung ergibt eine Nachzahlung von CHF {{saldo_gerundet}}.",
      schlusstext:
        "Die Belege können gemäss Art. 257d Abs. 4 OR während 14 Tagen bei der Verwaltung eingesehen werden. Eine Verlängerung der Einsichtfrist ist auf schriftlichen Antrag möglich.",
      zahlungshinweis:
        "Wir fordern Sie auf, den Betrag bis spätestens {{zahlungsfrist}} auf das unten angegebene Konto zu überweisen. Nach Ablauf der Frist behalten wir uns rechtliche Schritte vor.",
    },
  };

  const t = templates[ton];
  const { data, error } = await supabase
    .from("nk_abrechnung_vorlagen")
    .insert({
      verwalter_id,
      name: ton === "neutral" ? "Standard" : ton === "freundlich" ? "Freundlich" : "Formell",
      ton,
      betreff: t.betreff,
      anrede_vorlage: t.anrede_vorlage,
      einleitungstext: t.einleitungstext,
      schlusstext: t.schlusstext,
      zahlungshinweis: t.zahlungshinweis,
      belege_hinweis:
        "Die Belege können während 14 Tagen bei der Verwaltung eingesehen werden.",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function speichereBegleitschreibenVorlage(
  vorlage_id: string,
  updates: Record<string, any>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nk_abrechnung_vorlagen")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", vorlage_id);

  if (error) throw new Error(error.message);
}

// ============================================================
// DOKUMENT TRACKING
// ============================================================
export async function speichereDokument(
  abrechnung_id: string,
  dokument_typ: string,
  dateiname: string,
  pdf_url?: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nk_abrechnung_dokumente")
    .insert({
      abrechnung_id,
      dokument_typ,
      dateiname,
      pdf_url,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}