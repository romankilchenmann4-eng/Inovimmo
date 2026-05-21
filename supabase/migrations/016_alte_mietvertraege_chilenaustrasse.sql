-- ============================================================
-- Inovimmo — Migration v16
-- Alte Mietverträge Chileaustrasse 15 & 17
-- Aktualisiert Seed-Daten mit echten Vertragsdetails
-- ============================================================

-- Notizen-Spalte für Mietverhältnisse
ALTER TABLE public.mietverhaeltnisse
  ADD COLUMN IF NOT EXISTS notizen text;

DO $$
DECLARE
  v_verwalter_id UUID;
  v_lieg_15 UUID;
  v_lieg_17 UUID;
  v_w_17_p13 UUID;
  v_w_17_tg25 UUID;
  v_w_17_b1 UUID;
  v_m_giovanni UUID;
  v_m_halil UUID;
  v_m_rene UUID;
  v_eh_2024 UUID;
  v_eh_2023 UUID;
BEGIN
  SELECT id INTO v_verwalter_id FROM profiles WHERE full_name ILIKE 'Kurt Rusch' LIMIT 1;
  IF v_verwalter_id IS NULL THEN
    RAISE WARNING 'Kurt Rusch nicht gefunden. Migration abgebrochen.';
    RETURN;
  END IF;

  SELECT id INTO v_lieg_15 FROM liegenschaften WHERE name = 'Chilenaustrasse 15' AND verwalter_id = v_verwalter_id LIMIT 1;
  SELECT id INTO v_lieg_17 FROM liegenschaften WHERE name = 'Chilenaustrasse 17' AND verwalter_id = v_verwalter_id LIMIT 1;
  IF v_lieg_15 IS NULL OR v_lieg_17 IS NULL THEN
    RAISE WARNING 'Liegenschaften nicht gefunden. Migration abgebrochen.';
    RETURN;
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 1. EIGENTÜMER-INFOS IN LIEGENSCHAFTEN
  -- ═══════════════════════════════════════════════════════════════
  UPDATE liegenschaften SET notizen = 'Eigentümer: Kurt Rusch, Rusch Immobilien, Rebackerstrasse 22, 8955 Oetwil an der Limmat. (Alter Eigentümer: Kurt Rufli, Bangkok, Thailand, vertreten durch Eisenegger Treuhand AG, Regensdorf.)'
  WHERE id IN (v_lieg_15, v_lieg_17) AND (notizen IS NULL OR notizen = '');

  -- ═══════════════════════════════════════════════════════════════
  -- 2. MIETER KORREKTUREN
  -- ═══════════════════════════════════════════════════════════════

  -- Vertrag #1: Daniel Meier (nicht Anita Meier)
  UPDATE mieter SET vorname = 'Daniel'
  WHERE vorname = 'Anita' AND nachname = 'Meier' AND verwalter_id = v_verwalter_id;

  -- Vertrag #6: Cédric Dal Pont (mit Akzent)
  UPDATE mieter SET vorname = 'Cédric'
  WHERE vorname = 'Cedric' AND nachname = 'Dal Pont' AND verwalter_id = v_verwalter_id;

  -- Vertrag #9: Manuel Melguzo (Schreibweise korrigiert)
  UPDATE mieter SET nachname = 'Melguzo'
  WHERE nachname = 'Melguizo' AND verwalter_id = v_verwalter_id;

  -- Vertrag #10: Béatrice Ackermann (ehemals Beatrice Donati)
  UPDATE mieter SET vorname = 'Béatrice', nachname = 'Ackermann'
  WHERE vorname = 'Beatrice' AND nachname = 'Donati' AND verwalter_id = v_verwalter_id;

  -- Vertrag #5: Gülsen Ediz (Umlaut korrigiert)
  UPDATE mieter SET vorname = 'Gülsen'
  WHERE vorname = 'Gulsen' AND nachname = 'Ediz' AND verwalter_id = v_verwalter_id;

  -- ═══════════════════════════════════════════════════════════════
  -- 3. NEUE MIETER
  -- ═══════════════════════════════════════════════════════════════

  -- Giovanni Donati (2. Vertragspartner Whg 1.OG rechts, Ch. 17)
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Giovanni', 'Donati', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_giovanni;

  -- Halil Ibrahim Ediz (2. Vertragspartner Whg EG links, Ch. 15)
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Halil Ibrahim', 'Ediz', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_halil;

  -- René Lamprecht (2. Vertragspartner Whg 1.OG links, Ch. 15)
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'René', 'Lamprecht', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_rene;

  -- ═══════════════════════════════════════════════════════════════
  -- 4. WOHNUNGEN AKTUALISIEREN — Chileaustrasse 17
  -- ═══════════════════════════════════════════════════════════════

  -- 1.OG links (Daniel Meier): Brutto 1380 nach Erhöhung 2024
  UPDATE wohnungen SET
    nettomiete = 1153,
    kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE liegenschaft_id = v_lieg_17 AND position = '1. OG links';

  -- EG rechts (Monika Pistone): Brutto 1587 nach Erhöhung 2024
  UPDATE wohnungen SET
    kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE liegenschaft_id = v_lieg_17 AND position = 'EG rechts';

  -- 1.OG rechts (Donati/Ackermann): Mietzinssenkung 01.04.2026, Brutto 1376
  UPDATE wohnungen SET
    nettomiete = 1161,
    kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE liegenschaft_id = v_lieg_17 AND position = '1. OG rechts';

  -- ═══════════════════════════════════════════════════════════════
  -- 5. WOHNUNGEN AKTUALISIEREN — Chileaustrasse 15
  -- ═══════════════════════════════════════════════════════════════

  -- EG links (Ediz): Brutto 1774 nach Erhöhung 2024
  UPDATE wohnungen SET
    kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE liegenschaft_id = v_lieg_15 AND position = 'EG links';

  -- EG rechts / Parterre rechts (Pierandozzi): Brutto 1250
  UPDATE wohnungen SET
    nettomiete = 1023,
    kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE liegenschaft_id = v_lieg_15 AND position = 'EG rechts';

  -- 1.OG links (Lamprecht): Brutto 1498 nach Erhöhung 2024
  UPDATE wohnungen SET
    kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE liegenschaft_id = v_lieg_15 AND position = '1. OG links';

  -- 1.OG rechts (Dal Pont): Brutto 1446 nach Erhöhung 2024
  UPDATE wohnungen SET
    kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE liegenschaft_id = v_lieg_15 AND position = '1. OG rechts';

  -- 2.OG links (Melguzo): Brutto 1706 nach Erhöhung 2024
  UPDATE wohnungen SET
    kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE liegenschaft_id = v_lieg_15 AND position = '2. OG links';

  -- ═══════════════════════════════════════════════════════════════
  -- 6. NEUE WOHNUNGEN — Chileaustrasse 17
  -- ═══════════════════════════════════════════════════════════════

  -- Parkplatz Nr. 13 im Freien (Sacha Attinger, CHF 35/Monat)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position, kuendigungstermine)
  VALUES (gen_random_uuid(), v_lieg_17, 'PP Nr. 13 Parkplatz Freien', 'P13', 0, 0, 0, 35, 0, 'vermietet', 'parkplatz_aussen', false, 'EG', '3 Monate auf Ende März / Juni / September')
  RETURNING id INTO v_w_17_p13;

  -- Tiefgaragenplatz Nr. 25 (Manuela Santiago, CHF 110/Monat)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position, kuendigungstermine)
  VALUES (gen_random_uuid(), v_lieg_17, 'TG Nr. 25 Tiefgarage', 'TG25', -1, 0, 0, 110, 0, 'vermietet', 'einstellgarage', false, 'UG', '3 Monate auf Ende März / Juni / September')
  RETURNING id INTO v_w_17_tg25;

  -- Bastelraum Nr. 1 im UG (Donati/Ackermann, CHF 57/Monat)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Bastelr. Nr. 1', 'B1', -1, 1, 0, 0, 57, 'vermietet', 'bastelraum', false, 'UG')
  RETURNING id INTO v_w_17_b1;

  -- ═══════════════════════════════════════════════════════════════
  -- 7. MIETVERHÄLTNISSE AKTUALISIEREN
  -- ═══════════════════════════════════════════════════════════════

  -- #1 Daniel Meier: Mietbeginn Juli 1998, Depot CHF 1'300
  UPDATE mietverhaeltnisse SET
    mietbeginn = '1998-07-01',
    kaution_chf = 1300,
    kaution_bezahlt = true
  WHERE wohnung_id = (SELECT id FROM wohnungen WHERE liegenschaft_id = v_lieg_17 AND position = '1. OG links')
    AND mieter_id = (SELECT id FROM mieter WHERE vorname = 'Daniel' AND nachname = 'Meier' AND verwalter_id = v_verwalter_id);

  -- #4 Monika Pistone: Vertrag per 1.4.2014 übertragen
  UPDATE mietverhaeltnisse SET
    mietbeginn = '2014-04-01',
    kaution_chf = 1300,
    kaution_bezahlt = true,
    notizen = 'Mietvertrag per 1.4.2014 auf Monika Pistone-Meier übertragen. Keine neue Wohnungsabnahme. Kaution überschrieben. Zur Whg gehören: Bastelraum Nr. 1 UG, Einstellgarage Nr. 13.'
  WHERE wohnung_id = (SELECT id FROM wohnungen WHERE liegenschaft_id = v_lieg_17 AND position = 'EG rechts')
    AND mieter_id = (SELECT id FROM mieter WHERE vorname = 'Monika' AND nachname = 'Pistone' AND verwalter_id = v_verwalter_id);

  -- #7 Nadia Pierandozzi: Mietbeginn 1.6.1999, Depot CHF 1'300
  UPDATE mietverhaeltnisse SET
    mietbeginn = '1999-06-01',
    kaution_chf = 1300,
    kaution_bezahlt = true
  WHERE wohnung_id = (SELECT id FROM wohnungen WHERE liegenschaft_id = v_lieg_15 AND position = 'EG rechts')
    AND mieter_id = (SELECT id FROM mieter WHERE vorname = 'Nadia' AND nachname = 'Pierandozzi' AND verwalter_id = v_verwalter_id);

  -- #10 Béatrice Ackermann: Mietbeginn 1.6.1985
  UPDATE mietverhaeltnisse SET
    mietbeginn = '1985-06-01',
    notizen = 'Zusatzvereinbarung: Keine Mietzinsreduktion wegen Renovationen. Lüftungspflicht des Mieters. Kein Trocknen von Wäsche am Balkon. Grillieren auf Balkon/Gartensitzplatz verboten. Haustiere und Untermiete gemäss Vertrag geregelt. Pflicht zur Miete eines Parkplatzes/Garage bei Autobesitz.'
  WHERE wohnung_id = (SELECT id FROM wohnungen WHERE liegenschaft_id = v_lieg_17 AND position = '1. OG rechts')
    AND mieter_id = (SELECT id FROM mieter WHERE vorname = 'Béatrice' AND nachname = 'Ackermann' AND verwalter_id = v_verwalter_id);

  -- #5 Gülsen Ediz: Mietbeginn 16.2.2014
  UPDATE mietverhaeltnisse SET
    mietbeginn = '2014-02-16'
  WHERE wohnung_id = (SELECT id FROM wohnungen WHERE liegenschaft_id = v_lieg_15 AND position = 'EG links')
    AND mieter_id = (SELECT id FROM mieter WHERE vorname = 'Gülsen' AND nachname = 'Ediz' AND verwalter_id = v_verwalter_id);

  -- ═══════════════════════════════════════════════════════════════
  -- 8. NEUE MIETVERHÄLTNISSE
  -- ═══════════════════════════════════════════════════════════════

  -- #2 Sacha Attinger → Parkplatz Nr. 13 (Mietbeginn 1.11.2010)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  SELECT v_w_17_p13, m.id, true, true, '2010-11-01'
  FROM mieter m WHERE m.vorname = 'Sacha' AND m.nachname = 'Attinger' AND m.verwalter_id = v_verwalter_id;

  -- #3 Manuela Santiago → Tiefgaragenplatz Nr. 25 (Mietbeginn 1.4.2025)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  SELECT v_w_17_tg25, m.id, true, true, '2025-04-01'
  FROM mieter m WHERE m.vorname = 'Manuela' AND m.nachname = 'Santiago' AND m.verwalter_id = v_verwalter_id;

  -- #10 Giovanni Donati → 1.OG rechts Ch.17 (2. Vertragspartner, Mietbeginn 1.6.1985)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  SELECT w.id, v_m_giovanni, true, false, '1985-06-01'
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_17 AND w.position = '1. OG rechts';

  -- #5 Halil Ibrahim Ediz → EG links Ch.15 (2. Vertragspartner)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  SELECT w.id, v_m_halil, true, false, '2014-02-16'
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_15 AND w.position = 'EG links';

  -- #8 René Lamprecht → 1.OG links Ch.15 (2. Vertragspartner)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  SELECT w.id, v_m_rene, true, false, '2014-01-01'
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_15 AND w.position = '1. OG links';

  -- #10 Bastelraum Nr. 1 UG → Béatrice Ackermann
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  SELECT v_w_17_b1, m.id, true, true, '1985-06-01'
  FROM mieter m WHERE m.vorname = 'Béatrice' AND m.nachname = 'Ackermann' AND m.verwalter_id = v_verwalter_id;

  -- ═══════════════════════════════════════════════════════════════
  -- 9. MIETZINSERHÖHUNGEN
  -- ═══════════════════════════════════════════════════════════════

  -- Mietzinserhöhung per 01.04.2024
  -- Grund: Referenzzinssatz 1.50% → 1.75%, Teuerungsausgleich, Kostensteigerung
  INSERT INTO mietzins_erhoehungen (id, liegenschaft_id, verwalter_id, titel, grund, status, investition_total, foerderbeitraege, referenzzinssatz, inkrafttreten, eigentuemer_name, eigentuemer_adresse, eigentuemer_ort, kapitalisierungssatz, wertvermehrend_prozent)
  VALUES (gen_random_uuid(), v_lieg_17, v_verwalter_id, 'Mietzinserhöhung per 01.04.2024', 'wertvermehrend_sonstiges', 'aktiv', 0, 0, 1.75, '2024-04-01', 'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat', 8, 70)
  RETURNING id INTO v_eh_2024;

  -- Positionen für Erhöhung 2024 (Chilenaustrasse 17)
  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  SELECT v_eh_2024, w.id, 1116, 227, w.verteilschluessel_prozent, w.flaeche_m2, w.beheizt, 37, 37, 1153, 227, 0, 'Referenzzinssatz 1.50% auf 1.75%, Teuerungsausgleich, Kostensteigerung', NOW()
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_17 AND w.position = '1. OG links';

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  SELECT v_eh_2024, w.id, 1272, 273, w.verteilschluessel_prozent, w.flaeche_m2, w.beheizt, 42, 42, 1314, 273, 0, 'Referenzzinssatz 1.50% auf 1.75%, Teuerungsausgleich, Kostensteigerung', NOW()
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_17 AND w.position = 'EG rechts';

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  SELECT v_eh_2024, w.id, 1226, 215, w.verteilschluessel_prozent, w.flaeche_m2, w.beheizt, 0, 0, 1161, 215, 0, 'Mietzinssenkung: Referenzzinssatz 1.75% auf 1.25%', NOW()
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_17 AND w.position = '1. OG rechts';

  -- Positionen für Erhöhung 2024 (Chilenaustrasse 15)
  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  SELECT v_eh_2024, w.id, 1432, 295, w.verteilschluessel_prozent, w.flaeche_m2, w.beheizt, 47, 47, 1479, 295, 0, 'Referenzzinssatz 1.50% auf 1.75%, Teuerungsausgleich, Kostensteigerung', NOW()
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_15 AND w.position = 'EG links';

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  SELECT v_eh_2024, w.id, 1160, 247, w.verteilschluessel_prozent, w.flaeche_m2, w.beheizt, 39, 39, 1199, 247, 0, 'Referenzzinssatz 1.50% auf 1.75%, Teuerungsausgleich, Kostensteigerung', NOW()
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_15 AND w.position = '1. OG rechts';

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  SELECT v_eh_2024, w.id, 1184, 275, w.verteilschluessel_prozent, w.flaeche_m2, w.beheizt, 39, 39, 1223, 275, 0, 'Referenzzinssatz 1.50% auf 1.75%, Teuerungsausgleich, Kostensteigerung', NOW()
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_15 AND w.position = '1. OG links';

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  SELECT v_eh_2024, w.id, 1395, 265, w.verteilschluessel_prozent, w.flaeche_m2, w.beheizt, 46, 46, 1441, 265, 0, 'Referenzzinssatz 1.50% auf 1.75%, Teuerungsausgleich, Kostensteigerung', NOW()
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_15 AND w.position = '2. OG links';

  -- Frühere Erhöhung per 01.10.2023 (Lamprecht, Ch.15, 1.OG links)
  INSERT INTO mietzins_erhoehungen (id, liegenschaft_id, verwalter_id, titel, grund, status, investition_total, foerderbeitraege, referenzzinssatz, inkrafttreten, eigentuemer_name, eigentuemer_adresse, eigentuemer_ort, kapitalisierungssatz, wertvermehrend_prozent)
  VALUES (gen_random_uuid(), v_lieg_15, v_verwalter_id, 'Mietzinserhöhung per 01.10.2023', 'wertvermehrend_sonstiges', 'aktiv', 0, 0, 1.50, '2023-10-01', 'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat', 8, 70)
  RETURNING id INTO v_eh_2023;

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  SELECT v_eh_2023, w.id, 1108, 275, w.verteilschluessel_prozent, w.flaeche_m2, w.beheizt, 76, 76, 1184, 275, 0, 'Nettomiete 1108 auf 1184', NOW()
  FROM wohnungen w WHERE w.liegenschaft_id = v_lieg_15 AND w.position = '1. OG links';

  RAISE NOTICE 'Migration 016 abgeschlossen: Alte Mietverträge eingetragen';
END $$;