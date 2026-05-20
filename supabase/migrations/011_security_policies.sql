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
      -- Verwalter kann eigene Tokens sehen
      verwalter_id = auth.uid()
      -- ODER: Mieter kann Token für seine Email sehen (während Onboarding)
      OR (auth.jwt() ->> 'email' IS NOT NULL AND lower(mieter_email) = lower(auth.jwt() ->> 'email'))
    )
  );

-- ── MIETER ───────────────────────────────────────────────────
alter table public.mieter enable row level security;

drop policy if exists "mieter_owner" on public.mieter;
create policy "mieter_owner" on public.mieter
  for all using (verwalter_id = auth.uid());

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

-- ── LIEGENSCHAFTEN & WOHNUNGEN: Admin can see all ────────────────
drop policy if exists "liegenschaften_owner" on public.liegenschaften;
create policy "liegenschaften_owner" on public.liegenschaften
  for all using (
    verwalter_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "wohnungen_owner" on public.wohnungen;
create policy "wohnungen_owner" on public.wohnungen
  for all using (
    exists (select 1 from public.liegenschaften l where l.id = liegenschaft_id and l.verwalter_id = auth.uid())
    or mieter_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "mietverhaeltnisse_owner" on public.mietverhaeltnisse;
create policy "mietverhaeltnisse_owner" on public.mietverhaeltnisse
  for all using (
    exists (
      select 1 from public.liegenschaften l
      join public.wohnungen w on w.liegenschaft_id = l.id
      where w.id = mietverhaeltnisse.wohnung_id and l.verwalter_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
