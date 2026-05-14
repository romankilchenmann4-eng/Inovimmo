-- ============================================================
-- Inovimmo — Migration v10
-- Mieter-Portal Zugriffe ueber Mieter-Stammdaten
-- ============================================================

drop policy if exists "nk_abrechnungen_mieter_read" on public.nebenkostenabrechnungen;

create policy "nk_abrechnungen_mieter_read" on public.nebenkostenabrechnungen
  for select using (
    exists (
      select 1 from public.mietverhaeltnisse mv
      join public.mieter m on m.id = mv.mieter_id
      where mv.wohnung_id = wohnung_id
        and mv.mietende is null
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "mieter_self_read" on public.mieter;
create policy "mieter_self_read" on public.mieter
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "mv_mieter_read" on public.mietverhaeltnisse;
create policy "mv_mieter_read" on public.mietverhaeltnisse
  for select using (
    exists (
      select 1 from public.mieter m
      where m.id = mieter_id
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "wohnungen_mieter_read" on public.wohnungen;
create policy "wohnungen_mieter_read" on public.wohnungen
  for select using (
    exists (
      select 1 from public.mietverhaeltnisse mv
      join public.mieter m on m.id = mv.mieter_id
      where mv.wohnung_id = public.wohnungen.id
        and mv.mietende is null
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  );
