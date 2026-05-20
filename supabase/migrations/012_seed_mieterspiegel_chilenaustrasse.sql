-- Seed Mieterspiegel data for Chilenaustrasse 15 & 17, 8108 Dallikon
-- Owner/Verwalter: Kurt Rusch, Rebackerstrasse 22, 8955 Oetwil an der Limmat
-- Verteilschluessel: doubled from Excel values so each building totals 100%
--   3.5-ZWG (68m²): 7.556% → 15.11%
--   4.5-ZWG (82m²): 9.111% → 18.22%

DO $$
DECLARE
  v_verwalter_id UUID;
  v_lieg_15 UUID;
  v_lieg_17 UUID;

  -- Wohnungen Chilenaustrasse 15
  v_w_15_1001 UUID;
  v_w_15_1002 UUID;
  v_w_15_1011 UUID;
  v_w_15_1012 UUID;
  v_w_15_1021 UUID;
  v_w_15_1022 UUID;
  v_w_15_g27  UUID;
  v_w_15_g30  UUID;
  v_w_15_b2   UUID;
  v_w_15_b4   UUID;

  -- Wohnungen Chilenaustrasse 17
  v_w_17_1001 UUID;
  v_w_17_1002 UUID;
  v_w_17_1011 UUID;
  v_w_17_1012 UUID;
  v_w_17_1021 UUID;
  v_w_17_1022 UUID;
  v_w_17_p10  UUID;
  v_w_17_g35  UUID;

  -- Mieter Chilenaustrasse 15
  v_m_ediz        UUID;
  v_m_pierandozzi UUID;
  v_m_lamprecht   UUID;
  v_m_dalpont     UUID;
  v_m_melguizo    UUID;
  v_m_kull        UUID;

  -- Mieter Chilenaustrasse 17
  v_m_attinger    UUID;
  v_m_pistone     UUID;
  v_m_meier       UUID;
  v_m_donati      UUID;
  v_m_santiago    UUID;
  v_m_rohrer      UUID;

  -- Mieter External
  v_m_mrs_gmbh      UUID;
  v_m_tofano         UUID;
  v_m_zweifel        UUID;
  v_m_sichelradner   UUID;
  v_m_kurmer          UUID;

