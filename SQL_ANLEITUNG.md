# SQL-Migrationen für Inovimmo

## Ausstehende Migrationen

### 1. Migration 009: Automation Runs Table

**Status:** ⚠️ MUSS AUSGEFÜHRT WERDEN

**URL:** https://supabase.com/dashboard/project/uyyhylyhohgkqfbgmxze/sql/new

```sql
-- Migration 009: Automation Runs Table
-- Execute this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  job_name        text not null,
  status          text not null default 'running' check (status in ('running','success','failed')),
  trigger         text not null default 'cron' check (trigger in ('cron','manual','status')),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     integer,
  summary_json    jsonb not null default '{}'::jsonb,
  error_message   text,
  triggered_by    uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_job_started
  ON public.automation_runs(job_name, started_at desc);

CREATE INDEX IF NOT EXISTS idx_automation_runs_status
  ON public.automation_runs(status);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "automation_runs_admin_verwalter"
  ON public.automation_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','verwalter')
    )
  );
```

---

### 2. Migration 011: Security Policies (RLS)

**Status:** ⚠️ MUSS AUSGEFÜHRT WERDEN

**URL:** https://supabase.com/dashboard/project/uyyhylyhohgqfbgmxze/sql/new

```sql
-- ============================================================
-- Inovimmo — Migration v11
-- Security: Vollständige RLS Policies
-- ============================================================

-- ── ONBOARDING_TOKENS ───────────────────────────────────────
alter table public.onboarding_tokens enable row level security;

drop policy if exists "onboarding_tokens_owner" on public.onboarding_tokens;
create policy "onboarding_tokens_owner" on public.onboarding_tokens
  for all using (verwalter_id = auth.uid());

drop policy if exists "onboarding_tokens_public_read" on public.onboarding_tokens;
create policy "onboarding_tokens_public_read" on public.onboarding_tokens
  for select using (
    used_at is null
    and expires_at > now()
    and (
      verwalter_id = auth.uid()
      OR (auth.jwt() ->> 'email' IS NOT NULL AND lower(mieter_email) = lower(auth.jwt() ->> 'email'))
    )
  );

-- ── MIETER ───────────────────────────────────────────────────
alter table public.mieter enable row level security;

drop policy if exists "mieter_owner" on public.mieter;
create policy "mieter_owner" on public.mieter
  for all using (erstellt_von = auth.uid());

drop policy if exists "mieter_admin_read" on public.mieter;
create policy "mieter_admin_read" on public.mieter
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'verwalter')
    )
  );

drop policy if exists "mieter_self_read" on public.mieter;
create policy "mieter_self_read" on public.mieter
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ── BUCHUNGEN ────────────────────────────────────────────────
alter table public.buchungen enable row level security;

drop policy if exists "buchungen_owner" on public.buchungen;
create policy "buchungen_owner" on public.buchungen
  for all using (verwalter_id = auth.uid());

drop policy if exists "buchungen_mieter_read" on public.buchungen;
create policy "buchungen_mieter_read" on public.buchungen
  for select using (
    exists (
      select 1 from public.mietverhaeltnisse mv
      join public.mieter m on m.id = mv.mieter_id
      where mv.wohnung_id = buchungen.wohnung_id
        and (mv.mietende is null or mv.mietende > now())
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- ── MAHNUNGEN ────────────────────────────────────────────────
alter table public.mahnungen enable row level security;

drop policy if exists "mahnungen_owner" on public.mahnungen;
create policy "mahnungen_owner" on public.mahnungen
  for all using (verwalter_id = auth.uid());

drop policy if exists "mahnungen_mieter_read" on public.mahnungen;
create policy "mahnungen_mieter_read" on public.mahnungen
  for select using (
    exists (
      select 1 from public.mietverhaeltnisse mv
      join public.mieter m on m.id = mv.mieter_id
      where mv.wohnung_id = mahnungen.wohnung_id
        and (mv.mietende is null or mv.mietende > now())
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- ── NEBENKOSTENABRECHNUNGEN ──────────────────────────────────
alter table public.nebenkostenabrechnungen enable row level security;

drop policy if exists "nebenkostenabrechnungen_owner" on public.nebenkostenabrechnungen;
create policy "nebenkostenabrechnungen_owner" on public.nebenkostenabrechnungen
  for all using (
    exists (
      select 1 from public.liegenschaften l
      where l.id = nebenkostenabrechnungen.liegenschaft_id
      and l.verwalter_id = auth.uid()
    )
  );

drop policy if exists "nebenkostenabrechnungen_mieter_read" on public.nebenkostenabrechnungen;
create policy "nebenkostenabrechnungen_mieter_read" on public.nebenkostenabrechnungen
  for select using (
    exists (
      select 1 from public.mietverhaeltnisse mv
      join public.mieter m on m.id = mv.mieter_id
      where mv.wohnung_id = nebenkostenabrechnungen.wohnung_id
        and (mv.mietende is null or mv.mietende > now())
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- ── DOKUMENTE ────────────────────────────────────────────────
alter table public.dokumente enable row level security;

drop policy if exists "dokumente_owner" on public.dokumente;
create policy "dokumente_owner" on public.dokumente
  for all using (hochgeladen_von = auth.uid());

drop policy if exists "dokumente_verwalter" on public.dokumente;
create policy "dokumente_verwalter" on public.dokumente
  for all using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'verwalter')
    )
  );

drop policy if exists "dokumente_mieter_read" on public.dokumente;
create policy "dokumente_mieter_read" on public.dokumente
  for select using (
    exists (
      select 1 from public.mietverhaeltnisse mv
      join public.mieter m on m.id = mv.mieter_id
      where mv.wohnung_id = dokumente.wohnung_id
        and (mv.mietende is null or mv.mietende > now())
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- ── AUTOMATION_RUNS ──────────────────────────────────────────
alter table public.automation_runs enable row level security;

drop policy if exists "automation_runs_admin_verwalter" on public.automation_runs;
create policy "automation_runs_admin_verwalter" on public.automation_runs
  for all using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'verwalter')
    )
  );

-- ── LIEGENSCHAFT_BERECHTIGUNGEN ─────────────────────────────
alter table public.liegenschaft_berechtigungen enable row level security;

drop policy if exists "liegenschaft_berechtigungen_owner" on public.liegenschaft_berechtigungen;
create policy "liegenschaft_berechtigungen_owner" on public.liegenschaft_berechtigungen
  for all using (user_id = auth.uid());

drop policy if exists "liegenschaft_berechtigungen_admin" on public.liegenschaft_berechtigungen;
create policy "liegenschaft_berechtigungen_admin" on public.liegenschaft_berechtigungen
  for all using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role = 'admin'
    )
  );
```

---

## Anleitung

1. **Öffne Supabase Dashboard:** https://supabase.com/dashboard/project/uyyhylyhohgkqfbgmxze/sql/new
2. **Klicke auf "New Query"** (oben rechts)
3. **Kopiere das SQL** aus Migration 009 ODER Migration 011
4. **Klicke auf "Run"** (oder Strg/Cmd + Enter)
5. **Wiederhole** für beide Migrationen

## Nach der Ausführung

- ✅ Automation-Runs werden protokolliert
- ✅ Row Level Security ist für alle Tabellen aktiv
- ✅ Mieter sehen nur ihre eigenen Daten
- ✅ Verwalter/Admins haben vollen Zugriff auf ihre Liegenschaften
