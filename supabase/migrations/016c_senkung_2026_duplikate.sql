-- ============================================================
-- Migration v16c: Mietzinssenkung 2026 + Duplikat-Bereinigung
-- Referenzzinssatz 1.75% → 1.25% (0.50% Senkung)
-- Ab 01.04.2026 — basierend auf Donati-Beispiel (5.3% des Netto)
-- ============================================================

DO $$
DECLARE
  v_verwalter_id UUID := '7519ce09-5898-45e1-a237-c52f14536269';
  v_lieg_15 UUID := '0fbd2589-d9f8-441e-9e14-dbe312490bef';
  v_lieg_17 UUID := '2197c7fa-a0ef-4aa2-8490-4dda39eb7294';
  v_eh_2026_15 UUID;
  v_eh_2026_17 UUID;
BEGIN

  -- ═══════════════════════════════════════════════════════════════
  -- 1. DUPLIKAT-MIETVERHÄLTNISSE BEREINIGEN
  -- ═══════════════════════════════════════════════════════════════

  -- Alte Mieterspiegel-Duplikate (mietbeginn 2025-10-01) löschen,
  -- wo bereits ein korrekter Eintrag aus Migration 016b existiert

  -- Halil Ibrahim Ediz auf EG links Ch.15: Duplikat mit mietbeginn 2025-10-01
  DELETE FROM mietverhaeltnisse
  WHERE mieter_id = '4506492f-5900-4aaa-a6d9-14584fd53ddb'
    AND wohnung_id = '8e0415b4-68e1-4eca-a6db-57b838d98edf'
    AND mietbeginn = '2025-10-01';

  -- René Lamprecht auf 1.OG links Ch.15: Duplikat mit mietbeginn 2025-10-01
  DELETE FROM mietverhaeltnisse
  WHERE mieter_id = '58ed90e0-91ec-46b3-8ad1-7109a09e1828'
    AND wohnung_id = '2c03d56b-a20e-488d-8431-192689a7a706'
    AND mietbeginn = '2025-10-01';

  -- Giovanni Donati auf 1.OG rechts Ch.17: Duplikat mit mietbeginn 2025-10-01
  DELETE FROM mietverhaeltnisse
  WHERE mieter_id = 'c639f1d5-bd29-4bc6-b1b7-c9cef25208e7'
    AND wohnung_id = '30b07477-d506-4b6b-8eeb-323ce1fa0738'
    AND mietbeginn = '2025-10-01';

  -- Daniel Meier auf 1.OG links Ch.17: Duplikat (gleicher mietbeginn, zwei Einträge)
  DELETE FROM mietverhaeltnisse
  WHERE mieter_id = '85337566-b4dc-43ea-a8cd-3569601cbdf7'
    AND wohnung_id = '1cea54bc-397b-4ef0-98d6-ead11c79f913'
    AND mietbeginn = '1998-07-01'
    AND ctid NOT IN (
      SELECT MIN(ctid) FROM mietverhaeltnisse
      WHERE mieter_id = '85337566-b4dc-43ea-a8cd-3569601cbdf7'
        AND wohnung_id = '1cea54bc-397b-4ef0-98d6-ead11c79f913'
        AND mietbeginn = '1998-07-01'
    );

  -- ═══════════════════════════════════════════════════════════════
  -- 2. WOHNUNGEN — NETTOMIETEN FÜR 2026 SENKUNG AKTUALISIEREN
  -- ═══════════════════════════════════════════════════════════════
  -- Senkung 5.3% des Netto (Donati-Referenz: 65/1226 = 5.3%)

  -- Chilenaustrasse 17
  UPDATE wohnungen SET nettomiete = 1082 WHERE id = '8a04efd5-78bf-4ddb-b675-eb3a2d0599d9';  -- EG links (Attinger): 1143 → 1082
  UPDATE wohnungen SET nettomiete = 1244 WHERE id = '93da26ef-eefb-4e7e-8a78-37b329d43bd4';  -- EG rechts (Pistone): 1314 → 1244
  UPDATE wohnungen SET nettomiete = 1092 WHERE id = '1cea54bc-397b-4ef0-98d6-ead11c79f913';  -- 1.OG links (Meier): 1153 → 1092
  -- 1.OG rechts (Donati) bereits 1161 ✓
  UPDATE wohnungen SET nettomiete = 1302 WHERE id = '6d9fb301-829f-40f4-aca5-e237a8e2ed11';  -- 2.OG links (Santiago): 1375 → 1302
  UPDATE wohnungen SET nettomiete = 1376 WHERE id = '669ee4f4-1ad7-441f-ac99-d2dae358ecff';  -- 2.OG rechts (Rohrer): 1453 → 1376

  -- Chilenaustrasse 15
  UPDATE wohnungen SET nettomiete = 1401 WHERE id = '8e0415b4-68e1-4eca-a6db-57b838d98edf';  -- EG links (Ediz): 1479 → 1401
  UPDATE wohnungen SET nettomiete = 969  WHERE id = '0c949dbe-0bcd-4753-b799-06f7296d77f4';  -- EG rechts (Pierandozzi): 1023 → 969
  UPDATE wohnungen SET nettomiete = 1158 WHERE id = '2c03d56b-a20e-488d-8431-192689a7a706';  -- 1.OG links (Lamprecht): 1223 → 1158
  UPDATE wohnungen SET nettomiete = 1135 WHERE id = 'd656127e-bf11-40d5-971b-1ca97eae58aa';  -- 1.OG rechts (Dal Pont): 1199 → 1135
  UPDATE wohnungen SET nettomiete = 1365 WHERE id = 'b3c08b1a-a957-462c-b626-546cccd6f208';  -- 2.OG links (Melguzo): 1441 → 1365
  UPDATE wohnungen SET nettomiete = 1100 WHERE id = 'd9f9b780-04df-467f-ac12-af0c6a493d9c';  -- 2.OG rechts (Kull): 1162 → 1100

  -- ═══════════════════════════════════════════════════════════════
  -- 3. MIETZINSSENKUNG 2026 — Chilenaustrasse 17
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO mietzins_erhoehungen (id, liegenschaft_id, verwalter_id, titel, investitionsart, status, investition_total, foerderbeitraege, referenzzinssatz_alt, referenzzinssatz_neu, inkrafttreten, eigentuemer_name, eigentuemer_adresse, eigentuemer_ort, begruendung)
  VALUES (gen_random_uuid(), v_lieg_17, v_verwalter_id, 'Mietzinssenkung per 01.04.2026', 'wertvermehrend_sonstiges', 'versendet', 0, 0, 1.75, 1.25, '2026-04-01', 'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat', 'Senkung Referenzzinssatz von 1.75% auf 1.25%')
  RETURNING id INTO v_eh_2026_17;

  -- Positionen Ch. 17 (Senkung)
  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES
  (v_eh_2026_17, '8a04efd5-78bf-4ddb-b675-eb3a2d0599d9', 1143, 237, 15.11, 68, true, -61, -61, 1082, 237, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_17, '93da26ef-eefb-4e7e-8a78-37b329d43bd4', 1314, 273, 18.22, 82, true, -70, -70, 1244, 273, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_17, '1cea54bc-397b-4ef0-98d6-ead11c79f913', 1153, 227, 15.11, 68, true, -61, -61, 1092, 227, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_17, '30b07477-d506-4b6b-8eeb-323ce1fa0738', 1226, 215, 18.22, 82, true, -65, -65, 1161, 215, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_17, '6d9fb301-829f-40f4-aca5-e237a8e2ed11', 1375, 267, 15.11, 68, true, -73, -73, 1302, 267, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_17, '669ee4f4-1ad7-441f-ac99-d2dae358ecff', 1453, 265, 18.22, 82, true, -77, -77, 1376, 265, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW());

  -- ═══════════════════════════════════════════════════════════════
  -- 4. MIETZINSSENKUNG 2026 — Chilenaustrasse 15
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO mietzins_erhoehungen (id, liegenschaft_id, verwalter_id, titel, investitionsart, status, investition_total, foerderbeitraege, referenzzinssatz_alt, referenzzinssatz_neu, inkrafttreten, eigentuemer_name, eigentuemer_adresse, eigentuemer_ort, begruendung)
  VALUES (gen_random_uuid(), v_lieg_15, v_verwalter_id, 'Mietzinssenkung per 01.04.2026', 'wertvermehrend_sonstiges', 'versendet', 0, 0, 1.75, 1.25, '2026-04-01', 'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat', 'Senkung Referenzzinssatz von 1.75% auf 1.25%')
  RETURNING id INTO v_eh_2026_15;

  INSERT INTO mietzins_erhoehung_positionen (mietzins_erhoehung_id, wohnung_id, miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2, beheizt, erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu, investitionsanteil, begruendung, berechnet_am)
  VALUES
  (v_eh_2026_15, '8e0415b4-68e1-4eca-a6db-57b838d98edf', 1479, 295, 18.22, 82, true, -78, -78, 1401, 295, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_15, '0c949dbe-0bcd-4753-b799-06f7296d77f4', 1023, 227, 15.11, 68, true, -54, -54, 969, 227, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_15, '2c03d56b-a20e-488d-8431-192689a7a706', 1223, 275, 18.22, 82, true, -65, -65, 1158, 275, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_15, 'd656127e-bf11-40d5-971b-1ca97eae58aa', 1199, 247, 15.11, 68, true, -64, -64, 1135, 247, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_15, 'b3c08b1a-a957-462c-b626-546cccd6f208', 1441, 265, 18.22, 82, true, -76, -76, 1365, 265, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW()),
  (v_eh_2026_15, 'd9f9b780-04df-467f-ac12-af0c6a493d9c', 1162, 252, 15.11, 68, true, -62, -62, 1100, 252, 0, 'Senkung Ref.-Zins 1.75%→1.25%', NOW());

  RAISE NOTICE 'Migration 016c abgeschlossen: Senkung 2026 + Duplikat-Bereinigung';
END $$;