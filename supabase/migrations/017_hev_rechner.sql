-- ============================================================
-- HEV-konformer Mietzinsrechner: Neue Spalten & Datenbereinigung
-- 4 Berechnungsblöcke: Referenzzinssatz, Teuerung, Kostensteigerung, Investitionen
-- ============================================================
-- ⚠️  WARNING: This migration DELETES ALL rows from mietzins_erhoehungen
-- and mietzins_erhoehung_positionen before applying schema changes.
-- This is intentional for initial seed cleanup — the tables should be
-- empty in production at the time this migration runs. If you have
-- production data in these tables, BACK UP before applying.

-- Bestehende Mietzinserhöhung-Daten löschen (alte Berechnungen sind nicht HEV-konform)
DELETE FROM mietzins_erhoehung_positionen;
DELETE FROM mietzins_erhoehungen;

-- Block 1: Referenzzinssatz
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS referenzzinssatz_alt numeric DEFAULT 0;
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS referenzzinssatz_neu numeric DEFAULT 0;
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS referenzzinssatz_aenderung numeric DEFAULT 0;

-- Block 2: Teuerungsausgleich (LIK)
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS lik_index_alt numeric DEFAULT 0;
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS lik_index_neu numeric DEFAULT 0;
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS teuerung_prozent numeric DEFAULT 0;
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS teuerung_40_prozent numeric DEFAULT 0;

-- Block 3: Kostensteigerung
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS kostensteigerung_pauschale numeric DEFAULT 0;
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS kostensteigerung_pro_jahr numeric DEFAULT 0;

-- Datum-Felder
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS berechnungsdatum date;
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS letzte_anpassung date;
ALTER TABLE mietzins_erhoehungen ADD COLUMN IF NOT EXISTS mietbeginn date;

-- Alte Spalten entfernen, die nicht mehr benötigt werden
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS zuschlag;
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS zuschlag_prozent;
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS kapitalisierungssatz;
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS sonstige_kosten;
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS sonstige_abzuege;
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS allgemeine_kostensteigerung;
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS investitionsart;
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS netto_investition;
ALTER TABLE mietzins_erhoehungen DROP COLUMN IF EXISTS jahressatz_total;

-- Grund-Typ auf neue Werte aktualisieren
-- (Alte Werte wie 'heizungsersatz', 'renovation', 'wertvermehrend_sonstiges' werden auf 'investition' gemappt)
-- 'kostensteigerung' bleibt bestehen
UPDATE mietzins_erhoehungen SET grund = 'investition' WHERE grund IN ('heizungsersatz', 'renovation', 'wertvermehrend_sonstiges');
UPDATE mietzins_erhoehungen SET grund = 'referenzzinssatz' WHERE grund IN ('hypothek');