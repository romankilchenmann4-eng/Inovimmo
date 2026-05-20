-- ============================================================
-- Inovimmo — Migration v13
-- RLS: Admin access, mieter policy fix, seed Chilenaustrasse
-- ============================================================

-- ── ALTER TABLES: ensure missing columns exist ────────────────
ALTER TABLE public.wohnungen ADD COLUMN IF NOT EXISTS wohnungstyp text NOT NULL DEFAULT 'wohnung'
  CHECK (wohnungstyp IN ('wohnung','gewerbe','bastelraum','parkplatz_aussen','einstellgarage','lager','sonstiges'));
ALTER TABLE public.wohnungen ADD COLUMN IF NOT EXISTS beheizt boolean NOT NULL DEFAULT true;
ALTER TABLE public.wohnungen ADD COLUMN IF NOT EXISTS whg_nr text;
ALTER TABLE public.wohnungen ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.wohnungen ADD COLUMN IF NOT EXISTS verteilschluessel_prozent numeric(5,2);
ALTER TABLE public.wohnungen ADD COLUMN IF NOT EXISTS externe_referenz text;
ALTER TABLE public.liegenschaften ADD COLUMN IF NOT EXISTS externe_referenz text;

-- ── ALTER TABLE mieter: rename erstellt_von → verwalter_id, add missing columns ──
ALTER TABLE public.mieter RENAME COLUMN erstellt_von TO verwalter_id;
ALTER TABLE public.mieter ADD COLUMN IF NOT EXISTS strasse text;
ALTER TABLE public.mieter ADD COLUMN IF NOT EXISTS plz text;
ALTER TABLE public.mieter ADD COLUMN IF NOT EXISTS ort text;
ALTER TABLE public.mieter ADD COLUMN IF NOT EXISTS nationalitaet text;
ALTER TABLE public.mieter ADD COLUMN IF NOT EXISTS ausweis_typ text CHECK (ausweis_typ IN ('CH','C','B','L','G','Sonstiges'));
ALTER TABLE public.mieter ADD COLUMN IF NOT EXISTS ausweis_ablauf date;
ALTER TABLE public.mieter ADD COLUMN IF NOT EXISTS notizen text;
ALTER TABLE public.mieter ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── RLS: Admin can see all ────────────────────────────────────
DROP POLICY IF EXISTS "liegenschaften_owner" ON public.liegenschaften;
CREATE POLICY "liegenschaften_owner" ON public.liegenschaften
  FOR ALL USING (
    verwalter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "wohnungen_owner" ON public.wohnungen;
CREATE POLICY "wohnungen_owner" ON public.wohnungen
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.liegenschaften l WHERE l.id = liegenschaft_id AND l.verwalter_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mietverhaeltnisse mv
      JOIN public.mieter m ON m.id = mv.mieter_id
      WHERE mv.wohnung_id = wohnungen.id
        AND (mv.mietende IS NULL OR mv.mietende > NOW())
        AND lower(m.email) = lower(auth.jwt() ->> 'email')
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "mietverhaeltnisse_owner" ON public.mietverhaeltnisse;
CREATE POLICY "mietverhaeltnisse_owner" ON public.mietverhaeltnisse
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.liegenschaften l
      JOIN public.wohnungen w ON w.liegenschaft_id = l.id
      WHERE w.id = mietverhaeltnisse.wohnung_id AND l.verwalter_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "mieter_owner" ON public.mieter;
CREATE POLICY "mieter_owner" ON public.mieter
  FOR ALL USING (verwalter_id = auth.uid());

-- ── KURT RUSCH AUTH USER (falls nicht existent) ──────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE full_name ILIKE 'Kurt Rusch') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new,
      recovery_token, raw_app_meta_data, raw_user_meta_data, is_sso_user, deleted_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'kurt.rusch@inovimmo.ch',
      crypt('ChangeMe123!', gen_salt('bf')),
      NOW(),
      NOW(), NOW(),
      '', '', '', '',
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "Kurt Rusch", "role": "verwalter"}',
      false, NULL
    ) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

INSERT INTO public.profiles (id, email, full_name, role, firma, adresse, plz, ort)
SELECT u.id, u.email, 'Kurt Rusch', 'verwalter', 'Rusch Immobilien', 'Rebackerstrasse 22', '8955', 'Oetwil an der Limmat'
FROM auth.users u
WHERE u.email ILIKE 'kurt.rusch@inovimmo.ch'
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.full_name ILIKE 'Kurt Rusch')
ON CONFLICT (id) DO NOTHING;

