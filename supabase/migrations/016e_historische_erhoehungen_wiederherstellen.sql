-- ============================================================
-- Migration v16e: Historische Mietzinserhöhungen 2023/2024 wiederherstellen
-- Versehentlich durch 016d DO-Block gelöscht
-- ============================================================

DO $$
DECLARE
  v_verwalter_id UUID := '7519ce09-5898-45e1-a237-c52f14536269';
  v_lieg_15 UUID := '0fbd2589-d9f8-441e-9e14-dbe312490bef';
  v_lieg_17 UUID := '2197c7fa-a0ef-4aa2-8490-4dda39eb7294';
  v_eh_2023 UUID;
  v_eh_2024 UUID;
BEGIN

  -- ═══════════════════════════════════════════════════════════════
  -- 1. MIETZINSERHÖHUNG 2023 (Ref-Zins 1.25% → 1.50%, Lamprecht)
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
    'Mietzinserhöhung per 01.10.2023',
    'wertvermehrend_sonstiges', 'wertvermehrend_sonstiges', 'versendet',
    0, 0, 0, 0, 70, 8,
    0, 0,
    1.25, 1.50, 0,
    '2023-10-01',
    'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat',
    'Referenzzinssatz 1.25% auf 1.50%'
  ) RETURNING id INTO v_eh_2023;

  INSERT INTO mietzins_erhoehung_positionen (
    mietzins_erhoehung_id, wohnung_id, beheizt,
    miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2,
    erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu,
    investitionsanteil, begruendung, berechnet_am
  ) VALUES (
    v_eh_2023, '2c03d56b-a20e-488d-8431-192689a7a706', true,
    1108, 275, 18.22, 82,
    76, 76, 1184, 275,
    0, 'Nettomiete 1108 auf 1184 (Ref.-Zins 1.25%→1.50%)', NOW()
  );

  -- ═══════════════════════════════════════════════════════════════
  -- 2. MIETZINSERHÖHUNG 2024 (Ref-Zins 1.50% → 1.75%)
  -- Liegenschaft Ch.17, aber Positionen für beide Liegenschaften
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
    'Mietzinserhöhung per 01.04.2024',
    'wertvermehrend_sonstiges', 'wertvermehrend_sonstiges', 'versendet',
    0, 0, 0, 0, 70, 8,
    0, 0,
    1.50, 1.75, 0,
    '2024-04-01',
    'Kurt Rusch', 'Rebackerstrasse 22, 8955', 'Oetwil an der Limmat',
    'Referenzzinssatz 1.50% auf 1.75%, Teuerungsausgleich, Kostensteigerung'
  ) RETURNING id INTO v_eh_2024;

  -- Positionen Ch.17
  INSERT INTO mietzins_erhoehung_positionen (
    mietzins_erhoehung_id, wohnung_id, beheizt,
    miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2,
    erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu,
    investitionsanteil, begruendung, berechnet_am
  ) VALUES
  (v_eh_2024, '1cea54bc-397b-4ef0-98d6-ead11c79f913', true,
   1116, 227, 15.11, 68, 37, 37, 1153, 227, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW()),
  (v_eh_2024, '93da26ef-eefb-4e7e-8a78-37b329d43bd4', true,
   1272, 273, 18.22, 82, 42, 42, 1314, 273, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW());

  -- Positionen Ch.15
  INSERT INTO mietzins_erhoehung_positionen (
    mietzins_erhoehung_id, wohnung_id, beheizt,
    miete_alt, nebenkosten_alt, verteilschluessel_prozent, flaeche_m2,
    erhoehung_betrag, erhoehung_monatlich, miete_neu, nebenkosten_neu,
    investitionsanteil, begruendung, berechnet_am
  ) VALUES
  (v_eh_2024, '8e0415b4-68e1-4eca-a6db-57b838d98edf', true,
   1432, 295, 18.22, 82, 47, 47, 1479, 295, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW()),
  (v_eh_2024, 'd656127e-bf11-40d5-971b-1ca97eae58aa', true,
   1160, 247, 15.11, 68, 39, 39, 1199, 247, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW()),
  (v_eh_2024, '2c03d56b-a20e-488d-8431-192689a7a706', true,
   1184, 275, 18.22, 82, 39, 39, 1223, 275, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW()),
  (v_eh_2024, 'b3c08b1a-a957-462c-b626-546cccd6f208', true,
   1395, 265, 18.22, 82, 46, 46, 1441, 265, 0, 'Ref.-Zins 1.50%→1.75%, Teuerung, Kostensteigerung', NOW());

  RAISE NOTICE 'Migration 016e abgeschlossen: Historische Erhöhungen 2023/2024 wiederhergestellt';
END $$;