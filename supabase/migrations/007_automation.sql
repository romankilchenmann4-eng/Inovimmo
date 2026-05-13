-- ── SPRINT 8: Automation ─────────────────────────────────────────────────────

-- Mark auto-generated Mahnungen for audit trail
alter table public.mahnungen
  add column if not exists auto_erstellt boolean not null default false;

-- Kalender-Events: add verwalter_id if missing (for CRON-created events)
alter table public.kalender_events
  add column if not exists verwalter_id uuid references public.profiles(id);

-- Mietverhaeltnisse: flag for reminder sent
alter table public.mietverhaeltnisse
  add column if not exists ablauf_reminder_sent boolean not null default false;
-- Note: wohnungstyp already exists from migration 003 with values:
-- wohnung | gewerbe | bastelraum | parkplatz_aussen | einstellgarage | lager | sonstiges
