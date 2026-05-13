-- ── SPRINT 10: Automation operations ─────────────────────────────────────────

create table if not exists public.automation_runs (
  id              uuid primary key default uuid_generate_v4(),
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

create index if not exists idx_automation_runs_job_started
  on public.automation_runs(job_name, started_at desc);

create index if not exists idx_automation_runs_status
  on public.automation_runs(status);

alter table public.automation_runs enable row level security;

create policy if not exists "automation_runs_admin_verwalter_read"
  on public.automation_runs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin','verwalter')
    )
  );

create policy if not exists "automation_runs_admin_verwalter_insert"
  on public.automation_runs
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin','verwalter')
    )
  );

create policy if not exists "automation_runs_admin_verwalter_update"
  on public.automation_runs
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin','verwalter')
    )
  );
