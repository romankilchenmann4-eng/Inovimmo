-- ============================================================
-- Inovimmo — Migration v16b
-- Korrektur: Alte Mietverträge Chilenaustrasse 15 & 17
-- Exakte UUIDs, echte Spaltennamen
-- ============================================================

DO $$
DECLARE
  v_verwalter_id UUID := '7519ce09-5898-45e1-a237-c52f14536269';
  v_lieg_15 UUID := '0fbd2589-d9f8-441e-9e14-dbe312490bef';
  v_lieg_17 UUID := '2197c7fa-a0ef-4aa2-8490-4dda39eb7294';
  v_w_17_p13 UUID;
  v_w_17_tg25 UUID;
  v_w_17_b1 UUID;
  v_eh_2024 UUID;
  v_eh_2023 UUID;
  v_daniel_meier UUID;
BEGIN

  -- ═══════════════════════════════════════════════════════════════
  -- 1. EIGENTÜMER-INFOS
  -- ═══════════════════════════════════════════════════════════════
  UPDATE liegenschaften SET notizen = 'Eigentümer: Kurt Rusch, Rusch Immobilien, Rebackerstrasse 22, 8955 Oetwil an der Limmat. (Alter Eigentümer: Kurt Rufli, Bangkok, Thailand, vertreten durch Eisenegger Treuhand AG, Regensdorf.)'
  WHERE id IN (v_lieg_15, v_lieg_17);

  -- ═══════════════════════════════════════════════════════════════
  -- 2. MIETER KORREKTUREN
  -- ═══════════════════════════════════════════════════════════════

  -- Anita Meier → Daniel Meier umbenennen (doppelt vorhanden, Anita = 3ee9..., Daniel = 8533...)
  -- Mietverhältnisse von Anita auf Daniel umleiten, dann Anita löschen
  SELECT id INTO v_daniel_meier FROM mieter WHERE id = '85337566-b4dc-43ea-a8cd-3569601cbdf7';
  UPDATE mietverhaeltnisse SET mieter_id = v_daniel_meier WHERE mieter_id = '3ee93e6b-611e-448b-a88f-1630ebdea158';
  DELETE FROM mieter WHERE id = '3ee93e6b-611e-448b-a88f-1630ebdea158';

  -- Beatrice Donati → Béatrice Ackermann
  UPDATE mieter SET vorname = 'Béatrice', nachname = 'Ackermann' WHERE id = '8f0980df-4ff6-4c3d-a772-7f08effe544b';

  -- Manuel Melguizo → Melguzo
  UPDATE mieter SET nachname = 'Melguzo' WHERE id = '4f328c69-7a9e-4d4b-adf5-e61ed4033f04';

  -- Cédric Dal Pont (war "Cédric Dal" + "Pont")
  UPDATE mieter SET vorname = 'Cédric', nachname = 'Dal Pont' WHERE id = '9830994d-6f55-423d-b7d3-69a35093e39b';

  -- ═══════════════════════════════════════════════════════════════
  -- 3. WOHNUNGEN AKTUALISIEREN — Chilenaustrasse 17
  -- ═══════════════════════════════════════════════════════════════

  -- EG links (Attinger): 3½-Zi
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '8a04efd5-78bf-4ddb-b675-eb3a2d0599d9';

  -- EG rechts (Pistone): 4½-Zi
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '93da26ef-eefb-4e7e-8a78-37b329d43bd4';

  -- 1.OG links (Meier): 3½-Zi, brutto 1380
  UPDATE wohnungen SET nettomiete = 1153, kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '1cea54bc-397b-4ef0-98d6-ead11c79f913';

  -- 1.OG rechts (Donati/Ackermann): 4½-Zi, brutto 1376 (nach Senkung 2026)
  UPDATE wohnungen SET nettomiete = 1161, kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '30b07477-d506-4b6b-8eeb-323ce1fa0738';

  -- 2.OG links (Santiago)
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '6d9fb301-829f-40f4-aca5-e237a8e2ed11';

  -- 2.OG rechts (Rohrer)
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '669ee4f4-1ad7-441f-ac99-d2dae358ecff';

  -- ═══════════════════════════════════════════════════════════════
  -- 4. WOHNUNGEN AKTUALISIEREN — Chilenaustrasse 15
  -- ═══════════════════════════════════════════════════════════════

  -- EG links (Ediz): 4½-Zi, brutto 1774
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '8e0415b4-68e1-4eca-a6db-57b838d98edf';

  -- EG rechts (Pierandozzi): 3½-Zi, brutto 1250
  UPDATE wohnungen SET nettomiete = 1023, kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '0c949dbe-0bcd-4753-b799-06f7296d77f4';

  -- 1.OG links (Lamprecht): 4½-Zi, brutto 1498
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = '2c03d56b-a20e-488d-8431-192689a7a706';

  -- 1.OG rechts (Dal Pont): 3½-Zi, brutto 1446
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = 'd656127e-bf11-40d5-971b-1ca97eae58aa';

  -- 2.OG links (Melguzo): 4½-Zi, brutto 1706
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = 'b3c08b1a-a957-462c-b626-546cccd6f208';

  -- 2.OG rechts (Kull)
  UPDATE wohnungen SET kuendigungstermine = '3 Monate auf Ende März / Ende Juni / Ende September'
  WHERE id = 'd9f9b780-04df-467f-ac12-af0c6a493d9c';

  -- ═══════════════════════════════════════════════════════════════
  -- 5. NEUE WOHNUNGEN — Chilenaustrasse 17
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO wohnungen (id, liegenschaft_id, verwalter_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position, kuendigungstermine)
  VALUES (gen_random_uuid(), v_lieg_17, v_verwalter_id, 'PP Nr. 13 Parkplatz Freien', 'P13', 0, 0, 0, 35, 0, 'vermietet', 'parkplatz_aussen', false, 'EG', '3 Monate auf Ende März / Juni / September')
  RETURNING id INTO v_w_17_p13;

  INSERT INTO wohnungen (id, liegenschaft_id, verwalter_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position, kuendigungstermine)
  VALUES (gen_random_uuid(), v_lieg_17, v_verwalter_id, 'TG Nr. 25 Tiefgarage', 'TG25', -1, 0, 0, 110, 0, 'vermietet', 'einstellgarage', false, 'UG', '3 Monate auf Ende März / Juni / September')
  RETURNING id INTO v_w_17_tg25;

  INSERT INTO wohnungen (id, liegenschaft_id, verwalter_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_17, v_verwalter_id, 'Bastelr. Nr. 1', 'B1', -1, 1, 0, 0, 57, 'vermietet', 'bastelraum', false, 'UG')
  RETURNING id INTO v_w_17_b1;

  -- ═══════════════════════════════════════════════════════════════
  -- 6. MIETVERHÄLTNISSE AKTUALISIEREN
  -- ═══════════════════════════════════════════════════════════════

  -- Daniel Meier: Mietbeginn Juli 1998, Depot 1300
  UPDATE mietverhaeltnisse SET mietbeginn = '1998-07-01', kaution_chf = 1300
  WHERE wohnung_id = '1cea54bc-397b-4ef0-98d6-ead11c79f913' AND mieter_id = v_daniel_meier;

  -- Monika Pistone: Vertrag per 1.4.2014 übertragen
  UPDATE mietverhaeltnisse SET mietbeginn = '2014-04-01', kaution_chf = 1300, notizen = 'Mietvertrag per 1.4.2014 auf Monika Pistone-Meier übertragen. Keine neue Wohnungsabnahme. Kaution überschrieben. Zur Whg gehören: Bastelraum Nr. 1 UG, Einstellgarage Nr. 13.'
  WHERE wohnung_id = '93da26ef-eefb-4e7e-8a78-37b329d43bd4' AND mieter_id = '82dacdc8-ccca-4faa-a6b3-a550ab78a05d';

  -- Nadia Pierandozzi: Mietbeginn 1.6.1999, Depot 1300
  UPDATE mietverhaeltnisse SET mietbeginn = '1999-06-01', kaution_chf = 1300
  WHERE wohnung_id = '0c949dbe-0bcd-4753-b799-06f7296d77f4' AND mieter_id = '44f8cf08-58df-4aa3-a897-f4d76f2ebc3a';

  -- Béatrice Ackermann: Mietbeginn 1.6.1985
  UPDATE mietverhaeltnisse SET mietbeginn = '1985-06-01', notizen = 'Zusatzvereinbarung: Keine Mietzinsreduktion wegen Renovationen. Lüftungspflicht. Kein Wäschetrocknen am Balkon. Grillieren verboten. Haustiere/Untermiete gemäss Vertrag. Parkplatzpflicht bei Autobesitz.'
  WHERE wohnung_id = '30b07477-d506-4b6b-8eeb-323ce1fa0738' AND mieter_id = '8f0980df-4ff6-4c3d-a772-7f08effe544b';

  -- Gülsen Ediz: Mietbeginn 16.2.2014
  UPDATE mietverhaeltnisse SET mietbeginn = '2014-02-16'
  WHERE wohnung_id = '8e0415b4-68e1-4eca-a6db-57b838d98edf' AND mieter_id = '7a0b8716-1e1d-4424-aa0e-b7f576468ea7';

  -- ═══════════════════════════════════════════════════════════════
  -- 7. NEUE MIETVERHÄLTNISSE
  -- ═══════════════════════════════════════════════════════════════

  -- Sacha Attinger → Parkplatz 13 (Mietbeginn 1.11.2010)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_p13, 'b35460e3-f652-44e9-8d43-a0f372e30e07', true, true, '2010-11-01');

  -- Manuela Santiago → Tiefgarage 25 (Mietbeginn 1.4.2025)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_tg25, 'f1d18e2b-4827-4840-8f4c-1eca1c48cc43', true, true, '2025-04-01');

  -- Giovanni Donati → 1.OG rechts Ch.17 (2. Vertragspartner)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES ('30b07477-d506-4b6b-8eeb-323ce1fa0738', 'c639f1d5-bd29-4bc6-b1b7-c9cef25208e7', true, false, '1985-06-01');

  -- Halil Ibrahim Ediz → EG links Ch.15 (2. Vertragspartner)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES ('8e0415b4-68e1-4eca-a6db-57b838d98edf', '4506492f-5900-4aaa-a6d9-14584fd53ddb', true, false, '2014-02-16');

  -- René Lamprecht → 1.OG links Ch.15 (2. Vertragspartner)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES ('2c03d56b-a20e-488d-8431-192689a7a706', '58ed90e0-91ec-46b3-8ad1-7109a09e1828', true, false, '2014-01-01');

  -- Béatrice Ackermann → Bastelraum Nr. 1 UG
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_b1, '8f0980df-4ff6-4c3d-a772-7f08effe544b', true, true, '1985-06-01');

  -- ═══════════════════════════════════════════════════════════════
  -- 8. MIETZINSERHÖHUNGEN
  -- ═══════════════════════════════════════════════════════════════

  -- Erhöhung per 01.04.2024 (Ref.-Zins 1.50% → 1.75%)
  INSERT INTO mietzins_erhoehungen (id, liegenschaft_id, verwalter_id, titel, investitionsart, status, investition_total, foerderbeitraege, referenzzinssatz_alt, referenzzinssatz_neu, inkrafttreten, eigentuemer_name, eigentuemer_adresse, eigentuemer_ort, begruendung)
  VALUES (gen_random_uuid(), v_lieg_17, v_verwalter_id, 'Mietzinserhöhung per 01.04.2024', 'wertvermehrend_sonstiges', 'versendet', 0, 0, 1.50, 1.75, '2024-04-01', 'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat', 'Referenzzinssatz 1.50% auf 1.75%, Teuerungsausgleich, Kostensteigerung')
  RETURNING id INTO v_eh_2024;

  -- Positionen Ch. 17
  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES (v_eh_2024, '1cea54bc-397b-4ef0-98d6-ead11c79f913', 1116, 227, 15.11, 68, true, 37, 37, 1153, 227, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW());

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES (v_eh_2024, '93da26ef-eefb-4e7e-8a78-37b329d43bd4', 1272, 273, 18.22, 82, true, 42, 42, 1314, 273, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW());

  -- Positionen Ch. 15
  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES (v_eh_2024, '8e0415b4-68e1-4eca-a6db-57b838d98edf', 1432, 295, 18.22, 82, true, 47, 47, 1479, 295, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW());

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES (v_eh_2024, 'd656127e-bf11-40d5-971b-1ca97eae58aa', 1160, 247, 15.11, 68, true, 39, 39, 1199, 247, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW());

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES (v_eh_2024, '2c03d56b-a20e-488d-8431-192689a7a706', 1184, 275, 18.22, 82, true, 39, 39, 1223, 275, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW());

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES (v_eh_2024, 'b3c08b1a-a957-462c-b626-546cccd6f208', 1395, 265, 18.22, 82, true, 46, 46, 1441, 265, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW());

  -- Erhöhung per 01.10.2023 (Lamprecht)
  INSERT INTO mietzins_erhoehungen (id, liegenschaft_id, verwalter_id, titel, investitionsart, status, investition_total, foerderbeitraege, referenzzinssatz_alt, referenzzinssatz_neu, inkrafttreten, eigentuemer_name, eigentuemer_adresse, eigentuemer_ort, begruendung)
  VALUES (gen_random_uuid(), v_lieg_15, v_verwalter_id, 'Mietzinserhöhung per 01.10.2023', 'wertvermehrend_sonstiges', 'versendet', 0, 0, 1.25, 1.50, '2023-10-01', 'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat', 'Nettomiete 1108 auf 1184')
  RETURNING id INTO v_eh_2023;

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES (v_eh_2023, '2c03d56b-a20e-488d-8431-192689a7a706', 1108, 275, 18.22, 82, true, 76, 76, 1184, 275, 0, 'Nettomiete 1108 auf 1184', NOW());

  -- ═══════════════════════════════════════════════════════════════
  -- 9. NEBENKOSTENABRECHNUNG 2024
  -- ═══════════════════════════════════════════════════════════════

  -- Nebenkostenpositionen Ch. 15
  INSERT INTO nebenkostenpositionen (liegenschaft_id, jahr, bezeichnung, betrag_total, verteilschluessel) VALUES
  (v_lieg_15, 2024, 'Heizung', 8500, 'flaeche'),
  (v_lieg_15, 2024, 'Warmwasser', 2100, 'flaeche'),
  (v_lieg_15, 2024, 'Hauswartung', 4200, 'gleich'),
  (v_lieg_15, 2024, 'Treppenhausreinigung', 2800, 'gleich'),
  (v_lieg_15, 2024, 'Versicherungen', 1800, 'flaeche'),
  (v_lieg_15, 2024, 'Antenne/Kabel', 1200, 'kopf'),
  (v_lieg_15, 2024, 'Liftunterhalt', 3200, 'flaeche'),
  (v_lieg_15, 2024, 'Waschkauernutzung', 600, 'kopf');

  -- Nebenkostenpositionen Ch. 17
  INSERT INTO nebenkostenpositionen (liegenschaft_id, jahr, bezeichnung, betrag_total, verteilschluessel) VALUES
  (v_lieg_17, 2024, 'Heizung', 7200, 'flaeche'),
  (v_lieg_17, 2024, 'Warmwasser', 1800, 'flaeche'),
  (v_lieg_17, 2024, 'Hauswartung', 3600, 'gleich'),
  (v_lieg_17, 2024, 'Treppenhausreinigung', 2400, 'gleich'),
  (v_lieg_17, 2024, 'Versicherungen', 1500, 'flaeche'),
  (v_lieg_17, 2024, 'Antenne/Kabel', 1000, 'kopf'),
  (v_lieg_17, 2024, 'Waschkauernutzung', 500, 'kopf');

  -- Nebenkostenabrechnungen für beheizte Wohnungen
  INSERT INTO nebenkostenabrechnungen (wohnung_id, liegenschaft_id, jahr, akonto_total, kosten_total, status)
  SELECT w.id, w.liegenschaft_id, 2024, w.nebenkosten_akonto * 12, 0, 'entwurf'
  FROM wohnungen w
  WHERE w.liegenschaft_id IN (v_lieg_15, v_lieg_17)
    AND w.wohnungstyp = 'wohnung'
    AND w.beheizt = true;

  RAISE NOTICE 'Migration 016b abgeschlossen';
END $$;