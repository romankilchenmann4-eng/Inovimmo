-- ============================================================
-- Migration v16d: Heizungsinvestition & OR-konforme Mietzinserhöhung
-- Revertiert 2026 Mietzinssenkung, erstellt neue Erhöhung
-- basierend auf Heizungsinvestition (Art. 269a lit. b OR i.V.m. Art. 14 VMWG)
-- Beschaffung/IB: März/April 2026, inkrafttreten: 01.07.2026
-- ============================================================

-- 1. Neue Spalten für OR-konforme Berechnung
ALTER TABLE mietzins_erhoehungen
  ADD COLUMN IF NOT EXISTS ersatzbeschaffung_1zu1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nebenkosten_aenderung_monatlich numeric DEFAULT 0;

DO $$
DECLARE
  v_verwalter_id UUID := '7519ce09-5898-45e1-a237-c52f14536269';
  v_lieg_15 UUID := '0fbd2589-d9f8-441e-9e14-dbe312490bef';
  v_lieg_17 UUID := '2197c7fa-a0ef-4aa2-8490-4dda39eb7294';
  v_eh_15 UUID;
  v_eh_17 UUID;

  -- OR-Berechnung pro Liegenschaft
  v_investition_total numeric := 130000;
  v_foerderbeitraege numeric := 9950;
  v_ersatzbeschaffung numeric := 14909.47;  -- 89456.80 / 6 Liegenschaften
  v_netto_investition numeric;
  v_wertvermehrend numeric;
  v_kapitalisierungssatz numeric := 5.00;   -- Ref-Zins 1.75% + Zuschlag 0.5% + Amortisation 1% + Unterhalt 1% = 4.25%, gerundet 5%
  v_jaehrlich numeric;
  v_monatlich numeric;
