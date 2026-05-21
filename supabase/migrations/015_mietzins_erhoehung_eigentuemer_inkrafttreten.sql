-- Migration 015: Eigentümer-Felder und inkrafttreten für Mietzinserhöhungen
-- Formalizes columns that were already inserted by application code

ALTER TABLE mietzins_erhoehungen
  ADD COLUMN IF NOT EXISTS eigentuemer_name text,
  ADD COLUMN IF NOT EXISTS eigentuemer_adresse text,
  ADD COLUMN IF NOT EXISTS eigentuemer_ort text,
  ADD COLUMN IF NOT EXISTS inkrafttreten date;

-- Migrate inkrafttreten_ab → inkraftreten if the old column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mietzins_erhoehungen' AND column_name = 'inkrafttreten_ab'
  ) THEN
    UPDATE mietzins_erhoehungen
      SET inkrafttreten = inkrafttreten_ab::date
      WHERE inkrafttreten IS NULL AND inkrafttreten_ab IS NOT NULL;

    ALTER TABLE mietzins_erhoehungen DROP COLUMN inkrafttreten_ab;
  END IF;
END
$$;