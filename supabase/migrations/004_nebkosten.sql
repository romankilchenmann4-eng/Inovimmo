-- ============================================================
-- Inovimmo — Migration v4
-- Vollständige Nebenkostenabrechnung
-- ============================================================

-- Erweitere bestehende nebenkostenpositionen
alter table public.nebenkostenpositionen
  add column if not exists kategorie text not null default 'sonstiges'
    check (kategorie in ('heizung','warmwasser','wasser_abwasser','kehricht','allgemeinstrom','hauswart','versicherung','sonstiges')),
  add column if not exists notiz text;

-- Erweitere nebenkostenabrechnungen
alter table public.nebenkostenabrechnungen
  add column if not exists versendet_an text,
  add column if not exists pdf_url text,
  add column if not exists bezahlt_at timestamptz;

-- ── NEBENKOSTENABRECHNUNG POSITIONEN (Detailzeilen pro Abrechnung) ──
create table if not exists public.nk_abrechnung_positionen (
  id                    uuid primary key default uuid_generate_v4(),
  abrechnung_id         uuid not null references public.nebenkostenabrechnungen(id) on delete cascade,
  position_id           uuid references public.nebenkostenpositionen(id),
  bezeichnung           text not null,
  kategorie             text not null default 'sonstiges',
  betrag_total          numeric(10,2) not null,
  anteil_prozent        numeric(6,4) not null,
  betrag_anteil         numeric(10,2) not null,
  created_at            timestamptz not null default now()
);

create index idx_nk_pos_abrechnung on public.nk_abrechnung_positionen(abrechnung_id);

alter table public.nk_abrechnung_positionen enable row level security;
create policy "nk_pos_owner" on public.nk_abrechnung_positionen
  for all using (
    exists (
      select 1 from public.nebenkostenabrechnungen a
      join public.liegenschaften l on l.id = a.liegenschaft_id
      where a.id = abrechnung_id and l.verwalter_id = auth.uid()
    )
  );

-- Mieter können ihre eigene Abrechnung sehen
create policy "nk_abrechnungen_mieter_read" on public.nebenkostenabrechnungen
  for select using (
    exists (
      select 1 from public.wohnungen w
      where w.id = wohnung_id and w.mieter_id = auth.uid()
    )
  );