-- ── SEED: Chilenaustrasse 15 & 17 ────────────────────────────
DO $$
DECLARE
  v_verwalter_id UUID;
  v_lieg_15 UUID;
  v_lieg_17 UUID;
  v_w_15_1001 UUID; v_w_15_1002 UUID; v_w_15_1011 UUID; v_w_15_1012 UUID;
  v_w_15_1021 UUID; v_w_15_1022 UUID; v_w_15_g27 UUID; v_w_15_g30 UUID;
  v_w_15_b2 UUID; v_w_15_b4 UUID;
  v_w_17_1001 UUID; v_w_17_1002 UUID; v_w_17_1011 UUID; v_w_17_1012 UUID;
  v_w_17_1021 UUID; v_w_17_1022 UUID; v_w_17_p10 UUID; v_w_17_g35 UUID;
  v_m_ediz UUID; v_m_pierandozzi UUID; v_m_lamprecht UUID; v_m_dalpont UUID;
  v_m_melguizo UUID; v_m_kull UUID;
  v_m_attinger UUID; v_m_pistone UUID; v_m_meier UUID; v_m_donati UUID;
  v_m_santiago UUID; v_m_rohrer UUID;
  v_m_mrs_gmbh UUID; v_m_tofano UUID; v_m_zweifel UUID;
  v_m_sichelradner UUID; v_m_kurmer UUID;