BEGIN
  -- Find Kurt Rusch's profile
  SELECT id INTO v_verwalter_id FROM profiles
    WHERE full_name ILIKE 'Kurt Rusch'
    LIMIT 1;

  IF v_verwalter_id IS NULL THEN
    RAISE WARNING 'Kurt Rusch not found in profiles. Skipping Mieterspiegel seed.';
    RETURN;
  END IF;

  -- ============================================================
  -- LIEGENSCHAFTEN
  -- ============================================================
  INSERT INTO liegenschaften (id, verwalter_id, name, strasse, hausnummer, plz, ort, kanton, anzahl_wohnungen, objekttyp)
  VALUES (
    gen_random_uuid(), v_verwalter_id,
    'Chilenaustrasse 15', 'Chilenaustrasse', '15', '8108', 'Dallikon', 'ZH',
    10, 'MFH'
  ) RETURNING id INTO v_lieg_15;

  INSERT INTO liegenschaften (id, verwalter_id, name, strasse, hausnummer, plz, ort, kanton, anzahl_wohnungen, objekttyp)
  VALUES (
    gen_random_uuid(), v_verwalter_id,
    'Chilenaustrasse 17', 'Chilenaustrasse', '17', '8108', 'Dallikon', 'ZH',
    8, 'MFH'
  ) RETURNING id INTO v_lieg_17;

  -- ============================================================
  -- WOHNUNGEN — Chilenaustrasse 15
  -- ============================================================

  -- 1001 EG links, 4.5-ZWG, 82m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1001 EG links', '1001', 0, 4.5, 82, 1479, 295, 'vermietet', 'wohnung', true, 18.22, 'EG links')
  RETURNING id INTO v_w_15_1001;

  -- 1002 EG rechts, 3.5-ZWG, 68m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1002 EG rechts', '1002', 0, 3.5, 68, 1068, 227, 'vermietet', 'wohnung', true, 15.11, 'EG rechts')
  RETURNING id INTO v_w_15_1002;

  -- 1011 1.OG links, 4.5-ZWG, 82m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1011 1.OG links', '1011', 1, 4.5, 82, 1223, 275, 'vermietet', 'wohnung', true, 18.22, '1. OG links')
  RETURNING id INTO v_w_15_1011;

  -- 1012 1.OG rechts, 3.5-ZWG, 68m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1012 1.OG rechts', '1012', 1, 3.5, 68, 1199, 247, 'vermietet', 'wohnung', true, 15.11, '1. OG rechts')
  RETURNING id INTO v_w_15_1012;

  -- 1021 2.OG links, 4.5-ZWG, 82m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1021 2.OG links', '1021', 2, 4.5, 82, 1441, 265, 'vermietet', 'wohnung', true, 18.22, '2. OG links')
  RETURNING id INTO v_w_15_1021;

  -- 1022 2.OG rechts, 3.5-ZWG, 68m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1022 2.OG rechts', '1022', 2, 3.5, 68, 1162, 252, 'vermietet', 'wohnung', true, 15.11, '2. OG rechts')
  RETURNING id INTO v_w_15_1022;

  -- EG Nr. 27 — Garage (MRS GmbH)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'EG Nr. 27 Garage', '27', 0, 0, 0, 0, 0, 'vermietet', 'einstellgarage', false, 'EG')
  RETURNING id INTO v_w_15_g27;

  -- EG Nr. 30 — Garage (Cedric Dal Pont)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'EG Nr. 30 Garage', '30', 0, 0, 0, 0, 0, 'vermietet', 'einstellgarage', false, 'EG')
  RETURNING id INTO v_w_15_g30;

  -- Bastelr. Nr. 2 — Bastelraum (Peter Sichelradner)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Bastelr. Nr. 2', 'B2', 0, 1, 0, 0, 57, 'vermietet', 'bastelraum', false, 'EG')
  RETURNING id INTO v_w_15_b2;

  -- Bastelr. Nr. 4 — Bastelraum (Ursula Kurmer)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Bastelr. Nr. 4', 'B4', 0, 1, 0, 0, 78, 'vermietet', 'bastelraum', false, 'EG')
  RETURNING id INTO v_w_15_b4;

  -- ============================================================
  -- WOHNUNGEN — Chilenaustrasse 17
  -- ============================================================

  -- 1001 EG links, 3.5-ZWG, 68m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1001 EG links', '1001', 0, 3.5, 68, 1143, 237, 'vermietet', 'wohnung', true, 15.11, 'EG links')
  RETURNING id INTO v_w_17_1001;

  -- 1002 EG rechts, 4.5-ZWG, 82m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1002 EG rechts', '1002', 0, 4.5, 82, 1314, 273, 'vermietet', 'wohnung', true, 18.22, 'EG rechts')
  RETURNING id INTO v_w_17_1002;

  -- 1011 1.OG links, 3.5-ZWG, 68m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1011 1.OG links', '1011', 1, 3.5, 68, 1106, 227, 'vermietet', 'wohnung', true, 15.11, '1. OG links')
  RETURNING id INTO v_w_17_1011;

  -- 1012 1.OG rechts, 4.5-ZWG, 82m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1012 1.OG rechts', '1012', 1, 4.5, 82, 1226, 215, 'vermietet', 'wohnung', true, 18.22, '1. OG rechts')
  RETURNING id INTO v_w_17_1012;

  -- 1021 2.OG links, 3.5-ZWG, 68m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1021 2.OG links', '1021', 2, 3.5, 68, 1375, 267, 'vermietet', 'wohnung', true, 15.11, '2. OG links')
  RETURNING id INTO v_w_17_1021;

  -- 1022 2.OG rechts, 4.5-ZWG, 82m²
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1022 2.OG rechts', '1022', 2, 4.5, 82, 1453, 265, 'vermietet', 'wohnung', true, 18.22, '2. OG rechts')
  RETURNING id INTO v_w_17_1022;

  -- PP Nr. 10 — Parkplatz (Petra Tofano)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'PP Nr. 10 Parkplatz', 'P10', 0, 0, 0, 0, 0, 'vermietet', 'parkplatz_aussen', false, 'EG')
  RETURNING id INTO v_w_17_p10;

  -- EG Nr. 35 — Garage (Yves Zweifel)
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'EG Nr. 35 Garage', '35', 0, 0, 0, 0, 0, 'vermietet', 'einstellgarage', false, 'EG')
  RETURNING id INTO v_w_17_g35;

  -- ============================================================
  -- MIETER — Chilenaustrasse 15
  -- ============================================================

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Gulsen', 'Ediz', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_ediz;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Nadia', 'Pierandozzi', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_pierandozzi;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Monika', 'Lamprecht', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_lamprecht;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Cedric', 'Dal Pont', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_dalpont;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Manuel', 'Melguizo', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_melguizo;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Rudolf', 'Kull', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_kull;

  -- ============================================================
  -- MIETER — Chilenaustrasse 17
  -- ============================================================

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Sacha', 'Attinger', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_attinger;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Monika', 'Pistone', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_pistone;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Anita', 'Meier', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_meier;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Beatrice', 'Donati', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_donati;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Manuela', 'Santiago', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_santiago;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Stephanie', 'Rohrer', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_rohrer;

  -- ============================================================
  -- MIETER — External (garages, parking, workshops)
  -- ============================================================

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'MRS', 'GmbH', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_mrs_gmbh;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Petra', 'Tofano', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_tofano;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Yves', 'Zweifel', 'Chilenaustrasse 17', '8108', 'Dallikon')
  RETURNING id INTO v_m_zweifel;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Peter', 'Sichelradner', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_sichelradner;

  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Ursula', 'Kurmer', 'Chilenaustrasse 15', '8108', 'Dallikon')
  RETURNING id INTO v_m_kurmer;

  -- ============================================================
  -- MIETVERHAELTNISSE — Chilenaustrasse 15 (apartments)
  -- ============================================================

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_1001, v_m_ediz, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_1002, v_m_pierandozzi, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_1011, v_m_lamprecht, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_1012, v_m_dalpont, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_1021, v_m_melguizo, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_1022, v_m_kull, true, true, '2024-01-01');

  -- MIETVERHAELTNISSE — Chilenaustrasse 15 (external)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_g27, v_m_mrs_gmbh, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_g30, v_m_dalpont, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_b2, v_m_sichelradner, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_15_b4, v_m_kurmer, true, true, '2024-01-01');

  -- ============================================================
  -- MIETVERHAELTNISSE — Chilenaustrasse 17 (apartments)
  -- ============================================================

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_1001, v_m_attinger, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_1002, v_m_pistone, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_1011, v_m_meier, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_1012, v_m_donati, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_1021, v_m_santiago, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_1022, v_m_rohrer, true, true, '2024-01-01');

  -- MIETVERHAELTNISSE — Chilenaustrasse 17 (external)
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_p10, v_m_tofano, true, true, '2024-01-01');

  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn)
  VALUES (v_w_17_g35, v_m_zweifel, true, true, '2024-01-01');

  RAISE NOTICE 'Mieterspiegel seed completed: 2 Liegenschaften, 18 Wohnungen, 17 Mieter, 18 Mietverhältnisse';
END $$;