-- Performance indexes for common query patterns
-- These indexes target the most frequent query patterns observed in cron jobs and dashboard pages.

-- buchungen: filtered by liegenschaft_id, typ, and periode_jahr (monatssoll, mahnungen cron)
CREATE INDEX IF NOT EXISTS idx_buchungen_liegenschaft_typ_jahr
  ON public.buchungen(liegenschaft_id, typ, periode_jahr);

-- mietzins_erhoehungen: filtered by liegenschaft_id (dashboard list)
CREATE INDEX IF NOT EXISTS idx_mietzins_erhoehungen_liegenschaft
  ON public.mietzins_erhoehungen(liegenschaft_id);

-- mietzins_erhoehung_positionen: filtered by mietzins_erhoehung_id (position list)
CREATE INDEX IF NOT EXISTS idx_mietzins_erhoehung_positionen_erhoehung
  ON public.mietzins_erhoehung_positionen(mietzins_erhoehung_id);