BEGIN
  SELECT id INTO v_verwalter_id FROM profiles WHERE full_name ILIKE 'Kurt Rusch' LIMIT 1;
  IF v_verwalter_id IS NULL THEN
    RAISE WARNING 'Kurt Rusch not found. Skipping seed.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM liegenschaften WHERE name = 'Chilenaustrasse 15' AND verwalter_id = v_verwalter_id) THEN
    RAISE NOTICE 'Seed already exists. Skipping.';
    RETURN;
  END IF;

  INSERT INTO liegenschaften (id, verwalter_id, name, strasse, hausnummer, plz, ort, kanton, anzahl_wohnungen, objekttyp)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Chilenaustrasse 15', 'Chilenaustrasse', '15', '8108', 'Dallikon', 'ZH', 10, 'MFH')
  RETURNING id INTO v_lieg_15;

  INSERT INTO liegenschaften (id, verwalter_id, name, strasse, hausnummer, plz, ort, kanton, anzahl_wohnungen, objekttyp)
  VALUES (gen_random_uuid(), v_verwalter_id, 'Chilenaustrasse 17', 'Chilenaustrasse', '17', '8108', 'Dallikon', 'ZH', 8, 'MFH')
  RETURNING id INTO v_lieg_17;

  -- Chilenaustrasse 15 Wohnungen
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1001 EG links', '1001', 0, 4.5, 82, 1479, 295, 'vermietet', 'wohnung', true, 18.22, 'EG links') RETURNING id INTO v_w_15_1001;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1002 EG rechts', '1002', 0, 3.5, 68, 1068, 227, 'vermietet', 'wohnung', true, 15.11, 'EG rechts') RETURNING id INTO v_w_15_1002;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1011 1.OG links', '1011', 1, 4.5, 82, 1223, 275, 'vermietet', 'wohnung', true, 18.22, '1. OG links') RETURNING id INTO v_w_15_1011;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1012 1.OG rechts', '1012', 1, 3.5, 68, 1199, 247, 'vermietet', 'wohnung', true, 15.11, '1. OG rechts') RETURNING id INTO v_w_15_1012;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1021 2.OG links', '1021', 2, 4.5, 82, 1441, 265, 'vermietet', 'wohnung', true, 18.22, '2. OG links') RETURNING id INTO v_w_15_1021;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Whg 1022 2.OG rechts', '1022', 2, 3.5, 68, 1162, 252, 'vermietet', 'wohnung', true, 15.11, '2. OG rechts') RETURNING id INTO v_w_15_1022;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'EG Nr. 27 Garage', '27', 0, 0, 0, 0, 0, 'vermietet', 'einstellgarage', false, 'EG') RETURNING id INTO v_w_15_g27;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'EG Nr. 30 Garage', '30', 0, 0, 0, 0, 0, 'vermietet', 'einstellgarage', false, 'EG') RETURNING id INTO v_w_15_g30;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Bastelr. Nr. 2', 'B2', 0, 1, 0, 0, 57, 'vermietet', 'bastelraum', false, 'EG') RETURNING id INTO v_w_15_b2;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_15, 'Bastelr. Nr. 4', 'B4', 0, 1, 0, 0, 78, 'vermietet', 'bastelraum', false, 'EG') RETURNING id INTO v_w_15_b4;

  -- Chilenaustrasse 17 Wohnungen
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1001 EG links', '1001', 0, 3.5, 68, 1143, 237, 'vermietet', 'wohnung', true, 15.11, 'EG links') RETURNING id INTO v_w_17_1001;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1002 EG rechts', '1002', 0, 4.5, 82, 1314, 273, 'vermietet', 'wohnung', true, 18.22, 'EG rechts') RETURNING id INTO v_w_17_1002;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1011 1.OG links', '1011', 1, 3.5, 68, 1106, 227, 'vermietet', 'wohnung', true, 15.11, '1. OG links') RETURNING id INTO v_w_17_1011;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1012 1.OG rechts', '1012', 1, 4.5, 82, 1226, 215, 'vermietet', 'wohnung', true, 18.22, '1. OG rechts') RETURNING id INTO v_w_17_1012;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1021 2.OG links', '1021', 2, 3.5, 68, 1375, 267, 'vermietet', 'wohnung', true, 15.11, '2. OG links') RETURNING id INTO v_w_17_1021;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, verteilschluessel_prozent, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'Whg 1022 2.OG rechts', '1022', 2, 4.5, 82, 1453, 265, 'vermietet', 'wohnung', true, 18.22, '2. OG rechts') RETURNING id INTO v_w_17_1022;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'PP Nr. 10 Parkplatz', 'P10', 0, 0, 0, 0, 0, 'vermietet', 'parkplatz_aussen', false, 'EG') RETURNING id INTO v_w_17_p10;
  INSERT INTO wohnungen (id, liegenschaft_id, bezeichnung, whg_nr, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, status, wohnungstyp, beheizt, position)
  VALUES (gen_random_uuid(), v_lieg_17, 'EG Nr. 35 Garage', '35', 0, 0, 0, 0, 0, 'vermietet', 'einstellgarage', false, 'EG') RETURNING id INTO v_w_17_g35;

  -- Mieter Chilenaustrasse 15
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Gulsen', 'Ediz', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_ediz;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Nadia', 'Pierandozzi', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_pierandozzi;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Monika', 'Lamprecht', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_lamprecht;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Cedric', 'Dal Pont', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_dalpont;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Manuel', 'Melguizo', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_melguizo;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Rudolf', 'Kull', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_kull;

  -- Mieter Chilenaustrasse 17
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Sacha', 'Attinger', 'Chilenaustrasse 17', '8108', 'Dallikon') RETURNING id INTO v_m_attinger;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Monika', 'Pistone', 'Chilenaustrasse 17', '8108', 'Dallikon') RETURNING id INTO v_m_pistone;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Anita', 'Meier', 'Chilenaustrasse 17', '8108', 'Dallikon') RETURNING id INTO v_m_meier;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Beatrice', 'Donati', 'Chilenaustrasse 17', '8108', 'Dallikon') RETURNING id INTO v_m_donati;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Manuela', 'Santiago', 'Chilenaustrasse 17', '8108', 'Dallikon') RETURNING id INTO v_m_santiago;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Stephanie', 'Rohrer', 'Chilenaustrasse 17', '8108', 'Dallikon') RETURNING id INTO v_m_rohrer;

  -- Mieter External
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'MRS', 'GmbH', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_mrs_gmbh;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Petra', 'Tofano', 'Chilenaustrasse 17', '8108', 'Dallikon') RETURNING id INTO v_m_tofano;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Yves', 'Zweifel', 'Chilenaustrasse 17', '8108', 'Dallikon') RETURNING id INTO v_m_zweifel;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Peter', 'Sichelradner', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_sichelradner;
  INSERT INTO mieter (id, verwalter_id, vorname, nachname, strasse, plz, ort) VALUES (gen_random_uuid(), v_verwalter_id, 'Ursula', 'Kurmer', 'Chilenaustrasse 15', '8108', 'Dallikon') RETURNING id INTO v_m_kurmer;

  -- Mietverhältnisse Chilenaustrasse 15
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_1001, v_m_ediz, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_1002, v_m_pierandozzi, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_1011, v_m_lamprecht, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_1012, v_m_dalpont, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_1021, v_m_melguizo, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_1022, v_m_kull, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_g27, v_m_mrs_gmbh, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_g30, v_m_dalpont, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_b2, v_m_sichelradner, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_15_b4, v_m_kurmer, true, true, '2024-01-01');

  -- Mietverhältnisse Chilenaustrasse 17
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_17_1001, v_m_attinger, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_17_1002, v_m_pistone, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_17_1011, v_m_meier, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_17_1012, v_m_donati, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_17_1021, v_m_santiago, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_17_1022, v_m_rohrer, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_17_p10, v_m_tofano, true, true, '2024-01-01');
  INSERT INTO mietverhaeltnisse (wohnung_id, mieter_id, ist_vertragspartner, ist_hauptperson, mietbeginn) VALUES (v_w_17_g35, v_m_zweifel, true, true, '2024-01-01');

  RAISE NOTICE 'Mieterspiegel seed completed: 2 Liegenschaften, 18 Wohnungen, 17 Mieter, 18 Mietverhältnisse';
END $$;