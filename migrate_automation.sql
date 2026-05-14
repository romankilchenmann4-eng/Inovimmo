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

CREATE POLICY IF NOT EXISTS "automation_runs_admin_verwalter_read"
  ON public.automation_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','verwalter')
    )
  );

CREATE POLICY IF NOT EXISTS "automation_runs_admin_verwalter_insert"
  ON public.automation_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','verwalter')
    )
  );

CREATE POLICY IF NOT EXISTS "automation_runs_admin_verwalter_update"
  ON public.automation_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','verwalter')
    )
  );
