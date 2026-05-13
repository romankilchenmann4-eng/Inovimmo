-- ── SPRINT 9: Eigentümer-Portal ────────────────────────────────────────────────

-- Link liegenschaften to eigentümer
alter table public.liegenschaften
  add column if not exists eigentümer_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_liegenschaften_eigentümer on public.liegenschaften(eigentümer_id);

-- RLS: eigentümer can read their own liegenschaften
create policy if not exists "liegenschaften_eigentümer_read" on public.liegenschaften
  for select using (eigentümer_id = auth.uid());

-- eigentümer can read wohnungen of their liegenschaften
create policy if not exists "wohnungen_eigentümer_read" on public.wohnungen
  for select using (
    exists (
      select 1 from public.liegenschaften l
      where l.id = liegenschaft_id
        and l.eigentümer_id = auth.uid()
    )
  );

-- eigentümer can read buchungen for their liegenschaften
create policy if not exists "buchungen_eigentümer_read" on public.buchungen
  for select using (
    exists (
      select 1 from public.liegenschaften l
      where l.id = liegenschaft_id
        and l.eigentümer_id = auth.uid()
    )
  );

-- eigentümer can read tickets for their liegenschaften
create policy if not exists "tickets_eigentümer_read" on public.tickets
  for select using (
    exists (
      select 1 from public.liegenschaften l
      where l.id = liegenschaft_id
        and l.eigentümer_id = auth.uid()
    )
  );