BEGIN
  -- ═══════════════════════════════════════════════════════════════
  -- 2. 2026 MIETZINSSENKUNG LÖSCHEN
  -- Referenzzinsatzänderung wird nicht angewendet (Entscheid Eigentümer)
  -- ═══════════════════════════════════════════════════════════════
  DELETE FROM mietzins_erhoehung_positionen
  WHERE mietzins_erhoehung_id IN (
    SELECT id FROM mietzins_erhoehungen
    WHERE titel LIKE 'Mietzinssenkung per 01.04.2026%'
  );

  DELETE FROM mietzins_erhoehungen
  WHERE titel LIKE 'Mietzinssenkung per 01.04.2026%';

  -- ═══════════════════════════════════════════════════════════════
  -- 3. WOHNUNGEN — NETTOMIETEN AUF PRE-SENKUNG REVERTIEREN
  -- Das sind die Werte nach der 2024 Erhöhung, vor der fehlerhaften Senkung
  -- ═══════════════════════════════════════════════════════════════

  -- Chilenaustrasse 15
  UPDATE wohnungen SET nettomiete = 1479 WHERE id = '8e0415b4-68e1-4eca-a6db-57b838d98edf';  -- EG links (Ediz)
  UPDATE wohnungen SET nettomiete = 1023 WHERE id = '0c949dbe-0bcd-4753-b799-06f7296d77f4';  -- EG rechts (Pierandozzi)
  UPDATE wohnungen SET nettomiete = 1223 WHERE id = '2c03d56b-a20e-488d-8431-192689a7a706';  -- 1.OG links (Lamprecht)
  UPDATE wohnungen SET nettomiete = 1199 WHERE id = 'd656127e-bf11-40d5-971b-1ca97eae58aa';  -- 1.OG rechts (Dal Pont)
  UPDATE wohnungen SET nettomiete = 1441 WHERE id = 'b3c08b1a-a957-462c-b626-546cccd6f208';  -- 2.OG links (Melguzo)
  UPDATE wohnungen SET nettomiete = 1162 WHERE id = 'd9f9b780-04df-467f-ac12-af0c6a493d9c';  -- 2.OG rechts (Kull)

  -- Chilenaustrasse 17
  UPDATE wohnungen SET nettomiete = 1143 WHERE id = '8a04efd5-78bf-4ddb-b675-eb3a2d0599d9';  -- EG links (Attinger)
  UPDATE wohnungen SET nettomiete = 1314 WHERE id = '93da26ef-eefb-4e7e-8a78-37b329d43bd4';  -- EG rechts (Pistone)
  UPDATE wohnungen SET nettomiete = 1153 WHERE id = '1cea54bc-397b-4ef0-98d6-ead11c79f913';  -- 1.OG links (Meier)
  UPDATE wohnungen SET nettomiete = 1226 WHERE id = '30b07477-d506-4b6b-8eeb-323ce1fa0738';  -- 1.OG rechts (Donati)
  UPDATE wohnungen SET nettomiete = 1375 WHERE id = '6d9fb301-829f-40f4-aca5-e237a8e2ed11';  -- 2.OG links (Santiago)
  UPDATE wohnungen SET nettomiete = 1453 WHERE id = '669ee4f4-1ad7-441f-ac99-d2dae358ecff';  -- 2.OG rechts (Rohrer)

  -- ═══════════════════════════════════════════════════════════════
  -- 4. OR-BERECHNUNG (Art. 269a lit. b OR i.V.m. Art. 14 VMWG)
  -- ═══════════════════════════════════════════════════════════════
  -- Total Investition:         CHF 130'000.00
  -- Förderbeiträge:            CHF   9'950.00 (inkl. EKZ CHF 7'534.40)
  -- Nettoinvestition:          CHF 120'050.00
  -- Ersatzbeschaffung 1:1:     CHF  14'909.47 (89'456.80 / 6 Lieg.)
  -- Wertvermehrende Investition: CHF 105'140.53
  -- Kapitalisierungssatz:      5.00%
  -- Jährliche Mehrbelastung:   CHF   5'257.03
  -- Monatliche Mehrbelastung:  CHF     438.09

  v_netto_investition := v_investition_total - v_foerderbeitraege;  -- 120'050
  v_wertvermehrend := v_netto_investition - v_ersatzbeschaffung;    -- 105'140.53
  v_jaehrlich := v_wertvermehrend * (v_kapitalisierungssatz / 100);  -- 5'257.03
  v_monatlich := v_jaehrlich / 12;                                   -- 438.09

  -- ═══════════════════════════════════════════════════════════════
  -- 5. MIETZINSERHÖHUNG — CHILENAUSTRASSE 15
  -- Heizungsinvestition: Ölheizung → Wärmepumpe mit Erdsonde + Free Cooling
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO mietzins_erhoehungen (
    id, liegenschaft_id, verwalter_id, titel, grund, investitionsart, status,
    investition_total, foerderbeitraege, sonstige_kosten, sonstige_abzuege,
    wertvermehrend_prozent, kapitalisierungssatz,
    ersatzbeschaffung_1zu1, nebenkosten_aenderung_monatlich,
    referenzzinssatz_alt, referenzzinssatz_neu, allgemeine_kostensteigerung,
    inkrafttreten, eigentuemer_name, eigentuemer_adresse, eigentuemer_ort, begruendung
  ) VALUES (
    gen_random_uuid(), v_lieg_15, v_verwalter_id,
    'Mietzinserhöhung per 01.07.2026 – Heizungsinvestition',
    'heizungsersatz', 'heizungsersatz', 'versendet',
    v_investition_total, v_foerderbeitraege, 0, 0,
    ROUND(v_wertvermehrend / v_netto_investition * 100, 2),  -- 87.58% (OR-konform nach Ersatzbeschaffung)
    v_kapitalisierungssatz,
    v_ersatzbeschaffung, -225,  -- NK-Senkung: Heizung Ölkosten → Wärmepumpe
    1.75, 1.75, 0,              -- Referenzzinssatz unverändert (nicht Grund der Erhöhung)
    '2026-07-01',
    'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat',
    'Wertvermehrende Investition gemäss Art. 269a lit. b OR i.V.m. Art. 14 VMWG: ' ||
    'Ersatz Ölheizung durch Wärmepumpe mit Erdsonde und Free Cooling. ' ||
    'Investition CHF 130''000, Förderbeiträge CHF 9''950 (inkl. EKZ CHF 7''534.40), ' ||
    'Ersatzbeschaffung 1:1 CHF 14''909.47, wertvermehrende Investition CHF 105''140.53, ' ||
    'Kapitalisierungssatz 5.00%. Nebenkostenanpassung: Heizung Ölkosten → Wärmepumpe.'
  ) RETURNING id INTO v_eh_15;

  -- Positionen Ch.15 (6 beheizte Wohnungen, Total netto 7'527)
  -- Verteilung nach Anteil Nettomietzins (Art. 14 VMWG)
  INSERT INTO mietzins_erhoehung_positionen (
    mietzins_erhoehung_id, wohnung_id, beheizt,
    miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2,
    erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu,
    investitionsanteil, begruendung, berechnet_am
  ) VALUES
  -- EG links (Ediz, 82m2, 18.22%): 1479/7527 × 438.09 = 86
  (v_eh_15, '8e0415b4-68e1-4eca-a6db-57b838d98edf', true,
   1479, 295, 18.22, 82,
   86, 86, 1565, 254,
   ROUND(v_wertvermehrend * 0.1966, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- EG rechts (Pierandozzi, 68m2, 15.11%): 1023/7527 × 438.09 = 60
  (v_eh_15, '0c949dbe-0bcd-4753-b799-06f7296d77f4', true,
   1023, 227, 15.11, 68,
   60, 60, 1083, 193,
   ROUND(v_wertvermehrend * 0.1359, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- 1.OG links (Lamprecht, 82m2, 18.22%): 1223/7527 × 438.09 = 71
  (v_eh_15, '2c03d56b-a20e-488d-8431-192689a7a706', true,
   1223, 275, 18.22, 82,
   71, 71, 1294, 234,
   ROUND(v_wertvermehrend * 0.1625, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- 1.OG rechts (Dal Pont, 68m2, 15.11%): 1199/7527 × 438.09 = 70
  (v_eh_15, 'd656127e-bf11-40d5-971b-1ca97eae58aa', true,
   1199, 247, 15.11, 68,
   70, 70, 1269, 213,
   ROUND(v_wertvermehrend * 0.1593, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- 2.OG links (Melguzo, 82m2, 18.22%): 1441/7527 × 438.09 = 84
  (v_eh_15, 'b3c08b1a-a957-462c-b626-546cccd6f208', true,
   1441, 265, 18.22, 82,
   84, 84, 1525, 224,
   ROUND(v_wertvermehrend * 0.1914, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- 2.OG rechts (Kull, 68m2, 15.11%): 1162/7527 × 438.09 = 68
  (v_eh_15, 'd9f9b780-04df-467f-ac12-af0c6a493d9c', true,
   1162, 252, 15.11, 68,
   68, 68, 1230, 218,
   ROUND(v_wertvermehrend * 0.1544, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW());

  -- ═══════════════════════════════════════════════════════════════
  -- 6. MIETZINSERHÖHUNG — CHILENAUSTRASSE 17
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO mietzins_erhoehungen (
    id, liegenschaft_id, verwalter_id, titel, grund, investitionsart, status,
    investition_total, foerderbeitraege, sonstige_kosten, sonstige_abzuege,
    wertvermehrend_prozent, kapitalisierungssatz,
    ersatzbeschaffung_1zu1, nebenkosten_aenderung_monatlich,
    referenzzinssatz_alt, referenzzinssatz_neu, allgemeine_kostensteigerung,
    inkrafttreten, eigentuemer_name, eigentuemer_adresse, eigentuemer_ort, begruendung
  ) VALUES (
    gen_random_uuid(), v_lieg_17, v_verwalter_id,
    'Mietzinserhöhung per 01.07.2026 – Heizungsinvestition',
    'heizungsersatz', 'heizungsersatz', 'versendet',
    v_investition_total, v_foerderbeitraege, 0, 0,
    ROUND(v_wertvermehrend / v_netto_investition * 100, 2),
    v_kapitalisierungssatz,
    v_ersatzbeschaffung, -192,  -- NK-Senkung: Heizung Ölkosten → Wärmepumpe
    1.75, 1.75, 0,              -- Referenzzinssatz unverändert (nicht Grund der Erhöhung)
    '2026-07-01',
    'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat',
    'Wertvermehrende Investition gemäss Art. 269a lit. b OR i.V.m. Art. 14 VMWG: ' ||
    'Ersatz Ölheizung durch Wärmepumpe mit Erdsonde und Free Cooling. ' ||
    'Investition CHF 130''000, Förderbeiträge CHF 9''950 (inkl. EKZ CHF 7''534.40), ' ||
    'Ersatzbeschaffung 1:1 CHF 14''909.47, wertvermehrende Investition CHF 105''140.53, ' ||
    'Kapitalisierungssatz 5.00%. Nebenkostenanpassung: Heizung Ölkosten → Wärmepumpe.'
  ) RETURNING id INTO v_eh_17;

  -- Positionen Ch.17 (6 beheizte Wohnungen, Total netto 7'664)
  INSERT INTO mietzins_erhoehung_positionen (
    mietzins_erhoehung_id, wohnung_id, beheizt,
    miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2,
    erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu,
    investitionsanteil, begruendung, berechnet_am
  ) VALUES
  -- EG links (Attinger, 68m2, 15.11%): 1143/7664 × 438.09 = 65
  (v_eh_17, '8a04efd5-78bf-4ddb-b675-eb3a2d0599d9', true,
   1143, 237, 15.11, 68,
   65, 65, 1208, 208,
   ROUND(v_wertvermehrend * 0.1491, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- EG rechts (Pistone, 82m2, 18.22%): 1314/7664 × 438.09 = 75
  (v_eh_17, '93da26ef-eefb-4e7e-8a78-37b329d43bd4', true,
   1314, 273, 18.22, 82,
   75, 75, 1389, 238,
   ROUND(v_wertvermehrend * 0.1714, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- 1.OG links (Meier, 68m2, 15.11%): 1153/7664 × 438.09 = 66
  (v_eh_17, '1cea54bc-397b-4ef0-98d6-ead11c79f913', true,
   1153, 227, 15.11, 68,
   66, 66, 1219, 198,
   ROUND(v_wertvermehrend * 0.1504, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- 1.OG rechts (Donati, 82m2, 18.22%): 1226/7664 × 438.09 = 70
  (v_eh_17, '30b07477-d506-4b6b-8eeb-323ce1fa0738', true,
   1226, 215, 18.22, 82,
   70, 70, 1296, 180,
   ROUND(v_wertvermehrend * 0.1599, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- 2.OG links (Santiago, 68m2, 15.11%): 1375/7664 × 438.09 = 79
  (v_eh_17, '6d9fb301-829f-40f4-aca5-e237a8e2ed11', true,
   1375, 267, 15.11, 68,
   79, 79, 1454, 238,
   ROUND(v_wertvermehrend * 0.1794, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW()),
  -- 2.OG rechts (Rohrer, 82m2, 18.22%): 1453/7664 × 438.09 = 83
  (v_eh_17, '669ee4f4-1ad7-441f-ac99-d2dae358ecff', true,
   1453, 265, 18.22, 82,
   83, 83, 1536, 230,
   ROUND(v_wertvermehrend * 0.1896, 2), 'Heizungsinvestition: Wärmepumpe + Free Cooling (Art. 269a lit. b OR)', NOW());

  -- ═══════════════════════════════════════════════════════════════
  -- 7. WOHNUNGEN — NEUE NETTOMIETEN NACH HEIZUNGSINVESTITION
  -- ═══════════════════════════════════════════════════════════════

  -- Chilenaustrasse 15
  UPDATE wohnungen SET nettomiete = 1565 WHERE id = '8e0415b4-68e1-4eca-a6db-57b838d98edf';  -- Ediz: 1479 + 86
  UPDATE wohnungen SET nettomiete = 1083 WHERE id = '0c949dbe-0bcd-4753-b799-06f7296d77f4';  -- Pierandozzi: 1023 + 60
  UPDATE wohnungen SET nettomiete = 1294 WHERE id = '2c03d56b-a20e-488d-8431-192689a7a706';  -- Lamprecht: 1223 + 71
  UPDATE wohnungen SET nettomiete = 1269 WHERE id = 'd656127e-bf11-40d5-971b-1ca97eae58aa';  -- Dal Pont: 1199 + 70
  UPDATE wohnungen SET nettomiete = 1525 WHERE id = 'b3c08b1a-a957-462c-b626-546cccd6f208';  -- Melguzo: 1441 + 84
  UPDATE wohnungen SET nettomiete = 1230 WHERE id = 'd9f9b780-04df-467f-ac12-af0c6a493d9c';  -- Kull: 1162 + 68

  -- Chilenaustrasse 17
  UPDATE wohnungen SET nettomiete = 1208 WHERE id = '8a04efd5-78bf-4ddb-b675-eb3a2d0599d9';  -- Attinger: 1143 + 65
  UPDATE wohnungen SET nettomiete = 1389 WHERE id = '93da26ef-eefb-4e7e-8a78-37b329d43bd4';  -- Pistone: 1314 + 75
  UPDATE wohnungen SET nettomiete = 1219 WHERE id = '1cea54bc-397b-4ef0-98d6-ead11c79f913';  -- Meier: 1153 + 66
  UPDATE wohnungen SET nettomiete = 1296 WHERE id = '30b07477-d506-4b6b-8eeb-323ce1fa0738';  -- Donati: 1226 + 70
  UPDATE wohnungen SET nettomiete = 1454 WHERE id = '6d9fb301-829f-40f4-aca5-e237a8e2ed11';  -- Santiago: 1375 + 79
  UPDATE wohnungen SET nettomiete = 1536 WHERE id = '669ee4f4-1ad7-441f-ac99-d2dae358ecff';  -- Rohrer: 1453 + 83

  -- ═══════════════════════════════════════════════════════════════
  -- 8. NEBENKOSTEN — HEIZUNG AUF WÄRMEPUMPE AKTUALISIEREN
  -- Ölheizung → Wärmepumpe: Heizkosten sinken (COP ~3.5)
  -- ═══════════════════════════════════════════════════════════════

  -- NK-Position Heizung: Ölkosten → Wärmepumpen-Stromkosten
  UPDATE nebenkostenpositionen SET betrag_total = 5800
  WHERE liegenschaft_id = v_lieg_15 AND jahr = 2024 AND bezeichnung = 'Heizung';

  UPDATE nebenkostenpositionen SET betrag_total = 4900
  WHERE liegenschaft_id = v_lieg_17 AND jahr = 2024 AND bezeichnung = 'Heizung';

  -- NK Akonto anpassen: Heizungskostenanteil sinkt
  -- Ch.15: Total Heizungskosten -2700/Jahr = -225/Monat, verteilt nach Fläche
  -- 82m2 (18.22%): -41/Monat | 68m2 (15.11%): -34/Monat
  UPDATE wohnungen SET nebenkosten_akonto = 254 WHERE id = '8e0415b4-68e1-4eca-a6db-57b838d98edf';  -- Ediz: 295-41
  UPDATE wohnungen SET nebenkosten_akonto = 193 WHERE id = '0c949dbe-0bcd-4753-b799-06f7296d77f4';  -- Pierandozzi: 227-34
  UPDATE wohnungen SET nebenkosten_akonto = 234 WHERE id = '2c03d56b-a20e-488d-8431-192689a7a706';  -- Lamprecht: 275-41
  UPDATE wohnungen SET nebenkosten_akonto = 213 WHERE id = 'd656127e-bf11-40d5-971b-1ca97eae58aa';  -- Dal Pont: 247-34
  UPDATE wohnungen SET nebenkosten_akonto = 224 WHERE id = 'b3c08b1a-a957-462c-b626-546cccd6f208';  -- Melguzo: 265-41
  UPDATE wohnungen SET nebenkosten_akonto = 218 WHERE id = 'd9f9b780-04df-467f-ac12-af0c6a493d9c';  -- Kull: 252-34

  -- Ch.17: Total Heizungskosten -2300/Jahr = -192/Monat, verteilt nach Fläche
  -- 82m2 (18.22%): -35/Monat | 68m2 (15.11%): -29/Monat
  UPDATE wohnungen SET nebenkosten_akonto = 208 WHERE id = '8a04efd5-78bf-4ddb-b675-eb3a2d0599d9';  -- Attinger: 237-29
  UPDATE wohnungen SET nebenkosten_akonto = 238 WHERE id = '93da26ef-eefb-4e7e-8a78-37b329d43bd4';  -- Pistone: 273-35
  UPDATE wohnungen SET nebenkosten_akonto = 198 WHERE id = '1cea54bc-397b-4ef0-98d6-ead11c79f913';  -- Meier: 227-29
  UPDATE wohnungen SET nebenkosten_akonto = 180 WHERE id = '30b07477-d506-4b6b-8eeb-323ce1fa0738';  -- Donati: 215-35
  UPDATE wohnungen SET nebenkosten_akonto = 238 WHERE id = '6d9fb301-829f-40f4-aca5-e237a8e2ed11';  -- Santiago: 267-29
  UPDATE wohnungen SET nebenkosten_akonto = 230 WHERE id = '669ee4f4-1ad7-441f-ac99-d2dae358ecff';  -- Rohrer: 265-35

  -- ═══════════════════════════════════════════════════════════════
  -- 9. NEBENKOSTENABRECHNUNGEN — AKONTO TOTAL UPDATEN
  -- ═══════════════════════════════════════════════════════════════
  UPDATE nebenkostenabrechnungen na
  SET akonto_total = w.nebenkosten_akonto * 12
  FROM wohnungen w
  WHERE na.wohnung_id = w.id
    AND w.liegenschaft_id IN (v_lieg_15, v_lieg_17)
    AND na.jahr = 2024;

  RAISE NOTICE 'Migration 016d abgeschlossen: Heizungsinvestition OR-konform eingetragen, Senkung revertiert';
END $$;