-- Prevent duplicate miete_soll/nk_soll entries for the same wohnung+period
-- This ensures the monthly cron cannot create duplicate bookings
CREATE UNIQUE INDEX IF NOT EXISTS buchungen_unique_soll
  ON buchungen (wohnung_id, typ, periode_monat, periode_jahr)
  WHERE typ IN ('miete_soll', 'nk_soll');